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
