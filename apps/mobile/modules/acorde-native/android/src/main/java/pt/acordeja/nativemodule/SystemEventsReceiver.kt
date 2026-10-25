package pt.acordeja.nativemodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

/**
 * Restaura a aplicação de regras após reinício/actualização e regista
 * alterações de hora e fuso horário (o serviço recalcula o dia local).
 */
class SystemEventsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val store = RuleStore(context)
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {
        if (store.enforcementEnabled && Permissions.hasUsageAccess(context)) EnforcementService.start(context)
        if (store.shieldEnabled && Permissions.vpnPrepared(context)) ShieldVpnService.start(context)
        store.appendEvent(if (intent.action == Intent.ACTION_BOOT_COMPLETED) "device_rebooted" else "app_updated", null)
      }
      Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> {
        store.appendEvent(
          if (intent.action == Intent.ACTION_TIME_CHANGED) "clock_changed" else "timezone_changed",
          null,
          JSONObject().put("tz", java.util.TimeZone.getDefault().id),
        )
        if (store.enforcementEnabled) EnforcementService.start(context, invalidate = true)
      }
    }
  }
}
