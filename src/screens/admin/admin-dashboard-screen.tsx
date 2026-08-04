/**
 * AdminDashboard — platform admin overview (platform role ADMIN only).
 * Customer-support metrics + the communication channels; tap a channel to
 * configure it. Read from /api/mobile/admin/stats + /channels.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageSquare,
  Star,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { AdminChannel, AdminStats, getAdminChannels, getAdminStats } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AdminStackParamList } from '@/navigation/types';
import { channelEmoji, channelLabel } from './admin-utils';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;

export function AdminDashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [s, c] = await Promise.all([getAdminStats(token), getAdminChannels(token)]);
      setStats(s);
      setChannels(c);
    } catch {
      setError('Failed to load admin data. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (error && !stats) {
    return (
      <Screen edges={['bottom']}>
        <Pressable
          style={styles.centered}
          onPress={() => {
            setLoading(true);
            load();
          }}>
          <Text style={[styles.muted, { color: theme.destructive }]}>{error}</Text>
        </Pressable>
      </Screen>
    );
  }

  const cards: { label: string; value: string | number; icon: LucideIcon }[] = [
    { label: 'Conversations', value: stats?.totalConversations ?? 0, icon: MessageSquare },
    { label: 'Active now', value: stats?.activeConversations ?? 0, icon: Activity },
    { label: 'Resolved today', value: stats?.resolvedToday ?? 0, icon: CheckCircle2 },
    { label: 'Avg response', value: stats?.avgResponseTime ?? '—', icon: Clock },
  ];

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }>
        <View style={styles.grid}>
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <View
                key={c.label}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Icon color={theme.accent} size={20} />
                <Text style={[styles.cardValue, { color: theme.text }]}>{c.value}</Text>
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{c.label}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Channels</Text>
        <View style={[styles.channelCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {channels.map((ch, i) => {
            const stat = stats?.channelStats.find((s) => s.channel === ch.channel);
            const count = stat?.count ?? 0;
            return (
              <Pressable
                key={ch.channel}
                onPress={() => navigation.navigate('AdminChannel', { channel: ch })}
                style={({ pressed }) => [
                  styles.channelRow,
                  i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
                  pressed ? { backgroundColor: theme.backgroundElement } : null,
                ]}>
                <Text style={styles.channelEmoji}>{channelEmoji(ch.channel)}</Text>
                <View style={styles.flex}>
                  <View style={styles.channelTop}>
                    <Text style={[styles.channelName, { color: theme.text }]}>
                      {channelLabel(ch.channel)}
                    </Text>
                    {ch.isPrimary ? (
                      <View style={[styles.primaryBadge, { backgroundColor: `${theme.accent}22` }]}>
                        <Star color={theme.accent} size={10} fill={theme.accent} />
                        <Text style={[styles.primaryText, { color: theme.accent }]}>Primary</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.channelMeta, { color: theme.textSecondary }]}>
                    {ch.enabled ? 'Enabled' : 'Disabled'} · {count} conversation
                    {count === 1 ? '' : 's'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: ch.enabled ? theme.success : theme.textSecondary },
                  ]}
                />
                <ChevronRight color={theme.textSecondary} size={18} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.three },
  card: {
    width: '47%',
    flexGrow: 1,
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  cardValue: { fontSize: FontSize.title2, fontWeight: FontWeight.bold },
  cardLabel: { fontSize: FontSize.sm },

  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.one,
    marginBottom: -Spacing.two,
  },
  channelCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  channelEmoji: { fontSize: 22 },
  channelTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  channelName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  channelMeta: { fontSize: FontSize.sm, marginTop: Spacing.half },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.full,
  },
  primaryText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  statusDot: { width: 8, height: 8, borderRadius: Radius.full },
});
