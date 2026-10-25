package pt.acordeja.nativemodule

import java.util.Calendar

/**
 * Espelho em Kotlin de packages/core/src/rules/engine.ts (referência e testes).
 * Mantido mínimo: apenas o necessário para aplicar regras com o app fechado.
 */
object RuleEvaluator {
  const val WARNING_THRESHOLD = 0.8

  data class Evaluation(
    val appId: String,
    val state: String,
    val usedMs: Long,
    val limitMs: Long,
    val effectiveLimitMs: Long,
  )

  fun parseTime(value: String): Int {
    val parts = value.split(":")
    require(parts.size == 2) { "Hora inválida: $value" }
    return parts[0].toInt() * 60 + parts[1].toInt()
  }

  /** Dia da semana com domingo = 0, como em JavaScript. */
  private fun jsDay(cal: Calendar) = cal.get(Calendar.DAY_OF_WEEK) - 1

  fun isScheduleActive(s: RuleStore.Schedule, now: Calendar): Boolean {
    if (!s.enabled) return false
    val start = parseTime(s.start)
    val end = parseTime(s.end)
    if (start == end) return false
    val minute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    val today = jsDay(now)
    val yesterday = (today + 6) % 7
    return if (start < end) {
      today in s.days && minute >= start && minute < end
    } else {
      when {
        minute >= start -> today in s.days
        minute < end -> yesterday in s.days
        else -> false
      }
    }
  }

  fun evaluate(limit: RuleStore.Limit, usedMs: Long, config: RuleStore.Config, day: String, now: Calendar): Evaluation {
    val limitMs = limit.limitMinutes * 60_000L
    val extraMs = config.exceptions.filter { it.appId == limit.appId && it.day == day }.sumOf { it.extraMinutes * 60_000L }
    val effective = limitMs + extraMs
    fun result(state: String) = Evaluation(limit.appId, state, usedMs, limitMs, effective)
    if (!limit.enabled) return result("AVAILABLE")
    val scheduled = config.schedules.any { (it.appIds.isEmpty() || limit.appId in it.appIds) && isScheduleActive(it, now) }
    if (scheduled) return result("SCHEDULED_BLOCK")
    if (usedMs >= limitMs) return result(if (usedMs < effective) "TEMPORARY_EXCEPTION" else "BLOCKED")
    if (usedMs >= limitMs * WARNING_THRESHOLD) return result("WARNING")
    return result("AVAILABLE")
  }
}
