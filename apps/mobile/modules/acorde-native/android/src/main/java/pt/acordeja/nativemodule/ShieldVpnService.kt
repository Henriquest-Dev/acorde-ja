package pt.acordeja.nativemodule

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.Executors

/**
 * Digital Shield: VPN local que encaminha APENAS o tráfego DNS do sistema.
 *
 * - Nenhum outro tráfego passa pela VPN (só a rota para o servidor DNS virtual).
 * - Domínios bloqueados recebem NXDOMAIN; os restantes são reencaminhados.
 * - Não regista domínios visitados: guarda apenas a contagem diária agregada.
 *
 * Limitações (documentadas em docs/digital-shield.md): «DNS privado» no modo
 * estrito, DNS-over-HTTPS nos navegadores e outras VPNs contornam o filtro.
 */
class ShieldVpnService : VpnService() {
  private var tun: ParcelFileDescriptor? = null
  @Volatile private var running = false
  private var reader: Thread? = null
  private val pool = Executors.newFixedThreadPool(4)
  private lateinit var store: RuleStore
  @Volatile private var blocked: Set<String> = emptySet()

  override fun onCreate() {
    super.onCreate()
    store = RuleStore(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      shutdown()
      stopSelf()
      return START_NOT_STICKY
    }
    blocked = store.shieldDomains.toHashSet()
    if (!running) establish()
    return START_STICKY
  }

  private fun establish() {
    try {
      val builder = Builder()
        .setSession("Acorde Já — Proteção")
        .addAddress(TUN_ADDRESS, 32)
        .addDnsServer(DNS_ADDRESS)
        .addRoute(DNS_ADDRESS, 32)
        .setBlocking(true)
        .setConfigureIntent(Notifier.deepLink(this, "protection"))
      tun = builder.establish() ?: throw IllegalStateException("VPN não autorizada")
      running = true
      isRunning = true
      store.shieldLastError = null
      reader = Thread(::readLoop, "acorde-shield").also { it.start() }
    } catch (e: Exception) {
      store.shieldLastError = e.message
      running = false
    }
  }

  private fun readLoop() {
    val fd = tun ?: return
    val input = FileInputStream(fd.fileDescriptor)
    val output = FileOutputStream(fd.fileDescriptor)
    val buffer = ByteArray(32767)
    while (running) {
      val len = try {
        input.read(buffer)
      } catch (_: Exception) {
        break
      }
      if (len <= 0) continue
      val query = DnsPacket.parse(buffer, len) ?: continue
      if (DnsPacket.isBlocked(query.qname, blocked)) {
        store.incrementShieldBlocked()
        write(output, DnsPacket.wrapResponse(query, DnsPacket.nxdomain(query.dns)))
        continue
      }
      pool.execute { forward(query, output) }
    }
  }

  private fun forward(query: DnsPacket.Query, output: FileOutputStream) {
    try {
      DatagramSocket().use { socket ->
        protect(socket) // o socket sai fora da VPN
        socket.soTimeout = 5_000
        val upstream = InetAddress.getByName(store.shieldUpstream)
        socket.send(DatagramPacket(query.dns, query.dns.size, upstream, 53))
        val buf = ByteArray(4096)
        val response = DatagramPacket(buf, buf.size)
        socket.receive(response)
        write(output, DnsPacket.wrapResponse(query, buf.copyOf(response.length)))
      }
    } catch (_: Exception) {
      // Sem resposta: o resolvedor do sistema volta a tentar.
    }
  }

  @Synchronized
  private fun write(output: FileOutputStream, packet: ByteArray) {
    runCatching { output.write(packet) }
  }

  private fun shutdown() {
    running = false
    isRunning = false
    runCatching { tun?.close() }
    tun = null
    reader?.interrupt()
  }

  override fun onRevoke() {
    // O utilizador desligou a VPN nas definições do sistema: respeitamos e registamos.
    store.appendEvent("shield_revoked", null)
    store.shieldEnabled = false
    shutdown()
    super.onRevoke()
  }

  override fun onDestroy() {
    shutdown()
    pool.shutdownNow()
    super.onDestroy()
  }

  companion object {
    @Volatile var isRunning = false
      internal set
    const val ACTION_STOP = "pt.acordeja.SHIELD_STOP"
    private const val TUN_ADDRESS = "10.111.222.1"
    private const val DNS_ADDRESS = "10.111.222.2"

    fun start(context: Context): Boolean = runCatching {
      context.startService(Intent(context, ShieldVpnService::class.java))
      true
    }.getOrDefault(false)

    fun stop(context: Context) {
      context.startService(Intent(context, ShieldVpnService::class.java).setAction(ACTION_STOP))
    }
  }
}
