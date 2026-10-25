# Estado real das funcionalidades

Legenda: ✅ implementado e verificado neste ambiente · 🟡 implementado, verificação parcial ·
⚠️ implementado mas **não compilado/executado** aqui · ⏳ pendente (fase seguinte)

## Verificação executada

| Verificação | Resultado |
|---|---|
| `packages/core` — Vitest | ✅ 55 testes (inclui desafio: calendário, recompensas, sequências) (motor de regras, horários nocturnos, excepções, relógio/fuso, reinício, sync offline/backoff/dead-letter/idempotência, temporizador em segundo plano, Pomodoro, hábitos, relatórios, CSV, Digital Shield) |
| `apps/mobile` — Jest | ✅ 6 testes (componentes do design system, honestidade dos dados sem permissão, mapeamento de pacotes Android) |
| `tests/functions` — Vitest | ✅ 5 testes (detecção de crise com acentos, cartões, contexto agregado, regras do prompt) |
| Migrações + RLS em PostgreSQL 16 real | ✅ 28 testes (`npm run test:db`) |
| TypeScript (`tsc --noEmit`) — core e mobile | ✅ sem erros |
| Edge Function `assistant` — tipos contra `@anthropic-ai/sdk@1.3.0` | ✅ sem erros |
| Aplicativo na web (Playwright, 390×844) | ✅ os 15 ecrãs da imagem renderizam; capturas em `docs/screenshots/` |
| Kotlin — JUnit (`:acorde-native:testDebugUnitTest`) | ✅ 12 testes (inclui seguimento por actividade — caso YouTube/Shorts — (parser/resposta DNS, correspondência de subdomínios, limiares, excepções, horários nocturnos, serialização) |
| Compilação Android (`:app:assembleDebug`, arm64-v8a) | ✅ `BUILD SUCCESSFUL` — APK de debug gerado; manifesto final verificado (usage stats, overlay, FGS specialUse, VPN, receiver) |
| `expo lint` | ✅ 0 erros (1 aviso informativo do React Compiler sobre react-hook-form) |
| Compilação iOS | ⚠️ impossível neste ambiente (Linux, sem Xcode) |

## Ecrãs da imagem de referência

| Ecrã | Estado |
|---|---|
| Onboarding 1 — Boas-vindas | ✅ |
| Onboarding 2 — Objetivos | ✅ (escolha múltipla persistida) |
| Onboarding 3 — Limites (110 min) | ✅ editáveis, persistidos e enviados ao serviço nativo |
| Permissões necessárias | ✅ estado real do sistema, nunca simulado |
| Conclusão — Está tudo pronto | ✅ com resumo real (texto adapta-se se faltarem permissões) |
| Dashboard | ✅ dados reais (Android) · estado explicativo sem permissão / web / iOS |
| Bloqueio activo — Limite atingido | ✅ + ecrã nativo por sobreposição no Android ⚠️ |
| Aviso de limite 80% | ✅ + notificação nativa ⚠️ |
| Modo Foco | ✅ temporizador por timestamps, Pomodoro, restrição de apps, notas |
| Assistente IA | ✅ UI, consentimento, modo offline · resposta do modelo requer Supabase + chave |
| Proteção | ✅ toggles, modo restrito com pausa, horário, diagnóstico |
| Relatórios | ✅ dia/semana/mês, comparação, gráfico interactivo, CSV/PDF |
| Hábitos | ✅ criar/editar/frequência/lembretes/calendário/arquivar |
| Família | 🟡 RPCs e RLS testados; UI requer Supabase configurado |
| Configurações | ✅ todas as entradas com ecrã funcional |

## Android (Kotlin)

Implementado: `UsageCalculator`, `EnforcementService` (foreground `specialUse`), `BlockOverlay`,
`ShieldVpnService` (DNS), `SystemEventsReceiver`, `RuleStore`, `RuleEvaluator`, `Notifier`,
`AcordeNativeModule` (API tipada). Compila e está incluído no APK de debug (ver tabela acima).

Nota de ambiente: neste ambiente de CI o Maven Central devolvia HTTP 429; foi usado localmente um
*init script* do Gradle (fora do repositório) que aponta para o espelho oficial do Maven Central
no Google Cloud Storage. Não é necessário em máquinas normais.

Não testado em dispositivo real neste ambiente: medição, sobreposição, VPN e notificações nativas
exigem um telemóvel/emulador. Testes manuais recomendados: aplicação fechada, reinício do
dispositivo, permissão revogada, alteração de hora/fuso, duas apps em sequência, limite atingido
durante a sessão, pedido de tempo extra.

## Versão 0.1.1 — correcções após teste em telemóvel

- Limites contam só a partir do momento em que foram configurados (o uso anterior à instalação já não esgota o limite).
- Bloqueio persistente: ao abrir uma app bloqueada, o ecrã de bloqueio cobre tudo e a app é enviada para segundo plano (o vídeo pára); fica até o utilizador escolher uma opção.
- Corrigido: Shorts do YouTube visíveis por baixo do bloqueio (o serviço passou a seguir cada actividade, não só o pacote).
- Desafio (pornografia/apostas) com data-limite, check-in diário, calendário de recompensas e protecção trancada; a VPN é religada se for desligada durante o desafio.
- Micro-animações (toque, entradas em cascata, números a contar, separadores), gráfico hora-a-hora em tempo real e ecrã de bloqueio animado.
- Android 13+: ajuda para desbloquear «definições restritas» em APKs.

## Pendente (fases seguintes)

- ⏳ Fase 4: subscrições (Google Play Billing / StoreKit + webhooks + entitlements), painel
  administrativo Next.js (o esquema, `admin_metrics()` e as políticas já existem).
- ⏳ Fase 5: extensão iOS `DeviceActivityMonitor`; pedido de tempo extra do menor a partir do
  ecrã de bloqueio (RPC `request_extra_time` já existe e está testada); ecrã de parceiro de
  responsabilidade (RPCs `accept_accountability`/`revoke_accountability` testadas).
- ⏳ Listas de domínios mantidas por terceiros via configuração remota.
- ⏳ Sons opcionais no modo foco; programas de recuperação (tabelas prontas, sem UI).
- ⏳ Testes E2E em dispositivo (Maestro/Detox) e de notificações reais.
