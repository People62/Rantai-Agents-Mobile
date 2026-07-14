/**
 * Login — UI sign-in (dummy, tanpa backend). Aksen biru brand.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Input, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

export function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
          <Button label="Masuk" onPress={signIn} style={styles.submit} />
          {/* <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Mode desain — ketuk "Masuk" untuk melihat aplikasi.
          </Text> */}
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
  logoText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  form: { gap: Spacing.three },
  submit: { marginTop: Spacing.two },
  hint: { fontSize: 12, textAlign: 'center' },
});
