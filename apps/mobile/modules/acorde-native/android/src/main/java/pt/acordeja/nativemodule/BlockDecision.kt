package pt.acordeja.nativemodule

import java.util.Calendar

/**
 * Decisão pura (testável em JVM): esta app está bloqueada agora?
 *
 * Usa o último estado calculado pelo EnforcementService para o dia (BLOCKED ou
 * SCHEDULED_BLOCK) e, por segurança, os horários de bloqueio activos neste minuto.
 */
object BlockDecision {
  private val BLOCKING = setOf("BLOCKED", "SCHEDULED_BLOCK")

  /** Devolve o limite que bloqueia `pkg`, ou null se a app pode ser usada. */
  fun blockingLimit(
    pkg: String,
    config: RuleStore.Config,
    stateOf: (appId: String) -> String?,
    now: Calendar,
  ): RuleStore.Limit? {
    for (limit in config.limits) {
      if (!limit.enabled || pkg !in limit.packages) continue
      if (stateOf(limit.appId) in BLOCKING) return limit
      val scheduled = config.schedules.any { (it.appIds.isEmpty() || limit.appId in it.appIds) && RuleEvaluator.isScheduleActive(it, now) }
      if (scheduled) return limit
    }
    return null
  }
}
