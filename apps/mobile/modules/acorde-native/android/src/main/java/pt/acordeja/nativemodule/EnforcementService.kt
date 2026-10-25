package pt.acordeja.nativemodule

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import java.util.Calendar

/**
 * Serviço em primeiro plano que aplica os limites com o aplicativo fechado.
 *
 * - Lê a utilização real com UsageStatsManager (sem AccessibilityService).
 * - Notifica aos 80% e ao atingir o limite (apenas nas transições).
 * - Quando a app limitada está em primeiro plano e bloqueada, mostra o ecrã
 *   de bloqueio por sobreposição (requer «Sobrepor a outras apps»).
 * - Detecta alterações do relógio comparando com o relógio monotónico.
 */
class EnforcementService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var store: RuleStore
  private lateinit var overlay: BlockOverlay

  private var cache: UsageCalculator.Result? = null
  private var cacheAtElapsed = 0L
  private var cacheDay: String? = null
  private var lastWall = 0L
  private var lastElapsed = 0L

  private val loop = object : Runnable {
    override fun run() {
      runCatching { tick() }.onFailure { store.appendEvent("service_error", null, JSONObject().put("message", it.message)) }
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    store = RuleStore(this)
    overlay = BlockOverlay(this)
    Notifier.ensureChannels(this)
    val notification = Notifier.serviceNotification(this)
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_INVALIDATE) cache = null
    handler.removeCallbacks(loop)
    handler.post(loop)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(loop)
    overlay.hide()
    super.onDestroy()
  }

  private fun tick() {
    if (!Permissions.hasUsageAccess(this)) {
      // Permissão revogada: regista e deixa de aplicar (sem fingir bloqueios).
      overlay.hide()
      if (store.lastState("__permission__", RuleStore.dayKey(System.currentTimeMillis())) != "revoked") {
        store.appendEvent("permission_revoked", null)
        store.setLastState("__permission__", RuleStore.dayKey(System.currentTimeMillis()), "revoked")
      }
      return
    }
    val now = System.currentTimeMillis()
    val elapsed = SystemClock.elapsedRealtime()
    detectClockChange(now, elapsed)

    val cal = Calendar.getInstance()
    val day = RuleStore.dayKey(now)
    val config = store.config()
    if (config.limits.isEmpty() && config.schedules.none { it.enabled }) {
      overlay.hide()
      return
    }

    // Recalcula a utilização do dia a cada 15 s; entre recálculos usa a cache.
    if (cache == null || cacheDay != day || elapsed - cacheAtElapsed > RECALC_MS) {
      cache = UsageCalculator.query(this, startOfDay(cal), now)
      cacheAtElapsed = elapsed
      cacheDay = day
    }
    val usage = cache!!
    val foreground = UsageCalculator.currentForegroundPackage(this, now)
    val sinceCache = elapsed - cacheAtElapsed

    var blockedForeground: Pair<RuleStore.Limit, RuleEvaluator.Evaluation>? = null
    for (limit in config.limits) {
      var used = limit.packages.sumOf { usage.apps[it]?.foregroundMs ?: 0L }
      if (foreground != null && foreground in limit.packages) used += sinceCache
      val ev = RuleEvaluator.evaluate(limit, used, config, day, cal)
      val name = limit.packages.firstOrNull()?.let { UsageCalculator.label(this, it) } ?: limit.appId
      val prev = store.lastState(limit.appId, day)
      if (prev != ev.state) {
        when (ev.state) {
          "WARNING" -> if (prev == null || prev == "AVAILABLE") {
            Notifier.warn(this, limit.appId, name, ev.usedMs / 60_000, ev.limitMs / 60_000)
            store.appendEvent("warning", limit.appId, JSONObject().put("usedMs", ev.usedMs))
          }
          "BLOCKED" -> {
            Notifier.blocked(this, limit.appId, name, ev.limitMs / 60_000)
            store.appendEvent("blocked", limit.appId, JSONObject().put("usedMs", ev.usedMs))
          }
          "SCHEDULED_BLOCK" -> store.appendEvent("scheduled_block", limit.appId)
        }
        store.setLastState(limit.appId, day, ev.state)
      }
      if (foreground != null && foreground in limit.packages && (ev.state == "BLOCKED" || ev.state == "SCHEDULED_BLOCK")) {
        blockedForeground = limit to ev
      }
    }

    val blocked = blockedForeground
    if (blocked == null) {
      overlay.hide()
      return
    }
    val (limit, ev) = blocked
    val name = limit.packages.firstOrNull()?.let { UsageCalculator.label(this, it) } ?: limit.appId
    if (overlay.shownForApp != limit.appId) {
      store.appendEvent("block_screen_shown", limit.appId, JSONObject().put("state", ev.state))
    }
    if (ev.state == "SCHEDULED_BLOCK") {
      overlay.show(limit.appId, name, "Horário de bloqueio", "O $name está bloqueado neste horário.", allowExtra = false)
    } else {
      overlay.show(
        limit.appId, name, "Limite atingido",
        "Já utilizou os seus ${ev.limitMs / 60_000} minutos diários no $name.",
        allowExtra = !config.strictMode,
      )
    }
  }

  private fun detectClockChange(wall: Long, elapsed: Long) {
    if (lastElapsed != 0L) {
      val drift = (wall - lastWall) - (elapsed - lastElapsed)
      if (kotlin.math.abs(drift) > CLOCK_TOLERANCE_MS) {
        store.appendEvent("clock_changed", null, JSONObject().put("driftMs", drift))
        cache = null
      }
    }
    lastWall = wall
    lastElapsed = elapsed
  }

  private fun startOfDay(now: Calendar): Long = (now.clone() as Calendar).apply {
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  companion object {
    const val NOTIFICATION_ID = 4101
    const val ACTION_INVALIDATE = "pt.acordeja.INVALIDATE"
    private const val TICK_MS = 2_000L
    private const val RECALC_MS = 15_000L
    private const val CLOCK_TOLERANCE_MS = 2 * 60_000L

    fun start(context: Context, invalidate: Boolean = false): Boolean = runCatching {
      val intent = Intent(context, EnforcementService::class.java)
      if (invalidate) intent.action = ACTION_INVALIDATE
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      true
    }.getOrDefault(false)

    fun stop(context: Context) {
      context.stopService(Intent(context, EnforcementService::class.java))
    }
  }
}
