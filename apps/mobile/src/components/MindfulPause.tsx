import { formatClock } from '@acorde/core';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppButton } from './AppButton';
import { AppProgressRing } from './AppProgressRing';
import { AppText } from './AppText';
import { AppBottomSheet } from './overlays';

/**
 * Pausa consciente obrigatória antes de reduzir uma protecção (ex.: desligar
 * o modo restrito). Não pode ser saltada, mas pode ser cancelada.
 */
export function MindfulPause(props: {
  visible: boolean;
  seconds?: number;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // Montado só quando visível: cada abertura recomeça a contagem.
  if (!props.visible) return null;
  return <PauseSheet {...props} />;
}

function PauseSheet({
  seconds = 30,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  seconds?: number;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const total = seconds * 1000;
  const remaining = Math.max(0, total - (now - startedAt));

  return (
    <AppBottomSheet visible onClose={onClose} title={title}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <AppProgressRing progress={1 - remaining / total} size={140} strokeWidth={6}>
          <AppText variant="h2">{formatClock(remaining)}</AppText>
        </AppProgressRing>
        <AppText variant="body" tone="secondary" align="center">
          {message}
        </AppText>
        <AppButton label={remaining > 0 ? 'Aguarde…' : confirmLabel} disabled={remaining > 0} onPress={onConfirm} style={{ alignSelf: 'stretch' }} />
        <AppButton label="Manter protecção" variant="ghost" onPress={onClose} style={{ alignSelf: 'stretch' }} />
      </View>
    </AppBottomSheet>
  );
}
