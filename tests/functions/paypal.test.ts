import { describe, expect, it } from 'vitest';
import { decide, PAYPAL_PLANS, planMatches, subscriptionIdFromEvent, verifyWebhook, type PaypalSubscription } from '../../supabase/functions/_shared/paypal';

const USER = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-2222-3333-4444-555555555555';
const NOW = Date.parse('2026-12-01T12:00:00Z');
const MONTHLY = PAYPAL_PLANS.find((p) => p.productId === 'offly_pro_monthly')!;
const YEARLY = PAYPAL_PLANS.find((p) => p.productId === 'offly_pro_yearly')!;

const sub = (over: Partial<PaypalSubscription> = {}, bi: PaypalSubscription['billing_info'] = {}): PaypalSubscription => ({
  id: 'I-ABC123456789',
  status: 'ACTIVE',
  plan_id: MONTHLY.planId,
  custom_id: USER,
  start_time: '2026-11-30T10:00:00Z',
  subscriber: { payer_id: 'PAYER1' },
  billing_info: {
    last_payment: { amount: { value: '3.99', currency_code: 'USD' }, time: '2026-11-30T10:01:00Z' },
    next_billing_time: '2026-12-30T10:00:00Z',
    cycle_executions: [{ tenure_type: 'REGULAR', cycles_completed: 1 }],
    ...bi,
  },
  ...over,
});

describe('PayPal: decisão de acesso (anti-fraude)', () => {
  it('pagamento real dá acesso até ao fim do mês pago + 3 dias', () => {
    const d = decide(sub(), USER, NOW);
    expect(d).toMatchObject({ kind: 'grant', status: 'active', trial: false, periodEnd: '2027-01-02T10:01:00.000Z' });
  });

  it('subscrição de outra conta não desbloqueia nada', () => {
    expect(decide(sub(), OTHER, NOW)).toEqual({ kind: 'none', reason: 'user_mismatch' });
    expect(decide(sub({ custom_id: undefined }), USER, NOW)).toEqual({ kind: 'none', reason: 'no_custom_id' });
  });

  it('plano desconhecido (ex.: criado por terceiros a 0,01 $) é ignorado', () => {
    expect(decide(sub({ plan_id: 'P-FAKE' }), USER, NOW)).toEqual({ kind: 'none', reason: 'unknown_plan' });
  });

  it('aprovado mas ainda não activo, ou sem pagamento, não dá acesso', () => {
    expect(decide(sub({ status: 'APPROVAL_PENDING' }), USER, NOW).kind).toBe('none');
    expect(decide(sub({ status: 'APPROVED' }), USER, NOW).kind).toBe('none');
    expect(decide(sub({}, { last_payment: undefined }), USER, NOW)).toEqual({ kind: 'none', reason: 'not_paid' });
  });

  it('pagamento abaixo do preço ou noutra moeda não conta', () => {
    expect(decide(sub({}, { last_payment: { amount: { value: '0.50', currency_code: 'USD' }, time: '2026-11-30T10:01:00Z' } }), USER, NOW).kind).toBe('none');
    expect(decide(sub({}, { last_payment: { amount: { value: '3.99', currency_code: 'BRL' }, time: '2026-11-30T10:01:00Z' } }), USER, NOW).kind).toBe('none');
  });

  it('suspensa ou expirada retira o acesso', () => {
    expect(decide(sub({ status: 'SUSPENDED' }), USER, NOW)).toMatchObject({ kind: 'revoke' });
    expect(decide(sub({ status: 'EXPIRED' }), USER, NOW)).toMatchObject({ kind: 'revoke' });
  });

  it('cancelada mantém só o período já pago', () => {
    expect(decide(sub({ status: 'CANCELLED' }), USER, NOW)).toMatchObject({ kind: 'grant', status: 'canceled' });
    expect(decide(sub({ status: 'CANCELLED' }), USER, Date.parse('2027-01-03T00:00:00Z'))).toMatchObject({ kind: 'revoke' });
  });

  it('se a renovação não for paga, o acesso acaba sozinho (mesmo sem webhook)', () => {
    expect(decide(sub(), USER, Date.parse('2027-01-02T10:00:00Z')).kind).toBe('grant');
    expect(decide(sub(), USER, Date.parse('2027-01-02T10:02:00Z'))).toMatchObject({ kind: 'revoke', reason: 'period_over' });
  });

  it('teste grátis só no plano anual e no máximo 8 dias', () => {
    const trial = sub({ plan_id: YEARLY.planId }, { last_payment: undefined, next_billing_time: '2026-12-07T10:00:00Z', cycle_executions: [{ tenure_type: 'TRIAL', cycles_completed: 1 }, { tenure_type: 'REGULAR', cycles_completed: 0 }] });
    expect(decide(trial, USER, NOW)).toMatchObject({ kind: 'grant', trial: true, periodEnd: '2026-12-07T10:00:00.000Z' });
    // next_billing_time adulterado/longe: limitado a 7+1 dias.
    const far = { ...trial, billing_info: { ...trial.billing_info, next_billing_time: '2027-06-01T00:00:00Z' } };
    expect(decide(far, USER, NOW)).toMatchObject({ periodEnd: '2026-12-08T10:00:00.000Z' });
    // plano mensal não tem teste
    expect(decide(sub({}, { last_payment: undefined }), USER, NOW).kind).toBe('none');
    // depois do teste, sem pagamento: fora
    expect(decide(trial, USER, Date.parse('2026-12-09T00:00:00Z'))).toMatchObject({ kind: 'revoke', reason: 'trial_over' });
  });

  it('anual pago dá um ano', () => {
    const y = sub({ plan_id: YEARLY.planId }, { last_payment: { amount: { value: '24.99', currency_code: 'USD' }, time: '2026-12-07T10:00:00Z' } });
    expect(decide(y, USER, NOW)).toMatchObject({ kind: 'grant', periodEnd: '2027-12-10T10:00:00.000Z' });
  });
});

describe('PayPal: webhooks', () => {
  it('encontra a subscrição e os reembolsos', () => {
    expect(subscriptionIdFromEvent({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: 'I-1' } })).toEqual({ subscriptionId: 'I-1', refund: false });
    expect(subscriptionIdFromEvent({ event_type: 'PAYMENT.SALE.REFUNDED', resource: { billing_agreement_id: 'I-2' } })).toEqual({ subscriptionId: 'I-2', refund: true });
    expect(subscriptionIdFromEvent({ event_type: 'PAYMENT.SALE.REVERSED', resource: { billing_agreement_id: 'I-3' } }).refund).toBe(true);
    expect(subscriptionIdFromEvent({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'X' } }).subscriptionId).toBeNull();
  });

  it('recusa webhooks sem cabeçalhos e só aceita SUCCESS do PayPal', async () => {
    const env = (status: string) => ({
      clientId: 'id',
      secret: 's',
      fetch: (async () => new Response(JSON.stringify({ verification_status: status }), { status: 200 })) as typeof fetch,
    });
    const h = new Headers({ 'paypal-transmission-id': 't', 'paypal-transmission-sig': 's' });
    expect(await verifyWebhook(env('SUCCESS'), 'tok', 'WH-1', h, {})).toBe(true);
    expect(await verifyWebhook(env('FAILURE'), 'tok', 'WH-1', h, {})).toBe(false);
    expect(await verifyWebhook(env('SUCCESS'), 'tok', 'WH-1', new Headers(), {})).toBe(false);
    expect(await verifyWebhook(env('SUCCESS'), 'tok', '', h, {})).toBe(false);
  });

  it('confirma preço e periodicidade do plano no PayPal', async () => {
    const plan = (value: string, unit: string, status = 'ACTIVE') => ({
      clientId: 'id',
      secret: 's',
      fetch: (async () =>
        new Response(JSON.stringify({ status, billing_cycles: [{ tenure_type: 'REGULAR', frequency: { interval_unit: unit, interval_count: 1 }, pricing_scheme: { fixed_price: { value, currency_code: 'USD' } } }] }), {
          status: 200,
        })) as typeof fetch,
    });
    expect(await planMatches(plan('3.99', 'MONTH'), 't', MONTHLY)).toBe(true);
    expect(await planMatches(plan('0.99', 'MONTH'), 't', MONTHLY)).toBe(false);
    expect(await planMatches(plan('3.99', 'YEAR'), 't', MONTHLY)).toBe(false);
    expect(await planMatches(plan('3.99', 'MONTH', 'INACTIVE'), 't', MONTHLY)).toBe(false);
  });
});
