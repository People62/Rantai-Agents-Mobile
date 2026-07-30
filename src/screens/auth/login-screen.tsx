/**
 * Login — sign-in UI. On mount the logo starts at the exact screen centre
 * (matching the splash) and rises into its header position, then the title and
 * form fade in — a continuous splash → login transition.
 */
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, Input, Logo, Screen } from '@/components/ui';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

export function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const { height: winHeight } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kbHeight, setKbHeight] = useState(0);

  // --- Intro animation (logo rises from centre, then content fades in) ---
  const logoRef = useRef<View>(null);
  const started = useRef(false);
  const logoTranslate = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  const runIntro = () => {
    if (started.current) return;
    logoRef.current?.measureInWindow((_x, y, _w, h) => {
      if (!h) return;
      started.current = true;
      const restCentre = y + h / 2;
      const offset = winHeight / 2 - restCentre; // start with the logo at screen centre
      logoTranslate.setValue(offset);
      logoOpacity.setValue(1);
      Animated.sequence([
        Animated.timing(logoTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Safety net: if measurement never lands, just reveal everything.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!started.current) {
        logoOpacity.setValue(1);
        contentFade.setValue(1);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [logoOpacity, contentFade]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  }

  const contentRise = contentFade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Screen>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.four + kbHeight }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View ref={logoRef} onLayout={runIntro}>
            <Animated.View
              style={{ opacity: logoOpacity, transform: [{ translateY: logoTranslate }] }}>
              <Logo width={110} />
            </Animated.View>
          </View>
          <Animated.View
            style={[
              styles.titleWrap,
              { opacity: contentFade, transform: [{ translateY: contentRise }] },
            ]}>
            <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Please log in to continue.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.form, { opacity: contentFade, transform: [{ translateY: contentRise }] }]}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="noExcludeDescendants"
            textContentType="none"
            returnKeyType="next"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={submit}
            rightElement={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? (
                  <EyeOff color={theme.textSecondary} size={20} />
                ) : (
                  <Eye color={theme.textSecondary} size={20} />
                )}
              </Pressable>
            }
          />
          {error ? (
            <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text>
          ) : null}
          <Button label="Log in" onPress={submit} loading={loading} style={styles.submit} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: Spacing.five, paddingVertical: Spacing.four },
  header: { alignItems: 'center', gap: Spacing.three },
  titleWrap: { alignItems: 'center', gap: Spacing.three },
  title: { fontSize: FontSize.title2, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.three },
  submit: { marginTop: Spacing.two },
  error: { fontSize: FontSize.sm, textAlign: 'center' },
});
