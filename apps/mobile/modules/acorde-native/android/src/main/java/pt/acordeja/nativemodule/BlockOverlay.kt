package pt.acordeja.nativemodule

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Calendar

/**
 * Ecrã de bloqueio nativo, por cima de tudo (TYPE_APPLICATION_OVERLAY).
 *
 * - Fica visível até o utilizador escolher uma opção (não desaparece quando a
 *   app bloqueada vai para segundo plano), por isso nada da app fica visível.
 * - Animado: entrada suave, anéis a pulsar à volta do ícone (a cinzento),
 *   contagem até voltar a estar disponível e frases que alternam.
 * - O utilizador mantém sempre o controlo do telemóvel: pode ir para o ecrã
 *   inicial; o Acorde Já nunca bloqueia chamadas nem as definições.
 */
class BlockOverlay(private val context: Context) {
  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val ui = Handler(Looper.getMainLooper())
  private var view: View? = null
  private val animators = mutableListOf<ValueAnimator>()
  private var ticker: Runnable? = null

  var shownForApp: String? = null
    private set

  fun canShow(): Boolean = Settings.canDrawOverlays(context)

  /**
   * @param until momento em que a app volta a estar disponível (meia-noite ou fim do horário).
   */
  fun show(appId: String, packageName: String?, appName: String, title: String, message: String, allowExtra: Boolean, until: Long) {
    if (!canShow()) return
    if (shownForApp == appId && view != null) return
    hide()
    val d = context.resources.displayMetrics.density
    fun dp(v: Int) = (v * d).toInt()

    val root = FrameLayout(context).apply {
      setBackgroundColor(Color.BLACK)
      alpha = 0f
      isClickable = true
      isFocusable = true
    }
    val column = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(28), dp(72), dp(28), dp(40))
    }
    root.addView(column, FrameLayout.LayoutParams(-1, -1))

    // Ícone da app a cinzento, com anéis a pulsar.
    val stage = FrameLayout(context)
    val pulse = PulseView(context)
    stage.addView(pulse, FrameLayout.LayoutParams(dp(180), dp(180), Gravity.CENTER))
    val icon = ImageView(context).apply {
      runCatching { packageName?.let { setImageDrawable(context.packageManager.getApplicationIcon(it)) } }
      colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
      alpha = 0.9f
    }
    stage.addView(icon, FrameLayout.LayoutParams(dp(64), dp(64), Gravity.CENTER))
    column.addView(stage, LinearLayout.LayoutParams(dp(180), dp(180)))

    fun text(value: String, size: Float, color: Int, bold: Boolean = false, top: Int = 0) =
      TextView(context).apply {
        text = value
        textSize = size
        setTextColor(color)
        gravity = Gravity.CENTER
        if (bold) typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(top) }
      }

    column.addView(text(title, 26f, Color.WHITE, bold = true, top = 8))
    column.addView(text(message, 15f, Color.parseColor("#CCCCCC"), top = 12))
    val countdown = text("", 13f, Color.parseColor("#888888"), top = 10)
    column.addView(countdown)
    val quote = text(QUOTES[0], 14f, Color.parseColor("#AAAAAA"), top = 28)
    column.addView(quote)
    column.addView(View(context), LinearLayout.LayoutParams(1, 0, 1f))

    fun button(label: String, filled: Boolean, top: Int, onClick: () -> Unit) = TextView(context).apply {
      text = label
      textSize = 15f
      gravity = Gravity.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      setTextColor(if (filled) Color.BLACK else Color.WHITE)
      background = GradientDrawable().apply {
        cornerRadius = dp(16).toFloat()
        setColor(if (filled) Color.WHITE else Color.BLACK)
        if (!filled) setStroke(dp(1), Color.WHITE)
      }
      layoutParams = LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(top) }
      isClickable = true
      setOnTouchListener(PressScale)
      setOnClickListener { onClick() }
    }
    val buttons = mutableListOf<View>()
    buttons += button("Ver sugestões", true, 0) { openApp("block?appId=$appId&view=suggestions") }
    if (allowExtra) buttons += button("Pedir tempo extra", false, 12) { openApp("block?appId=$appId&view=extra") }
    buttons += button("Fechar", false, 12) { goHome(context); hide() }
    buttons.forEach { column.addView(it) }

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(
      -1, -1, type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.OPAQUE,
    ).apply { gravity = Gravity.TOP }
    if (runCatching { wm.addView(root, params) }.isFailure) return
    view = root
    shownForApp = appId

    // Entrada: fade + elevação dos elementos em cascata.
    root.animate().alpha(1f).setDuration(280).start()
    (listOf(stage) + buttons).forEachIndexed { i, v ->
      v.translationY = dp(24).toFloat(); v.alpha = 0f
      v.animate().translationY(0f).alpha(1f).setStartDelay(120L + i * 70L).setDuration(380).setInterpolator(DecelerateInterpolator()).start()
    }
    animators += pulse.start()

    // Contagem e frases a alternar.
    var i = 0
    val tick = object : Runnable {
      override fun run() {
        countdown.text = "Disponível novamente em ${formatRemaining(until - System.currentTimeMillis())}"
        if (i++ % 5 == 4) {
          quote.animate().alpha(0f).setDuration(250).withEndAction {
            quote.text = QUOTES[(i / 5) % QUOTES.size]
            quote.animate().alpha(1f).setDuration(250).start()
          }.start()
        }
        ui.postDelayed(this, 1000)
      }
    }
    ticker = tick
    ui.post(tick)
  }

  fun hide() {
    ticker?.let { ui.removeCallbacks(it) }
    ticker = null
    animators.forEach { it.cancel() }
    animators.clear()
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

  /** Anéis concêntricos que se expandem e desvanecem. */
  private class PulseView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = Color.WHITE }
    private var phase = 0f

    fun start(): ValueAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 2400
      repeatCount = ValueAnimator.INFINITE
      addUpdateListener { phase = it.animatedValue as Float; invalidate() }
      start()
    }

    override fun onDraw(canvas: Canvas) {
      val cx = width / 2f
      val cy = height / 2f
      val maxR = minOf(cx, cy)
      for (k in 0 until 3) {
        val p = (phase + k / 3f) % 1f
        paint.strokeWidth = 2f * resources.displayMetrics.density
        paint.alpha = ((1f - p) * 140).toInt()
        canvas.drawCircle(cx, cy, maxR * (0.4f + 0.6f * p), paint)
      }
    }
  }

  private object PressScale : View.OnTouchListener {
    @SuppressLint("ClickableViewAccessibility")
    override fun onTouch(v: View, e: MotionEvent): Boolean {
      when (e.actionMasked) {
        MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(90).start()
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> v.animate().scaleX(1f).scaleY(1f).setDuration(140).start()
      }
      return false
    }
  }

  companion object {
    private val QUOTES = listOf(
      "Que tal fazer algo melhor com o seu tempo agora?",
      "Respire fundo. O impulso passa.",
      "Menos tela. Mais vida.",
      "Levante-se, beba um copo de água.",
      "Ligue a alguém de quem gosta.",
    )

    fun goHome(context: Context) {
      val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(home) }
    }

    fun formatRemaining(ms: Long): String {
      val min = maxOf(0L, ms / 60_000)
      val h = min / 60
      val m = min % 60
      return if (h > 0) "${h}h ${m.toString().padStart(2, '0')}min" else "$m min"
    }

    /** Próxima meia-noite local. */
    fun nextMidnight(now: Long): Long = Calendar.getInstance().apply {
      timeInMillis = now
      add(Calendar.DAY_OF_YEAR, 1)
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis
  }
}
