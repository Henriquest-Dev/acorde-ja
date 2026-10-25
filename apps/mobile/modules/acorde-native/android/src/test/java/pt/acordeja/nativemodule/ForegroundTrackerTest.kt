package pt.acordeja.nativemodule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ForegroundTrackerTest {
  private val yt = "com.google.android.youtube"

  @Test fun switchingActivitiesInsideTheSameAppKeepsItInForeground() {
    val t = ForegroundTracker(0, 100_000, setOf("launcher"))
    t.resume(yt, "WatchWhileActivity", 0)
    // Abrir os Shorts: a nova actividade é retomada ANTES de a anterior ser pausada.
    t.resume(yt, "ShortsActivity", 10_000)
    t.pause(yt, "WatchWhileActivity", 10_050)
    assertEquals(yt, t.current) // o bloqueio não pode desaparecer aqui
    val apps = t.finish(60_000)
    assertEquals(60_000L, apps[yt]!!.foregroundMs) // tempo contínuo, sem buracos
    assertEquals(1, apps[yt]!!.opens)
  }

  @Test fun goingHomeEndsForeground() {
    val t = ForegroundTracker(0, 100_000, setOf("launcher"))
    t.resume(yt, "A", 0)
    t.resume("launcher", "Home", 30_000)
    assertNull(t.current)
    assertEquals(30_000L, t.finish(90_000)[yt]!!.foregroundMs)
  }

  @Test fun windowStartClipsUsageBeforeTheLimitWasSet() {
    // Limite configurado aos 50 s: o uso anterior não conta.
    val t = ForegroundTracker(50_000, 100_000, emptySet())
    t.resume(yt, "A", 0)
    t.pause(yt, "A", 80_000)
    assertEquals(30_000L, t.finish(100_000)[yt]!!.foregroundMs)
  }

  @Test fun screenOffClosesEverything() {
    val t = ForegroundTracker(0, 100_000, emptySet())
    t.resume(yt, "A", 0)
    t.screenOff(20_000)
    assertNull(t.current)
    assertEquals(20_000L, t.finish(100_000)[yt]!!.foregroundMs)
  }
}
