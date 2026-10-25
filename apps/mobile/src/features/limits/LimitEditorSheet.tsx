import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppBottomSheet, AppButton, AppSlider, AppSwitch, AppText, BrandIcon, toast } from '@/components';
import { useInvalidate, qk } from '@/hooks/queries';
import { deleteLimit, upsertLimit, type AppLimit } from '@/repositories/limits';
import { enqueueSync } from '@/services/sync';
import { syncRulesToNative } from '@/services/usage';
import { spacing } from '@/theme/tokens';
import { AcordeNative } from '../../../modules/acorde-native';

/** Folha de edição de um limite diário (5 a 240 minutos, em passos de 5). */
export function LimitEditorSheet({ limit, onClose, allowDelete }: { limit: AppLimit | null; onClose: () => void; allowDelete?: boolean }) {
  const [minutes, setMinutes] = useState(limit?.limitMinutes ?? 30);
  const [enabled, setEnabled] = useState(limit?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (limit) {
      setMinutes(limit.limitMinutes);
      setEnabled(limit.enabled);
    }
  }, [limit]);

  if (!limit) return null;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await upsertLimit({ ...limit, limitMinutes: minutes, enabled });
      await syncRulesToNative();
      await enqueueSync('app_limits', 'upsert', saved.appId, {
        app_id: saved.appId,
        app_name: saved.name,
        package_names: saved.packageNames,
        limit_minutes: saved.limitMinutes,
        enabled: saved.enabled,
        updated_at: new Date().toISOString(),
      });
      await invalidate(qk.limits, qk.today);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível guardar o limite', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteLimit(limit.appId);
      await AcordeNative?.removeAppLimit(limit.appId);
      await syncRulesToNative();
      await enqueueSync('app_limits', 'delete', limit.appId, {});
      await invalidate(qk.limits, qk.today);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBottomSheet visible onClose={onClose} title="Limite diário">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
        <BrandIcon appId={limit.appId} name={limit.name} size={40} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{limit.name}</AppText>
          <AppText variant="small" tone="muted">
            Aviso aos 80% · bloqueio aos 100%
          </AppText>
        </View>
        <AppSwitch value={enabled} onValueChange={setEnabled} accessibilityLabel="Limite activo" />
      </View>
      <AppText variant="display" align="center" style={{ opacity: enabled ? 1 : 0.4 }}>
        {minutes} min
      </AppText>
      <View style={{ marginVertical: spacing.xl, opacity: enabled ? 1 : 0.4 }} pointerEvents={enabled ? 'auto' : 'none'}>
        <AppSlider value={minutes} min={5} max={240} step={5} onChange={setMinutes} accessibilityLabel="Minutos por dia" formatValue={(v) => `${v} minutos`} />
      </View>
      <AppButton label="Guardar" onPress={save} loading={saving} testID="limit-save" />
      {allowDelete ? <AppButton label="Remover aplicação" variant="ghost" onPress={remove} disabled={saving} style={{ marginTop: spacing.sm }} /> : null}
    </AppBottomSheet>
  );
}
