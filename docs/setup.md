# Instalação e configuração

## Requisitos

- Node.js ≥ 20 (testado com 22) e npm 10
- Android: JDK 17+, Android SDK (platform 37, build-tools 37), NDK 27.1 para builds completos
- iOS: macOS com Xcode 26+, conta Apple Developer **com o entitlement Family Controls aprovado**
- Supabase CLI (para servidor local ou deploy das migrações e funções)

## Aplicativo móvel

```bash
npm install
cd apps/mobile
cp .env.example .env.local      # opcional: preencher para activar contas/sincronização/IA
npx expo run:android            # development build (o módulo nativo não existe no Expo Go)
```

Sem `.env.local`, o aplicativo funciona **apenas localmente** (offline-first): limites, medição real no
Android, bloqueio, foco, hábitos e relatórios. Conta, sincronização, família e assistente IA ficam
indisponíveis e o aplicativo explica porquê.

### Variáveis públicas (`apps/mobile/.env.local`)

| Variável | Descrição |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projecto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon). Segura no cliente graças às políticas RLS |

Nunca colocar no aplicativo a `service_role` key nem chaves de modelos de IA.

## Supabase

```bash
supabase link --project-ref <ref>
supabase db push                                   # aplica supabase/migrations
supabase secrets set ANTHROPIC_API_KEY=...          # só no servidor
supabase secrets set AI_DAILY_MESSAGE_LIMIT=40
supabase secrets set AI_REQUIRE_ENTITLEMENT=false   # true quando as subscrições estiverem activas
supabase functions deploy assistant
supabase functions deploy delete-account
```

Em **Authentication → URL configuration**, adicionar `acordeja://auth/callback` aos redirect URLs.
Login Google/Apple: activar os providers no painel do Supabase (o botão existe no aplicativo e
mostra um erro explícito enquanto não estiver configurado).

Para administradores: inserir o `user_id` em `public.admin_users` (papel `owner`, `support` ou `analyst`).

## Testes

```bash
npm test                 # Vitest (core + funções) e Jest (mobile)
npm run test:db          # migrações + 28 testes de RLS num PostgreSQL 16 temporário
```

## Publicação

- Android: `npx eas-cli@latest build -p android --profile production`. Na Play Console é necessário
  declarar: permissão `PACKAGE_USAGE_STATS` (bem-estar digital), serviço em primeiro plano
  `specialUse`, `SYSTEM_ALERT_WINDOW` e `VpnService` (formulário de declaração de VPN, com a
  justificação de filtragem local de DNS sem envio de tráfego para servidores próprios).
- iOS: pedir o entitlement *Family Controls (Distribution)* à Apple antes de submeter.

## Supabase do offly (projecto ecqtiefjnpeqmwjuldre)

O app já aponta para o projecto (URL e chave pública em `apps/mobile/.env.local`, que não vai para o Git).

Para criar o esquema num projecto vazio, há duas formas:

1. **SQL Editor (mais simples):** Dashboard → SQL Editor → New query → colar o conteúdo de `supabase/setup.sql`
   → Run, uma única vez. Cria todas as tabelas, índices, políticas de RLS e funções (incluindo a conta família).
2. **Management API:** com um token pessoal (`sbp_...`, criado em supabase.com/dashboard/account/tokens) é possível
   aplicar as migrações a partir de uma sessão do Claude Code.

Depois, em Authentication → URL Configuration, acrescentar `acordeja://auth/callback` às Redirect URLs.
`supabase/setup.sql` é gerado a partir de `supabase/migrations/` e não deve ser editado à mão.

## Assistente (OpenRouter)

- `supabase/functions/assistant`: conversa com `nvidia/nemotron-3.5-super-vl:free`.
- `supabase/functions/coach`: `decide` (tempo extra, `parallel/decisions-fast:free`) e `speak` (voz, `fish-audio/s2.1-pro-free:free`, MP3).
- Segredo obrigatório no Supabase: `OPENROUTER_API_KEY` (Dashboard → Edge Functions → Secrets). Nunca no app.

## Publicar as Edge Functions

As funções vivem em `supabase/functions/` (`assistant`, `coach`, `delete-account`, `billing-webhook`; `_shared` é
código comum e não se publica sozinho). Enquanto não forem publicadas, o app responde "assistente indisponível" e
tudo o resto (bloqueio, limites, foco, relógio, respiração, sons) continua a funcionar offline.

### 1. Guardar os segredos (uma vez)

Dashboard → **Edge Functions** → **Secrets** → **Add new secret**:

| Nome | Valor | Obrigatório |
|---|---|---|
| `OPENROUTER_API_KEY` | a chave do OpenRouter (criar uma nova; a que passou no chat deve ser revogada) | sim |
| `AI_DAILY_MESSAGE_LIMIT` | mensagens por dia e por pessoa (ex.: `40`) | não |
| `AI_REQUIRE_ENTITLEMENT` | `false` na fase de testes (sem paywall) | não |
| `BILLING_WEBHOOK_SECRET` | só quando houver pagamentos | não |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem em todas as funções; não é preciso criá-los.

### 2. Publicar (no computador, com a CLI)

```bash
npm i -g supabase            # ou: brew install supabase/tap/supabase
supabase login               # abre o browser e guarda o token
cd acorde-ja                 # raiz do repositório
supabase functions deploy assistant coach delete-account --project-ref ecqtiefjnpeqmwjuldre
supabase functions deploy billing-webhook --no-verify-jwt --project-ref ecqtiefjnpeqmwjuldre
```

- `billing-webhook` usa `--no-verify-jwt` porque é chamado pelo fornecedor de pagamentos (valida a assinatura própria).
- As outras exigem a sessão do utilizador (JWT), por isso só quem tem conta as pode usar.
- Não é preciso Docker para publicar.

### 3. Confirmar

Dashboard → Edge Functions: as quatro aparecem com estado **Active**. No app: Assistente → escrever uma mensagem;
Configurações → Assistente e voz → **Ouvir um exemplo**. Os registos de erros ficam em Edge Functions → *função* → **Logs**.

**Alternativa sem computador:** criar um token pessoal em supabase.com/dashboard/account/tokens (começa por `sbp_`)
e guardá-lo como credencial da sessão do Claude Code para `api.supabase.com`; a publicação passa a ser feita daqui.
