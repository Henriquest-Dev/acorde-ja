# Arquitectura

## Visão geral

```
┌──────────────────── Aplicativo (React Native / Expo) ────────────────────┐
│ Ecrãs (Expo Router) → hooks (TanStack Query) → repositórios (SQLite)     │
│                    ↘ stores (Zustand: preferências, temporizador)        │
│ @acorde/core: motor de regras, fila de sync, temporizador, relatórios    │
│ src/native/device.ts → módulo AcordeNative                               │
└───────────────┬───────────────────────────────┬──────────────────────────┘
                │ Kotlin (Android)              │ Swift (iOS)
   UsageStatsManager · EnforcementService   FamilyControls · ManagedSettings
   BlockOverlay · ShieldVpnService (DNS)    FamilyActivityPicker
                │
                ▼ (opcional, com consentimento)
        Supabase: Auth · PostgreSQL + RLS · Edge Functions (IA)
```

## Offline-first

- Toda a informação vive primeiro em **SQLite** (`apps/mobile/src/database/migrations.ts`), com
  migrações versionadas por `PRAGMA user_version`.
- As alterações sincronizáveis entram numa **fila persistente** (`sync_queue`) com id único por
  operação (idempotência via `client_event_id` / chaves únicas no servidor), backoff exponencial
  com jitter, fusão de upserts sobre a mesma linha e *dead letter* após 8 tentativas.
- A fila é processada ao abrir o aplicativo, ao voltar ao primeiro plano e ao recuperar a ligação.
- Conflitos de entidades mutáveis: last-writer-wins por `updated_at` (tombstones vencem empates).
- Dados sensíveis (hábitos, recuperação) exigem um consentimento específico (`syncSensitive`).

## Motor de regras

`packages/core/src/rules/engine.ts` — determinístico, sem IA. Estados: `AVAILABLE`, `WARNING` (80%),
`BLOCKED` (100%), `TEMPORARY_EXCEPTION`, `SCHEDULED_BLOCK`, `PERMISSION_REQUIRED`, `UNAVAILABLE`.

O mesmo algoritmo está espelhado em Kotlin (`RuleEvaluator.kt`) para funcionar **com o aplicativo
fechado**. O JS envia a configuração completa ao nativo (`setRuleConfig`) sempre que algo muda.

- Reinício diário à meia-noite local (chave do dia = data local).
- Alterações de relógio/fuso: detectadas por comparação com o relógio monotónico e pelos
  broadcasts `TIME_SET`/`TIMEZONE_CHANGED`; ficam registadas e a cache é recalculada.
- Excepções: pausa consciente (30 s por defeito), motivo obrigatório, +5 min, máximo diário,
  bloqueadas em modo estrito e durante horários de bloqueio.
- A IA **não** altera limites: não existe nenhum caminho de código entre a Edge Function e as regras.

## Android

| Peça | Função |
|---|---|
| `UsageCalculator` | Soma o tempo em primeiro plano a partir de `UsageEvents` (respeita a meia-noite local, exclui launchers) |
| `EnforcementService` | Serviço em primeiro plano `specialUse`: a cada 2 s identifica a app em primeiro plano, notifica nas transições e mostra o bloqueio |
| `BlockOverlay` | Ecrã de bloqueio monocromático por `TYPE_APPLICATION_OVERLAY`; o utilizador pode sempre ir ao ecrã inicial |
| `ShieldVpnService` | VPN local que só encaminha DNS: NXDOMAIN para domínios bloqueados, restante reencaminhado; contagem diária agregada |
| `SystemEventsReceiver` | Reinício do dispositivo, actualização da app, hora e fuso horário |

Não se usa `AccessibilityService` nem técnicas ocultas.

## iOS

`AcordeNativeModule.swift`: autorização FamilyControls, `FamilyActivityPicker`, escudo
`ManagedSettings` e filtro web. A Apple não expõe minutos por aplicação ao aplicativo, por isso o
dashboard iOS mostra o estado explicativo em vez de números. Limites com contagem de tempo exigem
uma extensão `DeviceActivityMonitor` (Fase 5).

## Backend

- Migrações: `supabase/migrations` (25 tabelas + `admin_users`), RLS em todas as tabelas.
- Encarregados de família só lêem a vista agregada `family_usage_daily` (total diário).
- Administradores lêem métricas agregadas (`admin_metrics()`), suporte e subscrições — nunca
  conversas, hábitos ou utilização individual.
- Retenção: `purge_expired_data()` (mensagens IA 90 dias, utilização 13 meses), agendada com pg_cron.
