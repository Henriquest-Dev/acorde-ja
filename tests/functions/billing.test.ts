import { describe, expect, it } from 'vitest';
import { hmacHex, parseEvent, verifySignature } from '../../supabase/functions/_shared/billing';

const SECRET = 'whsec_test';
const body = JSON.stringify({
  id: 'evt_1',
  type: 'subscription.activated',
  user_id: '00000000-0000-0000-0000-00000000000D',
  product_id: 'offly_pro_yearly',
  current_period_end: '2027-11-07T00:00:00Z',
});

describe('webhook de faturação', () => {
  it('aceita assinatura válida e recusa adulterada, sem segredo ou antiga', async () => {
    const t = 1_800_000_000;
    const sig = `t=${t},v1=${await hmacHex(SECRET, `${t}.${body}`)}`;
    expect(await verifySignature(sig, body, SECRET, t)).toBe(true);
    expect(await verifySignature(sig, body.replace('yearly', 'monthly'), SECRET, t)).toBe(false);
    expect(await verifySignature(sig, body, 'outro', t)).toBe(false);
    expect(await verifySignature(sig, body, SECRET, t + 301)).toBe(false);
    expect(await verifySignature(null, body, SECRET, t)).toBe(false);
  });

  it('valida e normaliza o evento', () => {
    const r = parseEvent(JSON.parse(body));
    expect(r.ok && r.event.user_id).toBe('00000000-0000-0000-0000-00000000000d');
    expect(parseEvent({ ...JSON.parse(body), type: 'x' })).toEqual({ ok: false, error: 'invalid_type' });
    expect(parseEvent({ ...JSON.parse(body), product_id: 'free_money' })).toEqual({ ok: false, error: 'invalid_product_id' });
    expect(parseEvent({ ...JSON.parse(body), user_id: 'abc' })).toEqual({ ok: false, error: 'invalid_user_id' });
  });
});
