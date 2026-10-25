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

  private val cacheByStart = HashMap<Long, UsageCalculator.Result>()
  private var lastHomeAt = 0L
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
    if (intent?.action == ACTION_INVALIDATE) cacheByStart.clear()
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
    keepShieldAlive()
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
    val dayStart = startOfDay(cal)
    val config = store.config()
    if (config.limits.isEmpty() && config.schedules.none { it.enabled }) {
      overlay.hide()
      return
    }

    // Recalcula a utilização a cada 15 s; entre recálculos usa a cache.
    // Cada janela começa na meia-noite ou no momento em que o limite passou a valer.
    if (cacheDay != day || elapsed - cacheAtElapsed > RECALC_MS) {
      cacheByStart.clear()
      cacheAtElapsed = elapsed
      cacheDay = day
    }
    fun usageFrom(start: Long) = cacheByStart.getOrPut(start) { UsageCalculator.query(this, start, now) }
    val foreground = UsageCalculator.currentForegroundPackage(this, now)
    val sinceCache = elapsed - cacheAtElapsed

    var blockedForeground: Pair<RuleStore.Limit, RuleEvaluator.Evaluation>? = null
    for (limit in config.limits) {
      val usage = usageFrom(maxOf(dayStart, limit.sinceMs))
      var used = limit.packages.sumOf { usage.apps[it]?.foregroundMs ?: 0L }
      if (foreground != null && foreground in limit.packages) used += sinceCache
      val ev = RuleEvaluator.evaluate(limit, used, config, day, cal)
      val name = limit.packages.firstOrNull()?.let { UsageCalculator.label(this, it) } ?: limit.appId
      val prev = store.lastState(limit.appId, day)
      if (prev != ev.state) {
        when (ev.state) {
          "WARNING" -> if (prev == null || prev == "AVAILABLE") {
            if (config.notify) Notifier.warn(this, limit.appId, name, ev.usedMs / 60_000, ev.limitMs / 60_000)
            store.appendEvent("warning", limit.appId, JSONObject().put("usedMs", ev.usedMs))
          }
          "BLOCKED" -> {
            if (config.notify) Notifier.blocked(this, limit.appId, name, ev.limitMs / 60_000)
            store.appendEvent("blocked", limit.appId, JSONObject().put("usedMs", ev.usedMs))
          }
          "SCHEDULED_BLOCK" -> store.appendEvent("scheduled_block", limit.appId)
        }
        store.setLastState(limit.appId, day, ev.state)
      }
      val isBlocked = ev.state == "BLOCKED" || ev.state == "SCHEDULED_BLOCK"
      // O ecrã de bloqueio sai quando a app deixa de estar bloqueada (ex.: tempo extra concedido).
      if (!isBlocked && overlay.shownForApp == limit.appId) overlay.hide()
      if (foreground != null && foreground in limit.packages && isBlocked) blockedForeground = limit to ev
    }

    val blocked = blockedForeground ?: return
    val (limit, ev) = blocked
    val pkg = limit.packages.firstOrNull { it == foreground } ?: limit.packages.firstOrNull()
    val name = pkg?.let { UsageCalculator.label(this, it) } ?: limit.appId
    if (overlay.shownForApp != limit.appId) {
      store.appendEvent("block_screen_shown", limit.appId, JSONObject().put("state", ev.state))
    }
    // Primeiro mostra o bloqueio (a janela visível permite lançar actividades),
    // depois envia a app para segundo plano: o vídeo/áudio pára e nada fica visível.
    if (ev.state == "SCHEDULED_BLOCK") {
      overlay.show(limit.appId, pkg, name, "Horário de bloqueio", "O $name está bloqueado neste horário.", allowExtra = false, until = scheduleEnd(config, limit, cal))
    } else {
      overlay.show(
        limit.appId, pkg, name, "Limite atingido",
        "Já utilizou os seus ${ev.limitMs / 60_000} minutos diários no $name.",
        allowExtra = !config.strictMode,
        until = BlockOverlay.nextMidnight(now),
      )
    }
    if (elapsed - lastHomeAt > HOME_THROTTLE_MS) {
      lastHomeAt = elapsed
      BlockOverlay.goHome(this)
    }
  }

  /** Desafio activo: se a VPN do filtro caiu, volta a ligá-la (com o consentimento já dado). */
  private fun keepShieldAlive() {
    if (!store.shieldEnabled || ShieldVpnService.isRunning) return
    if (store.shieldLocked && Permissions.vpnPrepared(this)) {
      store.appendEvent("shield_restarted", null)
      ShieldVpnService.start(this)
    }
  }

  private fun scheduleEnd(config: RuleStore.Config, limit: RuleStore.Limit, now: Calendar): Long {
    val s = config.schedules.firstOrNull { (it.appIds.isEmpty() || limit.appId in it.appIds) && RuleEvaluator.isScheduleActive(it, now) }
      ?: return BlockOverlay.nextMidnight(now.timeInMillis)
    val end = RuleEvaluator.parseTime(s.end)
    val c = (now.clone() as Calendar).apply {
      set(Calendar.HOUR_OF_DAY, end / 60); set(Calendar.MINUTE, end % 60); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }
    if (c.timeInMillis <= now.timeInMillis) c.add(Calendar.DAY_OF_YEAR, 1)
    return c.timeInMillis
  }

  private fun detectClockChange(wall: Long, elapsed: Long) {
    if (lastElapsed != 0L) {
      val drift = (wall - lastWall) - (elapsed - lastElapsed)
      if (kotlin.math.abs(drift) > CLOCK_TOLERANCE_MS) {
        store.appendEvent("clock_changed", null, JSONObject().put("driftMs", drift))
        cacheByStart.clear()
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
    private const val TICK_MS = 1_000L
    private const val HOME_THROTTLE_MS = 1_500L
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
