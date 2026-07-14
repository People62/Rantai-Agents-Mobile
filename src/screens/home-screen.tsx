/**
 * Home — menampilkan status koneksi ke backend RantAI Agents.
 * Port dari src/app/index.tsx (Expo Router) ke bare React Native.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getApiUrl, pingBackend } from '@/lib/api';

type Status = 'checking' | 'online' | 'offline';

export function HomeScreen() {
  const [status, setStatus] = useState<Status>('checking');

  async function check() {
    setStatus('checking');
    const ok = await pingBackend();
    setStatus(ok ? 'online' : 'offline');
  }

  useEffect(() => {
    check();
  }, []);

  const label =
    status === 'checking'
      ? 'Menghubungi backend…'
      : status === 'online'
        ? '● Backend terhubung'
        : '● Backend tidak terjangkau';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.title}>
            RantAI Agents
          </ThemedText>
          <ThemedText type="small">Mobile (React Native)</ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          {status === 'checking' && <ActivityIndicator />}
          <ThemedText
            type="subtitle"
            style={{
              color:
                status === 'online'
                  ? '#16a34a'
                  : status === 'offline'
                    ? '#dc2626'
                    : undefined,
            }}>
            {label}
          </ThemedText>
          <ThemedText type="code" style={styles.url}>
            {getApiUrl()}
          </ThemedText>
          <ThemedText type="small" onPress={check} style={styles.retry}>
            Ketuk untuk cek ulang
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  url: {
    textAlign: 'center',
  },
  retry: {
    textDecorationLine: 'underline',
  },
});
