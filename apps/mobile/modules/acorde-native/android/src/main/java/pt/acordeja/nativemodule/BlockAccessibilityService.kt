package pt.acordeja.nativemodule

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import java.util.Calendar

/**
 * «Bloqueio reforçado» (opcional, activado pelo utilizador nas definições de Acessibilidade).
 *
 * O UsageStatsManager só regista a mudança de app com alguns segundos de atraso, e
 * dá para voltar ao YouTube nesse intervalo. Este serviço recebe a mudança de
 * janela no próprio instante e, se a app já está bloqueada, volta ao ecrã inicial
 * e pede ao EnforcementService para mostrar o ecrã de bloqueio.
 *
 * Privacidade: só lê o nome do pacote da janela em primeiro plano. Não lê nem
 * guarda o conteúdo do ecrã (canRetrieveWindowContent = false).
 */
class BlockAccessibilityService : AccessibilityService() {
  private var store: RuleStore? = null
  private var lastHomeAt = 0L

  override fun onServiceConnected() {
    super.onServiceConnected()
    store = RuleStore(this)
    running = true
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg == packageName || pkg == "com.android.systemui") return
    val s = store ?: return
    if (!s.enforcementEnabled) return
    val now = System.currentTimeMillis()
    val day = RuleStore.dayKey(now)
    val limit = BlockDecision.blockingLimit(pkg, s.config(), { s.lastState(it, day) }, Calendar.getInstance()) ?: return
    if (now - lastHomeAt > 400) {
      lastHomeAt = now
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
    s.appendEvent("strong_block", limit.appId)
    EnforcementService.blockNow(this, pkg)
  }

  override fun onInterrupt() = Unit

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }

  companion object {
    @Volatile var running = false

    /** O utilizador activou o serviço nas definições de Acessibilidade? */
    fun isEnabled(context: Context): Boolean {
      val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
      val me = ComponentName(context, BlockAccessibilityService::class.java)
      return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
    }
  }
}
