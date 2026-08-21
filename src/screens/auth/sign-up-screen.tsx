/**
 * Sign Up — create a new account. Registers against the backend
 * (/api/auth/register) then logs in to obtain the mobile JWT, so a successful
 * submit lands the user straight in the app. Navigated to from Login.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Input, Logo, Screen } from '@/components/ui';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/use-google-signin';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/navigation/auth-context';
import type { RootStackParamList } from '@/navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const {
    promptGoogle,
    loading: googleLoading,
    error: googleError,
  } = useGoogleSignIn();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kbHeight, setKbHeight] = useState(0);

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

  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit =
    name.trim().length > 0 &&
    emailOk &&
    password.length >= 8 &&
    confirm === password;

  async function submit() {
    if (loading) return;
    if (!name.trim()) return setError('Please enter your name.');
    if (!emailOk) return setError('Please enter a valid email.');
    if (password.length < 8)
      return setError('Password must be at least 8 characters.');
    if (confirm !== password) return setError('Passwords do not match.');

    setError(null);
    setLoading(true);
    try {
      // On success, auth state flips to signed-in and RootNavigator swaps to
      // the app — no manual navigation needed here.
      await signUp(name.trim(), email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError('Too many attempts. Please try again shortly.');
      } else if (e instanceof ApiError && e.status === 400) {
        setError('Please check your details and try again.');
      } else {
        // register returns 201 even if the email is taken (existence is hidden),
        // so a failed follow-up login most likely means the email is registered.
        setError(
          'Could not create the account. The email may already be registered — try logging in.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Spacing.four + kbHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Logo width={92} />
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: theme.text }]}>
              Create your account
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Sign up to get started.
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
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
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="next"
            rightElement={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }>
                {showPassword ? (
                  <EyeOff color={theme.textSecondary} size={20} />
                ) : (
                  <Eye color={theme.textSecondary} size={20} />
                )}
              </Pressable>
            }
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error || googleError ? (
            <Text style={[styles.error, { color: theme.destructive }]}>
              {error || googleError}
            </Text>
          ) : null}
          <Button
            label="Sign up"
            onPress={submit}
            loading={loading}
            disabled={!canSubmit}
            style={styles.submit}
          />

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
              or
            </Text>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <Button
            label="Continue with Google"
            variant="outline"
            onPress={promptGoogle}
            loading={googleLoading}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Log in">
              <Text style={[styles.footerLink, { color: theme.primary }]}>
                Log in
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.five,
    paddingVertical: Spacing.four,
  },
  header: { alignItems: 'center', gap: Spacing.three },
  titleWrap: { alignItems: 'center', gap: Spacing.three },
  title: { fontSize: FontSize.title2, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.three },
  submit: { marginTop: Spacing.two },
  error: { fontSize: FontSize.sm, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: FontSize.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  footerText: { fontSize: FontSize.sm },
  footerLink: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
