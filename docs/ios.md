# iOS — Screen Time API

## O que está implementado (`modules/acorde-native/ios/AcordeNativeModule.swift`)

- `requestFamilyControlsAuthorization()` — `AuthorizationCenter.requestAuthorization(for: .individual)`.
- `getPermissionStatus()` / `getNativeCapabilities()` — estado real da autorização.
- `presentAppPicker()` — `FamilyActivityPicker` (SwiftUI) apresentado a partir do React Native; a
  selecção é guardada com `PropertyListEncoder` em `UserDefaults`.
- `startEnforcement()` / `stopEnforcement()` — escudo `ManagedSettingsStore` sobre as aplicações,
  categorias e domínios seleccionados (usado no modo foco e nos horários).
- `startShield()` / `stopShield()` — filtro web `.auto(...)` do sistema.

## Limitações impostas pela Apple

- **Sem minutos por aplicação**: o aplicativo não pode ler tempos de utilização; só uma extensão
  `DeviceActivityReport` pode mostrá-los, dentro da sua própria vista. O dashboard iOS mostra um
  estado explicativo, nunca valores estimados.
- **Tokens opacos**: as aplicações escolhidas não têm nome nem bundle id acessíveis.
- **Limites com contagem**: exigem uma extensão `DeviceActivityMonitor` (alvo separado) que aplica
  o escudo ao atingir o limiar `DeviceActivityEvent`. Planeado para a Fase 5 (requer config plugin
  para criar o alvo da extensão e um App Group partilhado).

## Requisitos para compilar/publicar

1. Entitlement `com.apple.developer.family-controls` (já declarado em `app.json`) — pedir a versão
   *Distribution* à Apple.
2. iOS 16.4+.
3. `npx expo prebuild -p ios && npx pod-install`, depois compilar no Xcode.

> Estado: o código Swift **não foi compilado** neste ambiente (Linux, sem Xcode). Ver docs/status.md.
