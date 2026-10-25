package pt.acordeja.nativemodule

import android.app.AppOpsManager
import android.app.NotificationManager
import android.content.Context
import android.net.VpnService
import android.os.Build
import android.os.Process
import android.provider.Settings

object Permissions {
  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  fun hasOverlay(context: Context): Boolean = Settings.canDrawOverlays(context)

  fun notificationsEnabled(context: Context): Boolean =
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled()

  /** VpnService.prepare devolve null quando o utilizador já autorizou a VPN. */
  fun vpnPrepared(context: Context): Boolean = VpnService.prepare(context) == null

  fun state(granted: Boolean) = if (granted) "granted" else "denied"
}
