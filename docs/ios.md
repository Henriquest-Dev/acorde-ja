# iPhone e iPad

## Resposta curta: o bloqueio funciona no iPhone?

| Funcionalidade | iPhone sem conta Apple Developer | iPhone com app nativa (conta Apple Developer, $99/ano) |
|---|---|---|
| Bloquear sites adultos | ✅ perfil DNS (Proteção → iPhone e iPad) | ✅ |
| Bloquear anúncios e rastreadores | ✅ perfil DNS | ✅ |
| Bloquear sites de apostas | ⚠️ só com resolvedor próprio (NextDNS / AdGuard DNS privado) em `EXPO_PUBLIC_IOS_DOH_URL` | ✅ |
| Protecção que não se pode desligar | ⚠️ só em iPhone supervisionado (Apple Configurator) | ⚠️ idem |
| Limites de tempo por app, bloqueio de apps | ❌ | ✅ Screen Time API (FamilyControls) |

A Apple não permite instalar apps fora da App Store/TestFlight sem conta de programador paga
(excepto lojas alternativas na UE). Por isso, sem essa conta, a protecção no iPhone é feita com
um **perfil de configuração DNS-over-HTTPS** (`com.apple.dnsSettings.managed`), gerado pelo offly
(`buildMobileConfig` em `packages/core/src/shield`):

- Funciona em todas as apps e navegadores, sem instalar nada.
- Filtros públicos verificados: AdGuard DNS Family (adultos + anúncios), AdGuard DNS (anúncios),
  Cloudflare for Families (adultos).
- O utilizador pode removê-lo em Definições → Geral → VPN e gestão de dispositivos, a não ser
  que o iPhone esteja supervisionado.
- Instalação: abrir o offly web no Safari do iPhone → Proteção → iPhone e iPad → Gerar perfil;
  ou enviar o ficheiro a partir do Android (AirDrop/e-mail).

## App nativa (Screen Time API) — `modules/acorde-native/ios/AcordeNativeModule.swift`

- `requestFamilyControlsAuthorization()`, `presentAppPicker()` (FamilyActivityPicker),
  `startEnforcement()` (ManagedSettingsStore), `startShield()` (filtro web do sistema).
- Limitações da Apple: o app não lê minutos por aplicação; tokens opacos; limites com contagem
  exigem uma extensão `DeviceActivityMonitor` (planeada).
- Requisitos: conta Apple Developer, entitlement `com.apple.developer.family-controls`
  (Distribution pedido à Apple), iOS 16.4+, compilação em macOS/Xcode ou EAS Build.

> Estado: o código Swift **não foi compilado** neste ambiente (Linux, sem Xcode).
