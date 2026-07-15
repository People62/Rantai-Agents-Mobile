/**
 * Login — UI sign-in (dummy, tanpa backend). Aksen biru brand.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input, Screen } from '@/components/ui';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

export function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('Email atau password salah, atau backend tidak terjangkau.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: theme.accent }]}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Please log in to continue.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="nama@perusahaan.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Kata sandi"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          {error ? (
            <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text>
          ) : null}
          <Button label="Masuk" onPress={submit} loading={loading} style={styles.submit} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: Spacing.five },
  header: { alignItems: 'center', gap: Spacing.two },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  logoText: { color: '#fff', fontSize: FontSize.title1, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.title2, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.three },
  submit: { marginTop: Spacing.two },
  error: { fontSize: FontSize.sm, textAlign: 'center' },
  hint: { fontSize: FontSize.xs, textAlign: 'center' },
});
