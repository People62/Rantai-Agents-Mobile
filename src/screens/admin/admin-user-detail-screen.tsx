/**
 * AdminUserDetail — manage one platform user: toggle platform-admin role,
 * suspend/reactivate, and force a password reset (temp password shown once).
 * Destructive actions use themed confirm dialogs, never the OS Alert.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Copy, KeyRound, ShieldCheck, Ban } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
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

import { Button, EmptyState, Screen } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AdminStackParamList } from '@/navigation/types';
import {
  AdminUser,
  getAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
} from '@/lib/api';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminUserDetail'>;

export function AdminUserDetailScreen({ route }: Props) {
  const theme = useTheme();
  const { token, user: me } = useAuth();
  const { id } = route.params;
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Confirm dialogs + reset result.
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const isSelf = me?.id === id;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setUser(await getAdminUser(token, id));
    } catch {
      setError('Failed to load user. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = async () => {
    if (!token || !user) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateAdminUser(token, id, {
        role: user.role === 'ADMIN' ? 'USER' : 'ADMIN',
      });
      setUser(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const applySuspend = async () => {
    if (!token || !user) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateAdminUser(token, id, { suspended: !user.suspendedAt });
      setUser(updated);
      setConfirmSuspend(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const applyReset = async () => {
    if (!token) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await resetAdminUserPassword(token, id);
      setTempPassword(res.tempPassword);
      setConfirmReset(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (error || !user) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState icon={ShieldCheck} title="Unavailable" subtitle={error ?? 'User not found.'} />
          <Button label="Retry" variant="outline" onPress={load} />
        </View>
      </Screen>
    );
  }

  const suspended = !!user.suspendedAt;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.text }]}>
            {user.name?.trim() || user.email}
          </Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user.email}</Text>
          <View style={styles.tags}>
            {user.role === 'ADMIN' ? (
              <View style={[styles.tag, { backgroundColor: `${theme.accent}22` }]}>
                <Text style={[styles.tagText, { color: theme.accent }]}>Admin</Text>
              </View>
            ) : null}
            {suspended ? (
              <View style={[styles.tag, { backgroundColor: `${theme.destructive}22` }]}>
                <Text style={[styles.tagText, { color: theme.destructive }]}>Suspended</Text>
              </View>
            ) : (
              <View style={[styles.tag, { backgroundColor: `${theme.success}22` }]}>
                <Text style={[styles.tagText, { color: theme.success }]}>Active</Text>
              </View>
            )}
          </View>
        </View>

        {actionError ? (
          <Text style={[styles.actionError, { color: theme.destructive }]}>{actionError}</Text>
        ) : null}

        {/* Role */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <View style={styles.settingLabelRow}>
                <ShieldCheck color={theme.textSecondary} size={18} />
                <Text style={[styles.settingLabel, { color: theme.text }]}>Platform admin</Text>
              </View>
              <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
                {isSelf
                  ? 'You cannot change your own role.'
                  : 'Full access to the admin console.'}
              </Text>
            </View>
            <Switch
              value={user.role === 'ADMIN'}
              onValueChange={toggleRole}
              disabled={busy || isSelf}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={theme.accentForeground}
              accessibilityLabel="Platform admin"
            />
          </View>
        </View>

        {user.organizations.length ? (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>Organizations</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {user.organizations.map((org, i) => (
                <View
                  key={org.id}
                  style={[
                    styles.orgRow,
                    i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <Text style={[styles.orgName, { color: theme.text }]} numberOfLines={1}>
                    {org.name}
                  </Text>
                  <Text style={[styles.orgRole, { color: theme.textSecondary }]}>{org.role}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Danger actions */}
        <View style={styles.actions}>
          <Button
            label="Reset password"
            variant="outline"
            leftIcon={<KeyRound color={theme.text} size={18} />}
            onPress={() => setConfirmReset(true)}
            disabled={busy}
          />
          <Button
            label={suspended ? 'Reactivate user' : 'Suspend user'}
            variant={suspended ? 'secondary' : 'destructive'}
            leftIcon={
              suspended ? undefined : <Ban color="#FFFFFF" size={18} />
            }
            onPress={() => setConfirmSuspend(true)}
            disabled={busy || isSelf}
          />
          {isSelf ? (
            <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
              You cannot suspend your own account.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Suspend confirm */}
      <Modal
        visible={confirmSuspend}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmSuspend(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirmSuspend(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>
              {suspended ? 'Reactivate user?' : 'Suspend user?'}
            </Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              {suspended
                ? 'The user will be able to sign in again.'
                : 'The user will be signed out and blocked from signing in.'}
            </Text>
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setConfirmSuspend(false)}
                style={styles.flex}
              />
              <Button
                label={suspended ? 'Reactivate' : 'Suspend'}
                variant={suspended ? 'default' : 'destructive'}
                onPress={applySuspend}
                loading={busy}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reset confirm / result */}
      <Modal
        visible={confirmReset || !!tempPassword}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmReset(false);
          setTempPassword(null);
        }}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setConfirmReset(false);
            setTempPassword(null);
          }}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {tempPassword ? (
              <>
                <Text style={[styles.dialogTitle, { color: theme.text }]}>Password reset</Text>
                <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
                  Share this one-time password — it won't be shown again.
                </Text>
                <Pressable
                  onPress={() => Clipboard.setString(tempPassword)}
                  accessibilityRole="button"
                  accessibilityLabel="Copy temporary password"
                  style={[
                    styles.passwordBox,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.passwordText, { color: theme.text }]} selectable>
                    {tempPassword}
                  </Text>
                  <Copy color={theme.textSecondary} size={18} />
                </Pressable>
                <Button label="Done" onPress={() => setTempPassword(null)} />
              </>
            ) : (
              <>
                <Text style={[styles.dialogTitle, { color: theme.text }]}>Reset password?</Text>
                <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
                  A new temporary password will be generated and shown once.
                </Text>
                <View style={styles.dialogActions}>
                  <Button
                    label="Cancel"
                    variant="outline"
                    onPress={() => setConfirmReset(false)}
                    style={styles.flex}
                  />
                  <Button label="Reset" onPress={applyReset} loading={busy} style={styles.flex} />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  content: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.one },
  name: { fontSize: FontSize.title3, fontWeight: FontWeight.bold },
  email: { fontSize: FontSize.base },
  tags: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  tag: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  actionError: { fontSize: FontSize.sm },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  settingText: { flex: 1, gap: Spacing.half },
  settingLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  settingLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  settingHint: { fontSize: FontSize.sm, lineHeight: 18 },
  group: { gap: Spacing.two },
  groupTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.one,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  orgName: { fontSize: FontSize.base, fontWeight: FontWeight.medium, flex: 1 },
  orgRole: { fontSize: FontSize.sm },
  actions: { gap: Spacing.two, marginTop: Spacing.one },
  // Dialogs
  backdrop: {
    flex: 1,
    backgroundColor: Scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: Spacing.two,
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  passwordText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flex: 1 },
});
