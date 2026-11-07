package pt.acordeja.nativemodule

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Actividade «Início» do Android. Não tem interface própria: abre o ecrã
 * do launcher do offly (rota acordeja://launcher) e termina.
 */
class LauncherActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    openLauncher()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    openLauncher()
  }

  private fun openLauncher() {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("acordeja://launcher"))
      .setPackage(packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    runCatching { startActivity(intent) }
    finish()
    @Suppress("DEPRECATION")
    overridePendingTransition(0, 0)
  }
}
