# Acorde Já

**Menos tela. Mais vida.**

Plataforma de bem-estar digital para recuperar o controlo do tempo: limites diários por aplicação,
bloqueio aos 100% com pausa consciente, protecção voluntária contra sites (pornografia, apostas),
modo foco, hábitos, relatórios com dados reais, assistente IA, família e parceiros de responsabilidade.

> O Acorde Já é uma ferramenta de autocontrolo e apoio. **Não é** tratamento médico ou psicológico.

## Estrutura

```
acorde-ja/
├── apps/mobile/            Aplicativo React Native (Expo SDK 58, Expo Router, TypeScript)
│   ├── src/app/            Rotas (ecrãs)
│   ├── src/components/     Design system Black & White
│   ├── src/features/       Lógica por funcionalidade (onboarding, limites, hábitos…)
│   ├── src/database/       SQLite local + migrações
│   ├── src/repositories/   Acesso a dados locais
│   ├── src/services/       Supabase, sincronização, notificações, IA
│   ├── src/native/         Adaptador de plataforma (Android / iOS / web)
│   └── modules/acorde-native/  Módulo nativo próprio (Kotlin + Swift)
├── packages/core/          Lógica de domínio partilhada e testada (motor de regras, sync, foco…)
├── supabase/migrations/    Esquema PostgreSQL, RLS, RPCs, retenção
├── supabase/functions/     Edge Functions (assistente IA, eliminação de conta)
├── supabase/tests/         Testes de RLS (PostgreSQL real)
├── tests/functions/        Testes da lógica das Edge Functions
├── scripts/test-db.sh      Corre migrações + testes de RLS num PostgreSQL temporário
└── docs/                   Arquitectura, plataformas, privacidade, estado das funcionalidades
```

## Começar

```bash
npm install                      # na raiz (npm workspaces)
npm test                         # core (Vitest) + mobile (Jest) + funções
npm run test:db                  # migrações + RLS num PostgreSQL local (requer binários do Postgres)
npm run typecheck

cd apps/mobile
npx expo start --web             # pré-visualização web (sem medição/bloqueio — limitação da web)
npx expo run:android             # development build Android (necessário para o módulo nativo)
```

Configuração de ambiente: ver [docs/setup.md](docs/setup.md).
Estado real de cada funcionalidade e limitações: [docs/status.md](docs/status.md).
