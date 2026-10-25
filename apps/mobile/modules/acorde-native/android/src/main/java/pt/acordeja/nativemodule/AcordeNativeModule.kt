package pt.acordeja.nativemodule

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.net.VpnService
import android.os.Build
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.Calendar

class PermissionDeniedException(message: String) : CodedException("ERR_PERMISSION_DENIED", message, null)
class InvalidArgumentException(message: String) : CodedException("ERR_INVALID_ARGUMENT", message, null)
class VpnNotPreparedException : CodedException("ERR_VPN_NOT_PREPARED", "O utilizador ainda não autorizou a VPN local.", null)
class ShieldLockedException : CodedException("ERR_SHIELD_LOCKED", "A protecção está bloqueada pelo desafio até à data escolhida.", null)

class AcordeNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw IllegalStateException("Contexto Android indisponível")
  private val store by lazy { RuleStore(context) }
  private var pendingVpnPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("AcordeNative")

    AsyncFunction("getNativeCapabilities") {
      val usage = Permissions.hasUsageAccess(context)
      val overlay = Permissions.hasOverlay(context)
      val notes = mutableListOf<String>()
      if (!usage) notes.add("Sem acesso aos dados de utilização: não é possível medir o tempo nas aplicações.")
      if (!overlay) notes.add("Sem permissão de sobreposição: o ecrã de bloqueio não pode ser mostrado sobre as aplicações.")
      notes.add("O filtro de sites não cobre navegadores com DNS seguro (DoH) activo nem o «DNS privado» em modo estrito.")
      mapOf(
        "platform" to "android",
        "canMeasureUsage" to usage,
        "canRestrictApps" to (usage && overlay),
        "canBlockSites" to true,
        "canListInstalledApps" to true,
        "enforcementRunning" to (store.enforcementEnabled && usage),
        "shieldRunning" to ShieldVpnService.isRunning,
        "osVersion" to "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
        "notes" to notes,
      )
    }

    AsyncFunction("getPermissionStatus") {
      mapOf(
        "usageAccess" to Permissions.state(Permissions.hasUsageAccess(context)),
        "overlay" to Permissions.state(Permissions.hasOverlay(context)),
        "notifications" to Permissions.state(Permissions.notificationsEnabled(context)),
        "vpn" to Permissions.state(Permissions.vpnPrepared(context)),
        "familyControls" to "unsupported",
      )
    }

    AsyncFunction("requestUsagePermission") {
      openSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) data = Uri.parse("package:${context.packageName}")
      }, fallback = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    AsyncFunction("requestOverlayPermission") {
      openSettings(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")))
    }

    AsyncFunction("openSystemSettings") { kind: String ->
      val intent = when (kind) {
        "vpn" -> Intent(Settings.ACTION_VPN_SETTINGS)
        "private_dns" -> Intent(Settings.ACTION_WIRELESS_SETTINGS)
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        "app" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
        else -> throw InvalidArgumentException("Definição desconhecida: $kind")
      }
      openSettings(intent)
    }

    AsyncFunction("getInstalledApps") {
      val pm = context.packageManager
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(launcher, 0)
        .map { it.activityInfo.packageName }
        .distinct()
        .filter { it != context.packageName }
        .mapNotNull { pkg ->
          runCatching {
            val info = pm.getApplicationInfo(pkg, 0)
            val category = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              ApplicationInfoCategory.name(info.category)
            } else null
            mapOf(
              "packageName" to pkg,
              "label" to pm.getApplicationLabel(info).toString(),
              "iconBase64" to iconBase64(pm, pkg),
              "category" to category,
            )
          }.getOrNull()
        }
        .sortedBy { (it["label"] as String).lowercase() }
    }

    AsyncFunction("getUsageStats") { startMs: Double, endMs: Double ->
      requireUsageAccess()
      if (endMs <= startMs) throw InvalidArgumentException("endMs tem de ser posterior a startMs")
      val result = UsageCalculator.query(context, startMs.toLong(), minOf(endMs.toLong(), System.currentTimeMillis()))
      mapOf(
        "startMs" to result.startMs.toDouble(),
        "endMs" to result.endMs.toDouble(),
        "totalForegroundMs" to result.totalForegroundMs.toDouble(),
        "apps" to result.apps.values.sortedByDescending { it.foregroundMs }.map {
          mapOf(
            "packageName" to it.packageName,
            "label" to UsageCalculator.label(context, it.packageName),
            "foregroundMs" to it.foregroundMs.toDouble(),
            "opens" to it.opens,
            "lastUsedAt" to it.lastUsedAt?.toDouble(),
          )
        },
      )
    }

    AsyncFunction("setRuleConfig") { json: String ->
      try {
        store.saveConfigJson(json)
      } catch (e: Exception) {
        throw InvalidArgumentException("Configuração inválida: ${e.message}")
      }
      if (store.enforcementEnabled) EnforcementService.start(context, invalidate = true)
    }

    AsyncFunction("setAppLimit") { appId: String, packageNames: List<String>, limitMinutes: Int, enabled: Boolean ->
      if (limitMinutes !in 1..720) throw InvalidArgumentException("O limite tem de estar entre 1 e 720 minutos")
      val previous = store.config().limits.firstOrNull { it.appId == appId }
      store.upsertLimit(RuleStore.Limit(appId, packageNames, limitMinutes, enabled, previous?.sinceMs ?: System.currentTimeMillis()))
      if (store.enforcementEnabled) EnforcementService.start(context, invalidate = true)
    }

    AsyncFunction("getAppLimit") { appId: String ->
      store.config().limits.firstOrNull { it.appId == appId }?.let {
        mapOf("appId" to it.appId, "limitMinutes" to it.limitMinutes, "enabled" to it.enabled)
      }
    }

    AsyncFunction("removeAppLimit") { appId: String ->
      store.removeLimit(appId)
    }

    AsyncFunction("getRestrictionStatus") {
      val config = store.config()
      if (!Permissions.hasUsageAccess(context)) {
        return@AsyncFunction config.limits.map {
          mapOf("appId" to it.appId, "state" to "PERMISSION_REQUIRED", "usedMs" to 0.0, "limitMs" to it.limitMinutes * 60_000.0)
        }
      }
      val now = System.currentTimeMillis()
      val cal = Calendar.getInstance()
      val start = (cal.clone() as Calendar).apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      }.timeInMillis
      val usage = UsageCalculator.query(context, start, now)
      val day = RuleStore.dayKey(now)
      config.limits.map { limit ->
        val window = if (limit.sinceMs > start) UsageCalculator.query(context, limit.sinceMs, now) else usage
        val used = limit.packages.sumOf { window.apps[it]?.foregroundMs ?: 0L }
        val ev = RuleEvaluator.evaluate(limit, used, config, day, cal)
        val state = if (ev.state in listOf("BLOCKED", "SCHEDULED_BLOCK") && !Permissions.hasOverlay(context)) {
          "PERMISSION_REQUIRED"
        } else ev.state
        mapOf("appId" to limit.appId, "state" to state, "usedMs" to ev.usedMs.toDouble(), "limitMs" to ev.limitMs.toDouble())
      }
    }

    AsyncFunction("startEnforcement") {
      requireUsageAccess()
      store.enforcementEnabled = true
      EnforcementService.start(context)
    }

    AsyncFunction("stopEnforcement") {
      store.enforcementEnabled = false
      EnforcementService.stop(context)
    }

    AsyncFunction("drainEvents") {
      store.drainEvents()
    }

    AsyncFunction("goHome") {
      BlockOverlay.goHome(context)
    }

    AsyncFunction("prepareShield") { promise: Promise ->
      val intent = VpnService.prepare(context)
      if (intent == null) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val activity: Activity = appContext.currentActivity ?: run {
        promise.reject(VpnNotPreparedException())
        return@AsyncFunction
      }
      pendingVpnPromise?.resolve(false)
      pendingVpnPromise = promise
      activity.startActivityForResult(intent, VPN_REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == VPN_REQUEST_CODE) {
        pendingVpnPromise?.resolve(payload.resultCode == Activity.RESULT_OK)
        pendingVpnPromise = null
      }
    }

    AsyncFunction("startShield") { domains: List<String>, upstream: String ->
      if (!Permissions.vpnPrepared(context)) throw VpnNotPreparedException()
      val requested = domains.map { it.lowercase().trim() }.filter { it.isNotEmpty() }
      // Durante o desafio a lista só pode crescer.
      store.shieldDomains = if (store.shieldLocked) (store.shieldDomains + requested).distinct() else requested
      store.shieldUpstream = if (upstream in ALLOWED_UPSTREAMS) upstream else "1.1.1.1"
      store.shieldEnabled = true
      ShieldVpnService.start(context)
    }

    AsyncFunction("stopShield") {
      if (store.shieldLocked) throw ShieldLockedException()
      store.shieldEnabled = false
      ShieldVpnService.stop(context)
    }

    AsyncFunction("setShieldLock") { untilMs: Double ->
      // O compromisso só pode ser prolongado, nunca encurtado.
      store.shieldLockUntil = maxOf(store.shieldLockUntil, untilMs.toLong())
      store.shieldLockUntil.toDouble()
    }

    AsyncFunction("getHourlyUsage") { dayStartMs: Double ->
      requireUsageAccess()
      UsageCalculator.hourly(context, dayStartMs.toLong(), System.currentTimeMillis()).map { it.toDouble() }
    }

    AsyncFunction("getShieldStats") {
      mapOf(
        "running" to ShieldVpnService.isRunning,
        "blockedToday" to store.shieldBlockedToday(),
        "domains" to store.shieldDomains.size,
        "lastError" to store.shieldLastError,
        "lockedUntil" to store.shieldLockUntil.toDouble(),
      )
    }
  }

  private fun requireUsageAccess() {
    if (!Permissions.hasUsageAccess(context)) {
      throw PermissionDeniedException("Acesso a dados de utilização não concedido.")
    }
  }

  private fun openSettings(intent: Intent, fallback: Intent? = null) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (e: Exception) {
      if (fallback == null) throw e
      context.startActivity(fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  private fun iconBase64(pm: PackageManager, pkg: String): String? = runCatching {
    val drawable = pm.getApplicationIcon(pkg)
    val size = 96
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, size, size)
    drawable.draw(canvas)
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
    Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }.getOrNull()

  companion object {
    private const val VPN_REQUEST_CODE = 41_020
    /** Resolvedores permitidos: Cloudflare (padrão) e Cloudflare for Families (bloqueia conteúdo adulto). */
    private val ALLOWED_UPSTREAMS = setOf("1.1.1.1", "1.1.1.3")
  }
}

private object ApplicationInfoCategory {
  fun name(category: Int): String? = when (category) {
    android.content.pm.ApplicationInfo.CATEGORY_GAME -> "game"
    android.content.pm.ApplicationInfo.CATEGORY_AUDIO -> "audio"
    android.content.pm.ApplicationInfo.CATEGORY_VIDEO -> "video"
    android.content.pm.ApplicationInfo.CATEGORY_IMAGE -> "image"
    android.content.pm.ApplicationInfo.CATEGORY_SOCIAL -> "social"
    android.content.pm.ApplicationInfo.CATEGORY_NEWS -> "news"
    android.content.pm.ApplicationInfo.CATEGORY_MAPS -> "maps"
    android.content.pm.ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
    else -> null
  }
}
