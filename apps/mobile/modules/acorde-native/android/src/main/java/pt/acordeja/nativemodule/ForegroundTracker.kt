package pt.acordeja.nativemodule

/**
 * Máquina de estados pura (testável em JVM) que reconstrói o tempo em primeiro
 * plano a partir dos eventos do UsageStatsManager.
 *
 * Segue cada ACTIVIDADE (pacote + classe), não só o pacote: ao abrir os Shorts,
 * o YouTube retoma a nova actividade ANTES de pausar a anterior. Seguir só o
 * pacote fazia a app parecer fechada nesse instante — o bloqueio desaparecia e o
 * vídeo ficava visível, e o tempo era subcontado.
 */
class ForegroundTracker(private val windowStart: Long, private val windowEnd: Long, private val excluded: Set<String>) {
  data class AppUsage(val packageName: String, var foregroundMs: Long = 0, var opens: Int = 0, var lastUsedAt: Long? = null)

  val apps = HashMap<String, AppUsage>()
  /** Actividades retomadas por pacote. */
  private val resumed = HashMap<String, MutableSet<String>>()
  /** Desde quando cada pacote está em primeiro plano. */
  private val openSince = HashMap<String, Long>()
  private var lastForeground: String? = null

  /** Pacote actualmente em primeiro plano (o retomado mais recentemente), ou null. */
  var current: String? = null
    private set

  fun resume(pkg: String, cls: String, ts: Long) {
    if (pkg in excluded) {
      // Launcher/sistema em primeiro plano: as outras apps saíram.
      closeAll(ts)
      lastForeground = pkg
      current = null
      return
    }
    // Uma app diferente em primeiro plano fecha as anteriores.
    resumed.keys.filter { it != pkg }.toList().forEach { close(it, ts) }
    resumed.getOrPut(pkg) { mutableSetOf() }.add(cls)
    if (!openSince.containsKey(pkg)) openSince[pkg] = ts
    if (pkg != lastForeground && ts >= windowStart && ts < windowEnd) {
      apps.getOrPut(pkg) { AppUsage(pkg) }.opens++
    }
    lastForeground = pkg
    current = pkg
  }

  fun pause(pkg: String, cls: String, ts: Long) {
    val set = resumed[pkg] ?: return
    set.remove(cls)
    if (set.isEmpty()) close(pkg, ts)
  }

  /** Ecrã desligado, bloqueio do ecrã ou encerramento. */
  fun screenOff(ts: Long) {
    closeAll(ts)
    lastForeground = null
  }

  fun finish(ts: Long): Map<String, AppUsage> {
    val still = current
    closeAll(ts)
    current = still
    return apps
  }

  private fun closeAll(ts: Long) {
    resumed.keys.toList().forEach { close(it, ts) }
    current = null
  }

  private fun close(pkg: String, ts: Long) {
    resumed.remove(pkg)
    if (current == pkg) current = null
    val since = openSince.remove(pkg) ?: return
    val from = maxOf(since, windowStart)
    val to = minOf(ts, windowEnd)
    if (to > from) {
      val u = apps.getOrPut(pkg) { AppUsage(pkg) }
      u.foregroundMs += to - from
      u.lastUsedAt = maxOf(u.lastUsedAt ?: 0L, to)
    }
  }
}
