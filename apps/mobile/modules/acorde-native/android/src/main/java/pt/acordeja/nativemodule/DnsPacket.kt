package pt.acordeja.nativemodule

/**
 * Manipulação mínima de pacotes IPv4/UDP/DNS para o filtro DNS local.
 * Sem dependências Android para poder ser testado com JUnit.
 */
object DnsPacket {
  data class Query(
    val srcIp: ByteArray,
    val dstIp: ByteArray,
    val srcPort: Int,
    val dstPort: Int,
    /** Payload DNS (sem cabeçalhos IP/UDP). */
    val dns: ByteArray,
    val qname: String,
  )

  /** Extrai uma pergunta DNS de um pacote IPv4/UDP destinado à porta 53; null caso contrário. */
  fun parse(packet: ByteArray, length: Int): Query? {
    if (length < 28) return null
    val version = (packet[0].toInt() shr 4) and 0xF
    if (version != 4) return null
    val ihl = (packet[0].toInt() and 0xF) * 4
    if (packet[9].toInt() != 17) return null // UDP
    if (length < ihl + 8 + 12) return null
    val srcPort = u16(packet, ihl)
    val dstPort = u16(packet, ihl + 2)
    if (dstPort != 53) return null
    val udpLen = u16(packet, ihl + 4)
    val dnsLen = minOf(udpLen - 8, length - ihl - 8)
    if (dnsLen < 12) return null
    val dns = packet.copyOfRange(ihl + 8, ihl + 8 + dnsLen)
    val qname = readQname(dns, 12) ?: return null
    return Query(packet.copyOfRange(12, 16), packet.copyOfRange(16, 20), srcPort, dstPort, dns, qname.first)
  }

  /** Lê um nome DNS não comprimido; devolve (nome, offset seguinte). */
  fun readQname(dns: ByteArray, start: Int): Pair<String, Int>? {
    val labels = mutableListOf<String>()
    var i = start
    while (i < dns.size) {
      val len = dns[i].toInt() and 0xFF
      if (len == 0) return labels.joinToString(".").lowercase() to (i + 1)
      if (len and 0xC0 != 0) return null // compressão não é usada em perguntas
      if (i + 1 + len > dns.size) return null
      labels.add(String(dns, i + 1, len, Charsets.US_ASCII))
      i += 1 + len
    }
    return null
  }

  /** Resposta NXDOMAIN para a pergunta (mantém apenas a secção de pergunta). */
  fun nxdomain(query: ByteArray): ByteArray {
    val end = readQname(query, 12)?.second?.plus(4) ?: 12
    val out = query.copyOfRange(0, minOf(end, query.size))
    val rd = query[2].toInt() and 0x01
    out[2] = (0x80 or rd).toByte() // QR=1, OPCODE=0, AA=0, TC=0, RD copiado
    out[3] = 0x83.toByte() // RA=1, RCODE=3 (NXDOMAIN)
    // QDCOUNT mantém-se; ANCOUNT, NSCOUNT, ARCOUNT = 0
    for (k in 6..11) out[k] = 0
    return out
  }

  /** Constrói um pacote IPv4/UDP de resposta (origem e destino trocados). */
  fun wrapResponse(q: Query, dnsResponse: ByteArray): ByteArray {
    val total = 20 + 8 + dnsResponse.size
    val p = ByteArray(total)
    p[0] = 0x45
    put16(p, 2, total)
    p[6] = 0x40 // Don't fragment
    p[8] = 64 // TTL
    p[9] = 17
    System.arraycopy(q.dstIp, 0, p, 12, 4)
    System.arraycopy(q.srcIp, 0, p, 16, 4)
    put16(p, 10, checksum(p, 0, 20))
    put16(p, 20, q.dstPort)
    put16(p, 22, q.srcPort)
    put16(p, 24, 8 + dnsResponse.size)
    // Checksum UDP opcional em IPv4: 0 = não calculado.
    System.arraycopy(dnsResponse, 0, p, 28, dnsResponse.size)
    return p
  }

  fun checksum(buf: ByteArray, offset: Int, len: Int): Int {
    var sum = 0L
    var i = offset
    while (i < offset + len - 1) {
      sum += u16(buf, i)
      i += 2
    }
    if (len % 2 == 1) sum += (buf[offset + len - 1].toInt() and 0xFF) shl 8
    while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
    return sum.inv().toInt() and 0xFFFF
  }

  fun isBlocked(host: String, domains: Set<String>): Boolean {
    var h = host.trimEnd('.')
    while (true) {
      if (h in domains) return true
      val dot = h.indexOf('.')
      if (dot < 0) return false
      h = h.substring(dot + 1)
    }
  }

  private fun u16(b: ByteArray, i: Int) = ((b[i].toInt() and 0xFF) shl 8) or (b[i + 1].toInt() and 0xFF)
  private fun put16(b: ByteArray, i: Int, v: Int) {
    b[i] = (v shr 8).toByte()
    b[i + 1] = v.toByte()
  }
}
