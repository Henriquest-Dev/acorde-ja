/// <reference types="jest" />
import { SCREEN_TOTAL_ID } from '@/repositories/usage';
import { mapUsageToRows } from '@/services/usage';

jest.mock('@/database/db', () => ({ getDb: jest.fn(), inTransaction: jest.fn() }));

const limits = [
  { appId: 'tiktok', name: 'TikTok', packageNames: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'], limitMinutes: 20, enabled: true, sort: 0, sinceMs: 0 },
];

describe('mapUsageToRows', () => {
  it('agrega variantes de pacote na mesma app controlada e mantém o total de ecrã', () => {
    const rows = mapUsageToRows(
      '2026-05-12',
      [
        { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', foregroundMs: 600_000, opens: 3 },
        { packageName: 'com.ss.android.ugc.trill', label: 'TikTok Lite', foregroundMs: 360_000, opens: 1 },
        { packageName: 'org.wikipedia', label: 'Wikipédia', foregroundMs: 120_000, opens: null },
      ],
      1_080_000,
      limits,
    );
    const tiktok = rows.find((r) => r.appId === 'tiktok')!;
    expect(tiktok.usedMs).toBe(960_000);
    expect(tiktok.opens).toBe(4);
    expect(tiktok.limitMs).toBe(20 * 60_000);
    expect(rows.find((r) => r.appId === 'org.wikipedia')).toMatchObject({ limitMs: null, opens: null });
    expect(rows.find((r) => r.appId === SCREEN_TOTAL_ID)!.usedMs).toBe(1_080_000);
  });
});
