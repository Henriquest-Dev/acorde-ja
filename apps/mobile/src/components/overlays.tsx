/** AppModal, AppBottomSheet e AppToast. */
import { Feather } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';
import { AppText } from './AppText';

export function AppModal({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduce ? 'none' : 'fade'} onRequestClose={dismissible ? onClose : () => undefined}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={dismissible ? onClose : undefined} accessibilityLabel="Fechar">
        <Pressable style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
          {title ? (
            <AppText variant="h3" style={{ marginBottom: spacing.md }} accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AppBottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Animated.View entering={reduce ? undefined : FadeIn} exiting={reduce ? undefined : FadeOut} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" />
        </Animated.View>
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <Animated.View
          entering={reduce ? undefined : SlideInDown.duration(260)}
          exiting={reduce ? undefined : SlideOutDown.duration(200)}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          {title ? (
            <View style={styles.sheetHeader}>
              <AppText variant="h3" accessibilityRole="header">
                {title}
              </AppText>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ToastState {
  message: string | null;
  kind: 'info' | 'error';
  show(message: string, kind?: 'info' | 'error'): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: 'info',
  show: (message, kind = 'info') => set({ message, kind }),
  hide: () => set({ message: null }),
}));

export const toast = (message: string, kind: 'info' | 'error' = 'info') => useToast.getState().show(message, kind);

export function AppToastHost() {
  const { message, kind, hide } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, [message, hide]);
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { top: insets.top + 8, backgroundColor: kind === 'error' ? colors.text : colors.elevated, borderColor: colors.borderStrong }]}
    >
      <Feather name={kind === 'error' ? 'alert-circle' : 'check-circle'} size={18} color={kind === 'error' ? colors.background : colors.text} />
      <AppText variant="small" style={{ flex: 1, color: kind === 'error' ? colors.background : colors.text }}>
        {message}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  modal: { width: '100%', maxWidth: 420, borderRadius: radii.xl, padding: spacing.xxl, borderWidth: StyleSheet.hairlineWidth },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1000,
  },
});
