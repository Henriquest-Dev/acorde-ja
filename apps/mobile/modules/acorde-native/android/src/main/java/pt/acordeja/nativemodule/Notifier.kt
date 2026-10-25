package pt.acordeja.nativemodule

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

object Notifier {
  const val CHANNEL_SERVICE = "acorde_service"
  const val CHANNEL_LIMITS = "acorde_limits"

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_SERVICE, "Protecção activa", NotificationManager.IMPORTANCE_MIN).apply {
        description = "Indica que os seus limites estão a ser aplicados."
        setShowBadge(false)
      },
    )
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_LIMITS, "Avisos de limite", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Avisos aos 80% e ao atingir o limite diário."
      },
    )
  }

  /** Abre o aplicativo numa rota (deep link acordeja://…). */
  fun deepLink(context: Context, path: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("acordeja://$path"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context, path.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun serviceNotification(context: Context): Notification =
    builder(context, CHANNEL_SERVICE)
      .setContentTitle("Acorde Já")
      .setContentText("Os seus limites estão activos.")
      .setOngoing(true)
      .setContentIntent(deepLink(context, ""))
      .build()

  fun warn(context: Context, appId: String, appName: String, usedMin: Long, limitMin: Long) {
    val n = builder(context, CHANNEL_LIMITS)
      .setContentTitle("80% do limite")
      .setContentText("Já utilizou $usedMin dos $limitMin minutos diários no $appName.")
      .setAutoCancel(true)
      .setContentIntent(deepLink(context, "limit-warning?appId=$appId"))
      .build()
    notify(context, appId.hashCode(), n)
  }

  fun blocked(context: Context, appId: String, appName: String, limitMin: Long) {
    val n = builder(context, CHANNEL_LIMITS)
      .setContentTitle("Limite atingido")
      .setContentText("Já utilizou os seus $limitMin minutos diários no $appName.")
      .setAutoCancel(true)
      .setContentIntent(deepLink(context, "block?appId=$appId"))
      .build()
    notify(context, appId.hashCode(), n)
  }

  private fun notify(context: Context, id: Int, n: Notification) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 33 && !nm.areNotificationsEnabled()) return
    nm.notify(id, n)
  }

  @Suppress("DEPRECATION")
  private fun builder(context: Context, channel: String): Notification.Builder {
    ensureChannels(context)
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, channel) else Notification.Builder(context)
    return b.setSmallIcon(R.drawable.ic_acorde_notification).setColor(0xFF000000.toInt())
  }
}
