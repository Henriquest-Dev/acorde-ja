# Pagamentos com gateway externo

O offly **não depende** da Google Play, da App Store nem do RevenueCat. Qualquer gateway
(Stripe, Paddle, Lemon Squeezy, Mercado Pago, Hotmart, Kiwify, PayPal, um sistema próprio…)
serve, desde que, quando um pagamento muda de estado, alguém envie um evento para o offly.

```
App ──(abre)──▶ EXPO_PUBLIC_CHECKOUT_URL?plan=pro&product=offly_pro_yearly&uid=<user id>&client_reference_id=<user id>&email=…
                          │ cliente paga
Gateway ──webhook──▶ a sua automação (n8n / Make / Zapier / função) ──▶ POST /functions/v1/billing-webhook
                                                                         │ verifica HMAC, idempotente
                                                       Supabase: subscriptions + entitlements
App ◀── my_entitlements() (ecrã Planos, «Restaurar compras»)
```

## Configuração

1. `supabase secrets set BILLING_WEBHOOK_SECRET=<segredo longo e aleatório>`
2. `supabase functions deploy billing-webhook --no-verify-jwt` (o webhook autentica-se pela assinatura).
3. No app (`apps/mobile/.env.local`): `EXPO_PUBLIC_CHECKOUT_URL` (página de pagamento) e,
   opcionalmente, `EXPO_PUBLIC_BILLING_PORTAL_URL` (gerir/cancelar).
4. No gateway, guarde o `uid` recebido no checkout (metadados / referência do cliente) para o
   devolver no evento.

Sem `EXPO_PUBLIC_CHECKOUT_URL`, o ecrã Planos mostra os preços mas a compra é recusada com uma
mensagem clara. Nada é desbloqueado sem um evento verificado.

## Contrato do evento

`POST https://<projeto>.supabase.co/functions/v1/billing-webhook`

Cabeçalho: `X-Offly-Signature: t=<unix segundos>,v1=<hex HMAC-SHA256(segredo, "<t>.<corpo>")>`
(recusado se tiver mais de 5 minutos).

```json
{
  "id": "evt_123",                       // id único do evento no gateway (idempotência)
  "type": "subscription.activated",
  "user_id": "9b1c…-uuid do utilizador",  // o uid enviado no checkout
  "product_id": "offly_pro_yearly",
  "subscription_id": "sub_abc",           // id da subscrição no gateway (opcional)
  "current_period_end": "2027-11-07T00:00:00Z",
  "provider": "stripe"                    // opcional, para auditoria
}
```

| type | efeito |
|---|---|
| `subscription.activated` / `renewed` / `updated` | activa e estende o acesso até `current_period_end` |
| `subscription.canceled` | renovação desligada; acesso mantém-se até ao fim do período pago |
| `subscription.expired` / `payment.refunded` | retira o acesso |
| `lifetime.purchased` | acesso sem data de fim |

Produtos: `offly_pro_monthly`, `offly_pro_yearly`, `offly_pro_ai_monthly`, `offly_pro_ai_yearly`,
`offly_family_yearly`, `offly_pro_lifetime`. Respostas: `200 {"result":"applied"|"duplicate"|"ignored"}`,
`401` assinatura inválida, `400` evento inválido, `500` erro (o gateway deve repetir).

Exemplo de assinatura (Node / n8n «Code»):

```js
const t = Math.floor(Date.now() / 1000);
const body = JSON.stringify(event);
const v1 = require('crypto').createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
headers['X-Offly-Signature'] = `t=${t},v1=${v1}`;
```

## Regras das lojas

Fora das lojas (APK directo, web) pode usar qualquer gateway. Se um dia publicar na Google Play
ou na App Store, as regras dessas lojas para bens digitais aplicam-se e o fluxo terá de ser revisto.
