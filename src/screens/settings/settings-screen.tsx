/**
 * Settings — personal settings for the mobile app.
 *
 * Account (read-only from the JWT), Appearance (light/dark/system, persisted
 * client-side), Default Assistant (reuses the assistants endpoints), the active
 * Organization (read-only), About, and Sign out. Org editing / members /
 * credentials / MCP are later phases.
 */
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bot,
  Brain,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Info,
  KeyRound,
  KeySquare,
  LogOut,
  Monitor,
  Moon,
  Server,
  Sparkles,
  Sun,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  Agent,
  FeatureFlag,
  getAgents,
  getFeatures,
  getOrganization,
  MobileOrganization,
  setDefaultAgent,
  updateFeature,
} from '@/lib/api';
import { useTheme, useThemeMode, type ThemeMode } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

const APP_NAME = 'RantAI Agents';
const APP_VERSION = '1.0.0';

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

const FEATURE_LABELS: Record<string, string> = { AGENT: 'Agent Builder' };
const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f;

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user, signOut, token } = useAuth();
  const { mode, setMode } = useThemeMode();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [org, setOrg] = useState<MobileOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [agentsRes, orgRes, featuresRes] = await Promise.all([
        getAgents(token).catch(() => ({ assistants: [], defaultAssistantId: null })),
        getOrganization(token).catch(() => null),
        isAdmin ? getFeatures(token).catch(() => [] as FeatureFlag[]) : Promise.resolve([]),
      ]);
      setAgents(agentsRes.assistants);
      setDefaultId(agentsRes.defaultAssistantId);
      setOrg(orgRes);
      setFeatures(featuresRes);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const defaultAgent = agents.find((a) => a.id === defaultId) ?? null;

  async function chooseDefault(id: string) {
    if (!token || savingDefault) return;
    setSavingDefault(true);
    const prev = defaultId;
    setDefaultId(id); // optimistic
    try {
      await setDefaultAgent(token, id);
      setPickerOpen(false);
    } catch {
      setDefaultId(prev); // revert
    } finally {
      setSavingDefault(false);
    }
  }

  async function toggleFeature(feature: string, next: boolean) {
    if (!token || togglingFeature) return;
    setTogglingFeature(feature);
    setFeatures((prev) => prev.map((f) => (f.feature === feature ? { ...f, enabled: next } : f)));
    try {
      await updateFeature(token, feature, next);
    } catch {
      // revert on failure
      setFeatures((prev) => prev.map((f) => (f.feature === feature ? { ...f, enabled: !next } : f)));
    } finally {
      setTogglingFeature(null);
    }
  }

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Account */}
        <View style={[styles.accountCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <Text style={[styles.accountEmail, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
          {user?.role ? (
            <View style={[styles.roleBadge, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.roleText, { color: theme.textSecondary }]}>{user.role}</Text>
            </View>
          ) : null}
        </View>

        {/* Appearance */}
        <Section theme={theme} title="Appearance">
          <View style={styles.segment}>
            {THEME_OPTIONS.map((opt) => {
              const on = opt.key === mode;
              const Icon = opt.icon;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setMode(opt.key)}
                  style={[
                    styles.segmentItem,
                    {
                      backgroundColor: on ? theme.accent : theme.backgroundElement,
                      borderColor: on ? theme.accent : theme.border,
                    },
                  ]}>
                  <Icon color={on ? theme.accentForeground : theme.textSecondary} size={18} />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: on ? theme.accentForeground : theme.text },
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Preferences */}
        <Section theme={theme} title="Preferences">
          <Row
            theme={theme}
            icon={Bot}
            label="Default assistant"
            value={loading ? '…' : defaultAgent?.name ?? 'None'}
            onPress={() => setPickerOpen(true)}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={Building2}
            label="Organization"
            value={loading ? '…' : org?.name ?? 'None'}
            badge={org?.role ?? undefined}
            onPress={org ? () => navigation.navigate('OrganizationSettings') : undefined}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={CreditCard}
            label="Billing"
            onPress={() => navigation.navigate('Billing')}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={Wrench}
            label="Tools"
            onPress={() => navigation.navigate('Tools')}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={Sparkles}
            label="Skills"
            onPress={() => navigation.navigate('Skills')}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={KeyRound}
            label="Credentials"
            onPress={() => navigation.navigate('Credentials')}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={Server}
            label="MCP Servers"
            onPress={() => navigation.navigate('McpServers')}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={Brain}
            label="Memory"
            onPress={() => navigation.navigate('Memory')}
          />
          <Divider theme={theme} />
          <Row
            theme={theme}
            icon={KeySquare}
            label="Agent API Keys"
            onPress={() => navigation.navigate('ApiKeys')}
          />
        </Section>

        {/* Beta Features (platform admins only) */}
        {isAdmin && features.length ? (
          <Section theme={theme} title="Beta Features">
            {features.map((f, i) => (
              <View key={f.feature}>
                {i > 0 ? <Divider theme={theme} /> : null}
                <View style={styles.featureRow}>
                  <FlaskConical color={theme.textSecondary} size={19} />
                  <Text style={[styles.rowLabel, { color: theme.text }]}>{featureLabel(f.feature)}</Text>
                  <Switch
                    value={f.enabled}
                    onValueChange={(v) => toggleFeature(f.feature, v)}
                    disabled={togglingFeature === f.feature}
                    trackColor={{ true: theme.accent, false: theme.border }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {/* About */}
        <Section theme={theme} title="About">
          <Row theme={theme} icon={Info} label="App" value={APP_NAME} />
          <Divider theme={theme} />
          <Row theme={theme} icon={Info} label="Version" value={APP_VERSION} />
        </Section>

        <Button
          label="Sign out"
          variant="destructive"
          onPress={() => setSignOutOpen(true)}
          style={styles.signOut}
        />
      </ScrollView>

      {/* Default assistant picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Default assistant</Text>
            <ScrollView style={styles.sheetList}>
              {agents.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => chooseDefault(a.id)}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <Text style={styles.pickerEmoji}>{a.emoji || '🤖'}</Text>
                  <View style={styles.flex}>
                    <Text style={[styles.pickerName, { color: theme.text }]} numberOfLines={1}>
                      {a.name}
                    </Text>
                  </View>
                  {a.id === defaultId ? <Check color={theme.accent} size={18} /> : null}
                </Pressable>
              ))}
              {agents.length === 0 ? (
                <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
                  No assistants yet.
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sign out confirm */}
      <Modal visible={signOutOpen} transparent animationType="fade" onRequestClose={() => setSignOutOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSignOutOpen(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <LogOut color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Sign out?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              You’ll need to sign in again to use the app.
            </Text>
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setSignOutOpen(false)} style={styles.flex} />
              <Button label="Sign out" variant="destructive" onPress={signOut} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

type Theme = ReturnType<typeof useTheme>;

function Section({ theme, title, children }: { theme: Theme; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

function Divider({ theme }: { theme: Theme }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

function Row({
  theme, icon: Icon, label, value, badge, onPress,
}: {
  theme: Theme; icon: typeof Bot; label: string; value?: string;
  badge?: string; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { backgroundColor: theme.backgroundElement } : null]}>
      <Icon color={theme.textSecondary} size={19} />
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {badge ? (
          <View style={[styles.roleBadge, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.roleText, { color: theme.textSecondary }]}>{badge}</Text>
          </View>
        ) : null}
        {onPress ? <ChevronRight color={theme.textSecondary} size={18} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  accountName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  accountEmail: { fontSize: FontSize.base, marginTop: 1 },
  roleBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  section: { gap: Spacing.two },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.one,
  },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },

  segment: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  segmentText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, maxWidth: '55%' },
  rowValue: { fontSize: FontSize.base, flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three + 19 + Spacing.three },

  signOut: { marginTop: Spacing.two },

  // Picker sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    maxHeight: '70%',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  sheetList: { flexGrow: 0 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  pickerEmoji: { fontSize: 22 },
  pickerName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  emptyHint: { fontSize: FontSize.base, textAlign: 'center', padding: Spacing.four },

  // Confirm dialog
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
});
