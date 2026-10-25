package pt.acordeja.nativemodule

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Ecrã de bloqueio nativo (preto e branco), apresentado sobre a aplicação
 * limitada através de uma janela TYPE_APPLICATION_OVERLAY. O utilizador mantém
 * sempre o controlo: pode ir para o ecrã inicial ou abrir o Acorde Já para
 * pedir tempo extra (excepto em modo estrito).
 */
class BlockOverlay(private val context: Context) {
  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var view: View? = null
  var shownForApp: String? = null
    private set

  fun canShow(): Boolean = Settings.canDrawOverlays(context)

  fun show(appId: String, appName: String, title: String, message: String, allowExtra: Boolean) {
    if (!canShow()) return
    if (shownForApp == appId && view != null) return
    hide()
    val density = context.resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()

    val root = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.BLACK)
      setPadding(dp(28), dp(48), dp(28), dp(48))
      isClickable = true
    }
    fun text(value: String, size: Float, color: Int, bold: Boolean = false, top: Int = 0) =
      TextView(context).apply {
        text = value
        textSize = size
        setTextColor(color)
        gravity = Gravity.CENTER
        if (bold) typeface = Typeface.DEFAULT_BOLD
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(top) }
      }
    fun button(label: String, filled: Boolean, top: Int, onClick: () -> Unit) = Button(context).apply {
      text = label
      isAllCaps = false
      textSize = 15f
      setTextColor(if (filled) Color.BLACK else Color.WHITE)
      background = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        setColor(if (filled) Color.WHITE else Color.BLACK)
        if (!filled) setStroke(dp(1), Color.WHITE)
      }
      layoutParams = LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(top) }
      setOnClickListener { onClick() }
    }

    root.addView(text(appName, 14f, Color.parseColor("#888888")))
    root.addView(text(title, 26f, Color.WHITE, bold = true, top = 12))
    root.addView(text(message, 15f, Color.parseColor("#CCCCCC"), top = 16))
    root.addView(text("Que tal fazer algo melhor com o seu tempo agora?", 14f, Color.parseColor("#888888"), top = 28))
    root.addView(button("Ver sugestões", true, 40) { openApp("block?appId=$appId&view=suggestions") })
    if (allowExtra) root.addView(button("Pedir tempo extra", false, 12) { openApp("block?appId=$appId&view=extra") })
    root.addView(button("Ir para o ecrã inicial", false, 12) { goHome(context); hide() })

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(-1, -1, type, WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.OPAQUE)
    runCatching { wm.addView(root, params) }.onSuccess {
      view = root
      shownForApp = appId
    }
  }

  fun hide() {
    view?.let { runCatching { wm.removeView(it) } }
    view = null
    shownForApp = null
  }

  private fun openApp(path: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("acordeja://$path"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    // Com a janela de sobreposição visível, o arranque da actividade é permitido.
    runCatching { context.startActivity(intent) }
    hide()
  }

  companion object {
    fun goHome(context: Context) {
      val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(home) }
    }
  }
}
