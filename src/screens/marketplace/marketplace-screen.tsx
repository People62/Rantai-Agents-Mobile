/**
 * Marketplace — grid kartu item (Assistant/Skill/Tool). Dummy.
 */
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { marketItems } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';

const TABS = ['Semua', 'Assistant', 'Skill', 'Tool'] as const;

export function MarketplaceScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Semua');

  const data = tab === 'Semua' ? marketItems : marketItems.filter((m) => m.category === tab);

  return (
    <Screen padded={false} edges={['bottom']}>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? theme.primary : theme.backgroundElement,
                },
              ]}>
              <Text style={{ color: active ? theme.primaryForeground : theme.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.cardTop}>
              <Badge label={item.category} variant="secondary" />
              <Text style={[styles.installs, { color: theme.textSecondary }]}>
                {item.installs} pemasangan
              </Text>
            </View>
            <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.desc, { color: theme.textSecondary }]}>{item.description}</Text>
            <Button label="Pasang" size="sm" variant="outline" style={styles.install} />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  tab: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.full },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  installs: { fontSize: FontSize.xs },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: 2 },
  desc: { fontSize: FontSize.base, marginBottom: Spacing.three },
  install: { alignSelf: 'flex-start', paddingHorizontal: Spacing.four },
});
