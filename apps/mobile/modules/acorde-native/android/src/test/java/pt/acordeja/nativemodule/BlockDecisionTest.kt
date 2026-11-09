package pt.acordeja.nativemodule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Calendar

class BlockDecisionTest {
  private val yt = RuleStore.Limit("youtube", listOf("com.google.android.youtube"), 30, true)
  private fun config(limits: List<RuleStore.Limit> = listOf(yt), schedules: List<RuleStore.Schedule> = emptyList()) =
    RuleStore.Config(limits, schedules, strictMode = false, exceptions = emptyList())

  private fun at(h: Int, m: Int = 0): Calendar = Calendar.getInstance().apply {
    set(2026, Calendar.NOVEMBER, 9, h, m, 0) // segunda-feira
  }

  @Test
  fun youtubeBloqueadoQuandoOLimiteEsgotou() {
    val hit = BlockDecision.blockingLimit("com.google.android.youtube", config(), { if (it == "youtube") "BLOCKED" else null }, at(15))
    assertEquals("youtube", hit?.appId)
  }

  @Test
  fun voltarAAbrirNaoEscapaAoBloqueio() {
    // o estado do dia mantém-se BLOCKED: qualquer nova abertura é bloqueada
    repeat(3) {
      assertEquals("youtube", BlockDecision.blockingLimit("com.google.android.youtube", config(), { "BLOCKED" }, at(16))?.appId)
    }
  }

  @Test
  fun appsSemLimiteOuDentroDoLimiteNaoSaoBloqueadas() {
    assertNull(BlockDecision.blockingLimit("com.android.chrome", config(), { "BLOCKED" }, at(15)))
    assertNull(BlockDecision.blockingLimit("com.google.android.youtube", config(), { "WARNING" }, at(15)))
    assertNull(BlockDecision.blockingLimit("com.google.android.youtube", config(listOf(yt.copy(enabled = false))), { "BLOCKED" }, at(15)))
  }

  @Test
  fun horarioDeBloqueioActivoBloqueiaSemEstadoGuardado() {
    val night = RuleStore.Schedule("night", true, "22:00", "07:00", listOf(0, 1, 2, 3, 4, 5, 6), emptyList())
    assertEquals("youtube", BlockDecision.blockingLimit("com.google.android.youtube", config(schedules = listOf(night)), { null }, at(23))?.appId)
    assertNull(BlockDecision.blockingLimit("com.google.android.youtube", config(schedules = listOf(night)), { null }, at(12)))
  }
}
