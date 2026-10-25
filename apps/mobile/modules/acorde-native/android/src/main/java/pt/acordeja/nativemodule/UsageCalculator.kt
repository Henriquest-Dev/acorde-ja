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

  data class AppUsage(
    val packageName: String,
    var foregroundMs: Long = 0,
    var opens: Int = 0,
    var lastUsedAt: Long? = null,
  )

  data class Result(
    val startMs: Long,
    val endMs: Long,
    val apps: Map<String, AppUsage>,
    val currentForeground: String?,
  ) {
    val totalForegroundMs: Long get() = apps.values.sumOf { it.foregroundMs }
  }

  fun query(context: Context, startMs: Long, endMs: Long): Result {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val excluded = excludedPackages(context)
    val events = usm.queryEvents(startMs - LOOKBACK_MS, endMs)
    val apps = HashMap<String, AppUsage>()
    val openSince = HashMap<String, Long>()
    var lastForeground: String? = null
    val event = UsageEvents.Event()

    fun close(pkg: String, at: Long) {
      val since = openSince.remove(pkg) ?: return
      val from = maxOf(since, startMs)
      val to = minOf(at, endMs)
      if (to > from) {
        val u = apps.getOrPut(pkg) { AppUsage(pkg) }
        u.foregroundMs += to - from
        u.lastUsedAt = maxOf(u.lastUsedAt ?: 0L, to)
      }
    }

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      val ts = event.timeStamp
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          if (pkg in excluded) {
            lastForeground = pkg
            continue
          }
          // Outra app em primeiro plano fecha a anterior.
          openSince.keys.filter { it != pkg }.forEach { close(it, ts) }
          if (!openSince.containsKey(pkg)) openSince[pkg] = ts
          if (pkg != lastForeground && ts >= startMs && ts < endMs) {
            apps.getOrPut(pkg) { AppUsage(pkg) }.opens++
          }
          lastForeground = pkg
        }
        UsageEvents.Event.ACTIVITY_PAUSED, ACTIVITY_STOPPED -> close(pkg, ts)
        UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.KEYGUARD_SHOWN, DEVICE_SHUTDOWN -> {
          openSince.keys.toList().forEach { close(it, ts) }
          lastForeground = null
        }
      }
    }
    val current = openSince.keys.firstOrNull()
    openSince.keys.toList().forEach { close(it, endMs) }
    return Result(startMs, endMs, apps, current)
  }

  /** App actualmente em primeiro plano (eventos dos últimos minutos). */
  fun currentForegroundPackage(context: Context, now: Long): String? {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(now - 10 * 60 * 1000L, now)
    val event = UsageEvents.Event()
    var current: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> current = event.packageName
        UsageEvents.Event.ACTIVITY_PAUSED, ACTIVITY_STOPPED -> if (event.packageName == current) current = null
        UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.KEYGUARD_SHOWN -> current = null
      }
    }
    return current
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
