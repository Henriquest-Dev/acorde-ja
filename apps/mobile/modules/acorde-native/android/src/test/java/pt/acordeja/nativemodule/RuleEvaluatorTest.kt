package pt.acordeja.nativemodule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar

/** Espelha os casos de packages/core/src/rules/engine.test.ts. */
class RuleEvaluatorTest {
  private val limit = RuleStore.Limit("instagram", listOf("com.instagram.android"), 30, true)
  private fun cal(dayOfMonth: Int, h: Int, m: Int = 0) = Calendar.getInstance().apply { clear(); set(2026, Calendar.MAY, dayOfMonth, h, m) }
  private fun config(schedules: List<RuleStore.Schedule> = emptyList(), exceptions: List<RuleStore.Exception> = emptyList()) =
    RuleStore.Config(listOf(limit), schedules, false, exceptions)
  private val night = RuleStore.Schedule("night", true, "22:00", "07:00", listOf(0, 1, 2, 3, 4, 5, 6), emptyList())

  @Test fun thresholds() {
    val now = cal(12, 15)
    assertEquals("AVAILABLE", RuleEvaluator.evaluate(limit, 18 * 60_000L, config(), "2026-05-12", now).state)
    assertEquals("WARNING", RuleEvaluator.evaluate(limit, 24 * 60_000L, config(), "2026-05-12", now).state)
    assertEquals("BLOCKED", RuleEvaluator.evaluate(limit, 30 * 60_000L, config(), "2026-05-12", now).state)
  }

  @Test fun exceptionsExtendTheDay() {
    val c = config(exceptions = listOf(RuleStore.Exception("instagram", "2026-05-12", 5)))
    assertEquals("TEMPORARY_EXCEPTION", RuleEvaluator.evaluate(limit, 32 * 60_000L, c, "2026-05-12", cal(12, 15)).state)
    assertEquals("BLOCKED", RuleEvaluator.evaluate(limit, 32 * 60_000L, c, "2026-05-13", cal(13, 15)).state)
  }

  @Test fun overnightSchedule() {
    assertTrue(RuleEvaluator.isScheduleActive(night, cal(12, 23, 30)))
    assertTrue(RuleEvaluator.isScheduleActive(night, cal(13, 6, 59)))
    assertFalse(RuleEvaluator.isScheduleActive(night, cal(13, 7, 0)))
    val fridayOnly = night.copy(days = listOf(5))
    assertTrue(RuleEvaluator.isScheduleActive(fridayOnly, cal(16, 2))) // sábado 02:00 (começou sexta)
    assertFalse(RuleEvaluator.isScheduleActive(fridayOnly, cal(17, 2))) // domingo 02:00
    assertEquals("SCHEDULED_BLOCK", RuleEvaluator.evaluate(limit, 0, config(listOf(night)), "2026-05-12", cal(12, 23)).state)
  }

  @Test fun configRoundTrip() {
    val c = config(listOf(night), listOf(RuleStore.Exception("instagram", "2026-05-12", 5)))
    assertEquals(c, RuleStore.parse(RuleStore.toJson(c)))
  }
}
