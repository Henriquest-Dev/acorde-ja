package pt.acordeja.nativemodule

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsPacketTest {
  /** Pacote IPv4/UDP com uma pergunta DNS A para `host`. */
  private fun query(host: String, dstPort: Int = 53): ByteArray {
    val qname = host.split(".").flatMap { listOf(it.length.toByte()) + it.toByteArray().toList() } + listOf(0.toByte())
    val dns = byteArrayOf(0x12, 0x34, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0) + qname.toByteArray() + byteArrayOf(0, 1, 0, 1)
    val total = 20 + 8 + dns.size
    val p = ByteArray(total)
    p[0] = 0x45
    p[2] = (total shr 8).toByte(); p[3] = total.toByte()
    p[9] = 17
    byteArrayOf(10, 111, 222.toByte(), 1).copyInto(p, 12)
    byteArrayOf(10, 111, 222.toByte(), 2).copyInto(p, 16)
    p[20] = (40000 shr 8).toByte(); p[21] = 40000.toByte()
    p[22] = (dstPort shr 8).toByte(); p[23] = dstPort.toByte()
    val udpLen = 8 + dns.size
    p[24] = (udpLen shr 8).toByte(); p[25] = udpLen.toByte()
    dns.copyInto(p, 28)
    return p
  }

  @Test fun parsesQuestionName() {
    val q = DnsPacket.parse(query("www.Bet365.com").let { it }, query("www.Bet365.com").size)
    assertNotNull(q)
    assertEquals("www.bet365.com", q!!.qname)
    assertEquals(40000, q.srcPort)
  }

  @Test fun ignoresNonDnsTraffic() {
    val p = query("example.com", dstPort = 443)
    assertNull(DnsPacket.parse(p, p.size))
  }

  @Test fun matchesSubdomainsOnly() {
    val blocked = setOf("bet365.com")
    assertTrue(DnsPacket.isBlocked("sports.bet365.com", blocked))
    assertTrue(DnsPacket.isBlocked("bet365.com.", blocked))
    assertFalse(DnsPacket.isBlocked("notbet365.com", blocked))
  }

  @Test fun buildsNxdomainResponse() {
    val p = query("pornhub.com")
    val q = DnsPacket.parse(p, p.size)!!
    val resp = DnsPacket.nxdomain(q.dns)
    assertEquals(0x12.toByte(), resp[0]) // mesmo id
    assertEquals(0x81.toByte(), resp[2]) // QR=1, RD=1
    assertEquals(0x83.toByte(), resp[3]) // RA=1, NXDOMAIN
    val packet = DnsPacket.wrapResponse(q, resp)
    assertEquals(0, DnsPacket.checksum(packet, 0, 20)) // checksum IP válido
    assertEquals(53, ((packet[20].toInt() and 0xFF) shl 8) or (packet[21].toInt() and 0xFF)) // porta origem = 53
  }
}
