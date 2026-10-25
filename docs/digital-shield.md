# Digital Shield — protecção de sites

## Como funciona

**Android:** `ShieldVpnService` cria uma VPN local com um único destino (o servidor DNS virtual
`10.111.222.2`). Apenas o tráfego DNS entra na VPN; tudo o resto segue a rede normal.

- Domínios bloqueados (e subdomínios) → resposta `NXDOMAIN`.
- Restantes → reencaminhados para `1.1.1.1` (Cloudflare), ou `1.1.1.3` (Cloudflare for Families)
  quando a categoria «Sites adultos» está activa, alargando muito a cobertura de conteúdo adulto.
- O socket de reencaminhamento é protegido (`VpnService.protect`) para não entrar em ciclo.
- Só é guardada uma contagem diária de bloqueios — nunca os domínios consultados.

**iOS:** `ManagedSettingsStore.webContent.blockedByFilter = .auto(domínios)` (filtro de conteúdos
adultos da Apple + até 50 domínios), após autorização do Tempo de Ecrã.

## Listas

`packages/core/src/shield` inclui listas-semente pequenas por categoria (adultos, apostas, redes
sociais, jogos, streaming) para funcionamento offline e testes. **Em produção** devem ser
complementadas com listas mantidas por terceiros e distribuídas por configuração remota
(trabalho pendente — ver docs/status.md).

## Limitações conhecidas (mostradas ao utilizador)

- Navegadores com «DNS seguro» (DoH) próprio ignoram o DNS do sistema.
- «DNS privado» do Android com um servidor definido manualmente contorna a VPN.
- Só pode existir uma VPN activa: outra VPN desliga o Shield (o serviço regista `shield_revoked`).
- Para maior protecção: «VPN sempre activa» + «Bloquear ligações sem VPN» nas definições do sistema.
- Endereços IP directos e aplicações com DNS próprio não são filtrados.

## Apostas

O aplicativo mostra informação sobre a **autoexclusão no SRIJ** e a **Linha Vida 1414 (ICAD)**.
