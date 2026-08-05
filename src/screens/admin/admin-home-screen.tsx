/**
 * AdminHome — platform admin console shell. A segmented control switches between
 * the three tabs from the web dashboard: Users, Models, Knowledge. Each tab is a
 * self-contained component that loads its own data on focus.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AdminStackParamList } from '@/navigation/types';
import { AdminKnowledgeTab } from './admin-knowledge-tab';
import { AdminModelsTab } from './admin-models-tab';
import { AdminUsersTab } from './admin-users-tab';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminHome'>;

type TabKey = 'users' | 'models' | 'knowledge';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'users', label: 'Users' },
  { key: 'models', label: 'Models' },
  { key: 'knowledge', label: 'Knowledge' },
];

export function AdminHomeScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<TabKey>(route.params?.tab ?? 'users');

  return (
    <Screen padded={false} edges={['bottom']}>
      <View
        style={[
          styles.segment,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={[styles.segmentItem, active && { backgroundColor: theme.card }]}>
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? theme.text : theme.textSecondary },
                ]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {tab === 'users' ? <AdminUsersTab navigation={navigation} /> : null}
        {tab === 'models' ? <AdminModelsTab /> : null}
        {tab === 'knowledge' ? <AdminKnowledgeTab /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    padding: Spacing.half,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: Spacing.half,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  segmentText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  body: { flex: 1 },
});
