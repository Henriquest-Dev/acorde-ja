import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  getCapabilities,
  getPermissions,
  requestNotifications,
  requestOverlay,
  requestUsageAccess,
  shield,
  startEnforcement,
  type PermissionState,
} from '@/native/device';
import { syncRulesToNative } from '@/services/usage';

export type PermissionKey = 'usage' | 'apps' | 'sites';

export interface PermissionItem {
  key: PermissionKey;
  title: string;
  description: string;
  state: PermissionState;
  /** O que fica indisponível sem esta permissão. */
  unavailable: string;
  howTo: string;
}

/**
 * Estado REAL das três permissões apresentadas no ecrã «Permissões necessárias».
 * É relido sempre que o aplicativo volta ao primeiro plano (o utilizador
 * concede a permissão nas definições do sistema).
 */
export function usePermissionSummary() {
  const query = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const [perms, caps] = await Promise.all([getPermissions(), getCapabilities()]);
      const ios = Platform.OS === 'ios';
      const both = (a: PermissionState, b: PermissionState): PermissionState =>
        a === 'unsupported' || b === 'unsupported' ? 'unsupported' : a === 'granted' && b === 'granted' ? 'granted' : 'denied';
      const items: PermissionItem[] = [
        {
          key: 'usage',
          title: 'Aceder ao uso das apps',
          description: ios
            ? 'Autorização do Tempo de Ecrã para aplicar limites às apps que escolher.'
            : 'Permite medir quanto tempo passa em cada aplicação. Os dados ficam no seu dispositivo.',
          state: ios ? perms.familyControls : perms.usageAccess,
          unavailable: 'Sem esta permissão não é possível medir o tempo nem aplicar limites.',
          howTo: ios
            ? 'Toque em «Conceder» e confirme com o código do dispositivo.'
            : 'Definições → Acesso a dados de utilização → Acorde Já → Permitir.',
        },
        {
          key: 'apps',
          title: 'Bloquear aplicações',
          description: ios
            ? 'Aplica o escudo do Tempo de Ecrã às aplicações seleccionadas.'
            : 'Mostra o ecrã de bloqueio sobre a aplicação quando o limite é atingido, e envia avisos.',
          state: ios ? perms.familyControls : both(perms.overlay, perms.notifications === 'unsupported' ? 'granted' : perms.notifications),
          unavailable: 'Sem esta permissão recebe apenas as estatísticas, sem ecrã de bloqueio.',
          howTo: ios ? 'Requer a autorização do Tempo de Ecrã.' : 'Definições → Sobrepor a outras apps → Acorde Já → Permitir. Depois aceite as notificações.',
        },
        {
          key: 'sites',
          title: 'Bloquear sites',
          description: ios
            ? 'Usa o filtro de conteúdos do Tempo de Ecrã.'
            : 'Cria uma VPN local que filtra apenas pedidos DNS. Nenhum tráfego sai do seu dispositivo por nós.',
          state: ios ? perms.familyControls : perms.vpn,
          unavailable: 'Sem esta permissão a protecção de sites fica desactivada.',
          howTo: ios ? 'Requer a autorização do Tempo de Ecrã.' : 'Toque em «Conceder» e aceite o pedido de ligação VPN do Android.',
        },
      ];
      return { items, caps, perms };
    },
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void query.refetch());
    return () => sub.remove();
  }, [query]);

  return query;
}

/** Pede a permissão indicada (abre o ecrã do sistema quando necessário). */
export async function requestPermission(key: PermissionKey): Promise<void> {
  switch (key) {
    case 'usage':
      await requestUsageAccess();
      return;
    case 'apps': {
      const perms = await getPermissions();
      if (perms.notifications !== 'granted' && perms.notifications !== 'unsupported') await requestNotifications();
      if (Platform.OS === 'android' && perms.overlay !== 'granted') {
        await requestOverlay();
        return;
      }
      if (Platform.OS === 'ios') await requestUsageAccess();
      await activateEnforcement();
      return;
    }
    case 'sites':
      if (Platform.OS === 'ios') {
        await requestUsageAccess();
        return;
      }
      await shield.prepare();
      return;
  }
}

/** Liga o serviço de aplicação de regras quando as permissões o permitem. */
export async function activateEnforcement(): Promise<boolean> {
  const caps = await getCapabilities();
  if (!caps.canMeasureUsage && Platform.OS === 'android') return false;
  await syncRulesToNative();
  return startEnforcement().catch(() => false);
}
