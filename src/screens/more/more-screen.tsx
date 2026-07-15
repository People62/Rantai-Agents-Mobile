/**
 * More — menu ke seksi sekunder (Workflows, Media, Settings, dll.) + keluar.
 * Semua item placeholder untuk fase desain.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

const ITEMS = [
  { key: 'workflows', label: 'Workflows', desc: 'Pipeline & otomasi agen' },
  { key: 'media', label: 'Media Studio', desc: 'Generasi gambar / audio / video' },
  { key: 'agent-builder', label: 'Agent Builder', desc: 'Konfigurasi asisten AI' },
  { key: 'audit', label: 'Audit Log', desc: 'Riwayat aktivitas' },
  { key: 'organization', label: 'Organisasi', desc: 'Anggota & tim' },
  { key: 'settings', label: 'Pengaturan', desc: 'Umum, kredensial, MCP' },
];

export function MoreScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Lainnya</Text>

        <Card style={styles.profile}>
          <View style={styles.profileRow}>
            <Avatar name="Evan K" size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]}>Evan Kleopas</Text>
              <Text style={[styles.email, { color: theme.textSecondary }]}>
                kleopasevan@gmail.com
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.menu}>
          {ITEMS.map((it) => (
            <Pressable
              key={it.key}
              style={({ pressed }) => [
                styles.item,
                { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.card },
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemLabel, { color: theme.text }]}>{it.label}</Text>
                <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>{it.desc}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: FontSize.xl }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Button label="Keluar" variant="outline" onPress={signOut} style={styles.signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: FontSize.title1, fontWeight: FontWeight.bold },
  profile: {},
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  email: { fontSize: FontSize.sm },
  menu: { gap: Spacing.two },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  itemLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  itemDesc: { fontSize: FontSize.sm },
  signOut: { marginTop: Spacing.two },
});
