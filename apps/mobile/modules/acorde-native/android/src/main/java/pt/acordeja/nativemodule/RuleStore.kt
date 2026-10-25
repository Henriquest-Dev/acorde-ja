package pt.acordeja.nativemodule

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Persistência das regras para o serviço nativo, que tem de funcionar com o
 * aplicativo fechado e após reinício. O JS envia a configuração completa
 * (setRuleConfig) e esta é guardada em SharedPreferences.
 */
class RuleStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  data class Limit(val appId: String, val packages: List<String>, val limitMinutes: Int, val enabled: Boolean)
  data class Schedule(
    val id: String,
    val enabled: Boolean,
    val start: String,
    val end: String,
    val days: List<Int>,
    val appIds: List<String>,
  )
  data class Exception(val appId: String, val day: String, val extraMinutes: Int)
  data class Config(
    val limits: List<Limit>,
    val schedules: List<Schedule>,
    val strictMode: Boolean,
    val exceptions: List<Exception>,
  )

  fun saveConfigJson(json: String) {
    parse(json) // valida antes de guardar
    prefs.edit().putString(KEY_CONFIG, json).apply()
  }

  fun config(): Config = prefs.getString(KEY_CONFIG, null)?.let { runCatching { parse(it) }.getOrNull() }
    ?: Config(emptyList(), emptyList(), false, emptyList())

  fun upsertLimit(limit: Limit) {
    val c = config()
    val limits = c.limits.filter { it.appId != limit.appId } + limit
    saveConfigJson(toJson(c.copy(limits = limits)))
  }

  fun removeLimit(appId: String) {
    val c = config()
    saveConfigJson(toJson(c.copy(limits = c.limits.filter { it.appId != appId })))
  }

  var enforcementEnabled: Boolean
    get() = prefs.getBoolean(KEY_ENFORCEMENT, false)
    set(v) = prefs.edit().putBoolean(KEY_ENFORCEMENT, v).apply()

  var shieldEnabled: Boolean
    get() = prefs.getBoolean(KEY_SHIELD, false)
    set(v) = prefs.edit().putBoolean(KEY_SHIELD, v).apply()

  var shieldDomains: List<String>
    get() = prefs.getString(KEY_SHIELD_DOMAINS, null)?.let { s ->
      val a = JSONArray(s)
      List(a.length()) { a.getString(it) }
    } ?: emptyList()
    set(v) = prefs.edit().putString(KEY_SHIELD_DOMAINS, JSONArray(v).toString()).apply()

  var shieldUpstream: String
    get() = prefs.getString(KEY_SHIELD_UPSTREAM, "1.1.1.1") ?: "1.1.1.1"
    set(v) = prefs.edit().putString(KEY_SHIELD_UPSTREAM, v).apply()

  /** Último estado notificado por app, para notificar apenas transições. Reinicia por dia. */
  fun lastState(appId: String, day: String): String? =
    if (prefs.getString(KEY_STATE_DAY, null) == day) prefs.getString("$KEY_STATE_PREFIX$appId", null) else null

  fun setLastState(appId: String, day: String, state: String) {
    val e = prefs.edit()
    if (prefs.getString(KEY_STATE_DAY, null) != day) {
      prefs.all.keys.filter { it.startsWith(KEY_STATE_PREFIX) }.forEach { e.remove(it) }
      e.putString(KEY_STATE_DAY, day)
    }
    e.putString("$KEY_STATE_PREFIX$appId", state).apply()
  }

  /** Eventos (aviso, bloqueio, relógio alterado…) a recolher pelo JS para o histórico local. */
  @Synchronized
  fun appendEvent(kind: String, appId: String?, meta: JSONObject = JSONObject()) {
    val arr = JSONArray(prefs.getString(KEY_EVENTS, "[]"))
    if (arr.length() >= MAX_EVENTS) return
    arr.put(
      JSONObject()
        .put("id", java.util.UUID.randomUUID().toString())
        .put("kind", kind)
        .put("appId", appId ?: JSONObject.NULL)
        .put("day", dayKey(System.currentTimeMillis()))
        .put("createdAt", System.currentTimeMillis())
        .put("meta", meta),
    )
    prefs.edit().putString(KEY_EVENTS, arr.toString()).apply()
  }

  @Synchronized
  fun drainEvents(): String {
    val s = prefs.getString(KEY_EVENTS, "[]") ?: "[]"
    prefs.edit().putString(KEY_EVENTS, "[]").apply()
    return s
  }

  fun incrementShieldBlocked(): Int {
    val day = dayKey(System.currentTimeMillis())
    val count = if (prefs.getString(KEY_SHIELD_DAY, null) == day) prefs.getInt(KEY_SHIELD_COUNT, 0) + 1 else 1
    prefs.edit().putString(KEY_SHIELD_DAY, day).putInt(KEY_SHIELD_COUNT, count).apply()
    return count
  }

  fun shieldBlockedToday(): Int =
    if (prefs.getString(KEY_SHIELD_DAY, null) == dayKey(System.currentTimeMillis())) prefs.getInt(KEY_SHIELD_COUNT, 0) else 0

  var shieldLastError: String?
    get() = prefs.getString(KEY_SHIELD_ERROR, null)
    set(v) = prefs.edit().putString(KEY_SHIELD_ERROR, v).apply()

  companion object {
    private const val PREFS = "acorde_rules"
    private const val KEY_CONFIG = "config"
    private const val KEY_ENFORCEMENT = "enforcement_enabled"
    private const val KEY_SHIELD = "shield_enabled"
    private const val KEY_SHIELD_DOMAINS = "shield_domains"
    private const val KEY_SHIELD_UPSTREAM = "shield_upstream"
    private const val KEY_SHIELD_DAY = "shield_day"
    private const val KEY_SHIELD_COUNT = "shield_count"
    private const val KEY_SHIELD_ERROR = "shield_error"
    private const val KEY_STATE_DAY = "state_day"
    private const val KEY_STATE_PREFIX = "state_"
    private const val KEY_EVENTS = "events"
    private const val MAX_EVENTS = 500

    fun dayKey(ms: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(ms))

    fun parse(json: String): Config {
      val o = JSONObject(json)
      fun strings(a: JSONArray?) = if (a == null) emptyList() else List(a.length()) { a.getString(it) }
      fun ints(a: JSONArray?) = if (a == null) emptyList() else List(a.length()) { a.getInt(it) }
      val limits = o.optJSONArray("limits")?.let { a ->
        List(a.length()) {
          val l = a.getJSONObject(it)
          val minutes = l.getInt("limitMinutes")
          require(minutes in 1..720) { "limitMinutes fora do intervalo" }
          Limit(l.getString("appId"), strings(l.optJSONArray("packageNames")), minutes, l.optBoolean("enabled", true))
        }
      } ?: emptyList()
      val schedules = o.optJSONArray("schedules")?.let { a ->
        List(a.length()) {
          val s = a.getJSONObject(it)
          Schedule(
            s.getString("id"), s.optBoolean("enabled", false), s.getString("start"), s.getString("end"),
            ints(s.optJSONArray("days")), strings(s.optJSONArray("appIds")),
          )
        }
      } ?: emptyList()
      val exceptions = o.optJSONArray("exceptions")?.let { a ->
        List(a.length()) {
          val e = a.getJSONObject(it)
          Exception(e.getString("appId"), e.getString("day"), e.getInt("extraMinutes"))
        }
      } ?: emptyList()
      return Config(limits, schedules, o.optBoolean("strictMode", false), exceptions)
    }

    fun toJson(c: Config): String {
      val o = JSONObject()
      o.put("limits", JSONArray(c.limits.map {
        JSONObject().put("appId", it.appId).put("packageNames", JSONArray(it.packages))
          .put("limitMinutes", it.limitMinutes).put("enabled", it.enabled)
      }))
      o.put("schedules", JSONArray(c.schedules.map {
        JSONObject().put("id", it.id).put("enabled", it.enabled).put("start", it.start).put("end", it.end)
          .put("days", JSONArray(it.days)).put("appIds", JSONArray(it.appIds))
      }))
      o.put("strictMode", c.strictMode)
      o.put("exceptions", JSONArray(c.exceptions.map {
        JSONObject().put("appId", it.appId).put("day", it.day).put("extraMinutes", it.extraMinutes)
      }))
      return o.toString()
    }
  }
}
