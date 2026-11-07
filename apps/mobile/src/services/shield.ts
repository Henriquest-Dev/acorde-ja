import { RESOLVERS, activeDomainList, pickResolver, type ShieldConfig } from '@acorde/core';
import { Platform } from 'react-native';
import { getCapabilities, shield } from '@/native/device';

export type ShieldApplyResult =
  | { status: 'active'; domains: number }
  | { status: 'stopped' }
  | { status: 'permission_denied' }
  | { status: 'unsupported'; reason: string };

/**
 * Aplica a configuração do Digital Shield no sistema: liga a VPN local de DNS
 * (Android) ou o filtro do Tempo de Ecrã (iOS). Nunca indica "activo" se o
 * sistema não confirmou o arranque.
 */
export async function applyShield(config: ShieldConfig): Promise<ShieldApplyResult> {
  const domains = activeDomainList(config);
  const wantsOn = domains.length > 0;
  const caps = await getCapabilities();
  if (!caps.canBlockSites) {
    return {
      status: 'unsupported',
      reason:
        Platform.OS === 'web'
          ? 'A protecção de sites só funciona no aplicativo Android ou iOS.'
          : Platform.OS === 'ios'
            ? 'No iPhone, instale o perfil de proteção em Proteção → iPhone e iPad.'
            : 'Módulo nativo indisponível nesta compilação.',
    };
  }
  if (!wantsOn) {
    await shield.stop();
    return { status: 'stopped' };
  }
  const prepared = await shield.prepare();
  if (!prepared) return { status: 'permission_denied' };
  // O resolvedor de filtragem cobre milhões de domínios além da lista local.
  const resolver = RESOLVERS[pickResolver({ ...config.categories, ads: config.categories.ads ?? false })];
  const started = await shield.start(domains, resolver.ip);
  return started ? { status: 'active', domains: domains.length } : { status: 'permission_denied' };
}
