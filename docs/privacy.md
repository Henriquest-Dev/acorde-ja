# Privacidade e dados

## Princípios

1. **Local por defeito.** Sem conta, nada sai do dispositivo.
2. **Consentimento por finalidade**, registado em `consent_records` (append-only):
   `cloudSync`, `syncSensitive`, `aiConsent`, `aiMemory`, `family`, `accountability`.
3. **Minimização.** Não recolhemos conteúdo de mensagens, palavras-passe, dados financeiros, nem
   histórico de navegação. O Digital Shield guarda apenas a *contagem diária* de bloqueios.
4. **Separação.** Dados comportamentais sensíveis (hábitos, recuperação, conversas IA) estão em
   tabelas próprias, fora do alcance do painel administrativo (verificado nos testes de RLS).

## O que é enviado ao assistente IA

O texto da mensagem, os últimos 12 turnos da mesma conversa, os objectivos escolhidos e os minutos
de hoje (agregados). Nunca listas de sites, aplicações instaladas, contactos ou localização.

## Retenção

| Dados | Retenção |
|---|---|
| Mensagens do assistente (servidor) | 90 dias |
| Utilização diária e eventos de bloqueio (servidor) | 13 meses |
| Notificações | 90 dias |
| Registos de auditoria | 2 anos |
| Dados locais | Até o utilizador os apagar (Configurações → Privacidade) |

## Direitos

- Exportar: Configurações → Privacidade → Exportar (CSV) e Relatórios → CSV/PDF.
- Apagar dados locais: Configurações → Privacidade → Apagar dados do dispositivo.
- Eliminar conta: Edge Function `delete-account`; todas as tabelas usam `ON DELETE CASCADE`
  (verificado em `supabase/tests/rls.test.sql`, teste 12).
