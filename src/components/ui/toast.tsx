/**
 * Toast — lightweight themed transient notification, the in-app replacement for
 * the OS `Alert.alert` for non-blocking success/error messages. Auto-dismisses;
 * tap to dismiss early. Drive it with the `useToast` hook:
 *
 *   const toast = useToast();
 *   // ...render once inside the screen root:
 *   {toast.node}
 *   // ...anywhere:
 *   toast.show('Saved to your gallery', 'success');
 *   toast.show('Could not save the image', 'error');
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ToastVariant = 'info' | 'success' | 'error';

type ToastState = { message: string; variant: ToastVariant } | null;

function Toast({ state, onHide }: { state: ToastState; onHide: () => void }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => finished && onHide(),
      );
    }, 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, opacity, onHide]);

  if (!state) return null;

  const fg =
    state.variant === 'error'
      ? theme.destructive
      : state.variant === 'success'
        ? theme.success
        : theme.text;
  const bg =
    state.variant === 'error'
      ? `${theme.destructive}1F`
      : state.variant === 'success'
        ? `${theme.success}1F`
        : theme.backgroundElement;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={{ opacity, width: '100%', alignItems: 'center' }}>
        <Pressable
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={[styles.toast, { backgroundColor: bg, borderColor: `${fg}55` }]}>
          <Text style={[styles.text, { color: fg }]} numberOfLines={3}>
            {state.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Hook: returns `show(message, variant?)` and the `node` to render in the screen root. */
export function useToast() {
  const [state, setState] = useState<ToastState>(null);
  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    setState({ message, variant });
  }, []);
  const hide = useCallback(() => setState(null), []);
  const node = <Toast state={state} onHide={hide} />;
  return { show, hide, node };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 480,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, textAlign: 'center' },
});
