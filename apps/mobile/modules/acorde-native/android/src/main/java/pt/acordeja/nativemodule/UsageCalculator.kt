package pt.acordeja.nativemodule

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

/**
 * Calcula o tempo em primeiro plano por aplicação a partir dos eventos do
 * UsageStatsManager (dados reais do sistema). Usa eventos em vez de
 * queryUsageStats(INTERVAL_DAILY) porque os "buckets" diários do sistema não
 * respeitam a meia-noite local.
 */
object UsageCalculator {
  /** Janela anterior a `start` usada para detectar apps já abertas nesse instante. */
  private const val LOOKBACK_MS = 3 * 60 * 60 * 1000L

  data class Result(
    val startMs: Long,
    val endMs: Long,
    val apps: Map<String, ForegroundTracker.AppUsage>,
    val currentForeground: String?,
  ) {
    val totalForegroundMs: Long get() = apps.values.sumOf { it.foregroundMs }
  }

  fun query(context: Context, startMs: Long, endMs: Long): Result {
    val tracker = ForegroundTracker(startMs, endMs, excludedPackages(context))
    replay(context, startMs - LOOKBACK_MS, endMs, tracker)
    val current = tracker.current
    return Result(startMs, endMs, tracker.finish(endMs), current)
  }

  /** App actualmente em primeiro plano (eventos dos últimos minutos). */
  fun currentForegroundPackage(context: Context, now: Long): String? {
    val tracker = ForegroundTracker(now, now, excludedPackages(context))
    replay(context, now - 10 * 60 * 1000L, now, tracker)
    return tracker.current
  }

  /** Tempo de ecrã total por hora (24 posições) desde `dayStart` até `now`. */
  fun hourly(context: Context, dayStart: Long, now: Long): LongArray {
    val out = LongArray(24)
    for (h in 0 until 24) {
      val from = dayStart + h * 3_600_000L
      if (from >= now) break
      val to = minOf(from + 3_600_000L, now)
      out[h] = query(context, from, to).totalForegroundMs
    }
    return out
  }

  private fun replay(context: Context, from: Long, to: Long, tracker: ForegroundTracker) {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(from, to)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      val cls = event.className ?: ""
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> tracker.resume(pkg, cls, event.timeStamp)
        UsageEvents.Event.ACTIVITY_PAUSED, ACTIVITY_STOPPED -> tracker.pause(pkg, cls, event.timeStamp)
        UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.KEYGUARD_SHOWN, DEVICE_SHUTDOWN -> tracker.screenOff(event.timeStamp)
      }
    }
  }

  /** Launchers e a interface do sistema não contam como "tempo de ecrã" de apps. */
  private fun excludedPackages(context: Context): Set<String> {
    val set = mutableSetOf("com.android.systemui", context.packageName)
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    context.packageManager.queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY)
      .forEach { set.add(it.activityInfo.packageName) }
    return set
  }

  fun label(context: Context, pkg: String): String = try {
    val pm = context.packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
  } catch (_: PackageManager.NameNotFoundException) {
    pkg
  }

  // Constantes introduzidas em APIs mais recentes (valores estáveis do AOSP).
  private const val ACTIVITY_STOPPED = 23
  private const val DEVICE_SHUTDOWN = 26
}
