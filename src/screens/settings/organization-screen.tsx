/**
 * OrganizationScreen — Settings → Organization. Owner/admin can rename the org
 * and manage members (invite, change role [owner only], remove). Members and
 * viewers see a read-only view. The backend enforces every role rule; the UI
 * only hides controls the caller can't use.
 */
import { pick, types } from '@react-native-documents/picker';
import { useFocusEffect } from '@react-navigation/native';
import { Building2, Check, ImagePlus, MoreVertical, Trash2, UserPlus, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  ApiError,
  MemberRole,
  MobileOrganization,
  OrganizationMember,
  deleteOrganizationLogo,
  getOrganization,
  getOrganizationLogo,
  getOrganizationMembers,
  inviteOrganizationMember,
  removeOrganizationMember,
  updateMemberRole,
  updateOrganization,
  uploadOrganizationLogo,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

const ROLES: MemberRole[] = ['admin', 'member', 'viewer'];

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    try {
      return (JSON.parse(e.body) as { error?: string }).error ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function OrganizationScreen() {
  const theme = useTheme();
  const { token, user } = useAuth();

  const [org, setOrg] = useState<MobileOrganization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [actionMember, setActionMember] = useState<OrganizationMember | null>(null);
  const [roleMember, setRoleMember] = useState<OrganizationMember | null>(null);
  const [removeMember, setRemoveMember] = useState<OrganizationMember | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [orgRes, membersRes, logoRes] = await Promise.all([
        getOrganization(token).catch(() => null),
        getOrganizationMembers(token).catch(() => [] as OrganizationMember[]),
        getOrganizationLogo(token).catch(() => ({ logoUrl: null })),
      ]);
      setOrg(orgRes);
      setName(orgRes?.name ?? '');
      setMembers(membersRes);
      setLogoUrl(logoRes.logoUrl);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const role = org?.role ?? null;
  const canManage = role === 'owner' || role === 'admin';
  const isOwner = role === 'owner';

  const nameChanged = name.trim() !== '' && name.trim() !== (org?.name ?? '');

  async function pickLogo() {
    if (!token || logoBusy) return;
    let file: { uri: string; name: string; type: string };
    try {
      const [f] = await pick({ type: [types.images], allowMultiSelection: false });
      if (!f?.uri) return;
      file = { uri: f.uri, name: f.name ?? 'logo.png', type: f.type ?? 'image/png' };
    } catch {
      return; // user cancelled
    }
    setLogoBusy(true);
    try {
      const res = await uploadOrganizationLogo(token, file);
      setLogoUrl(res.logoUrl);
    } catch {
      // ignore; keep current
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    if (!token || logoBusy) return;
    setLogoBusy(true);
    try {
      await deleteOrganizationLogo(token);
      setLogoUrl(null);
    } catch {
      // ignore
    } finally {
      setLogoBusy(false);
    }
  }

  async function saveName() {
    if (!token || !nameChanged || savingName) return;
    setSavingName(true);
    setNameError(null);
    try {
      const updated = await updateOrganization(token, { name: name.trim() });
      setOrg(updated);
    } catch (e) {
      setNameError(apiMessage(e, 'Failed to rename. Try again.'));
    } finally {
      setSavingName(false);
    }
  }

  async function doInvite() {
    if (!token || inviting) return;
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    try {
      const member = await inviteOrganizationMember(token, { email, role: inviteRole });
      setMembers((prev) => [...prev, member]);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch (e) {
      setInviteError(apiMessage(e, 'Failed to invite. Try again.'));
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: OrganizationMember, next: MemberRole) {
    if (!token || busy) return;
    setBusy(true);
    try {
      const updated = await updateMemberRole(token, member.id, next);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      setRoleMember(null);
    } catch {
      // Backend rejected (e.g. not owner) — keep the list unchanged.
      setRoleMember(null);
    } finally {
      setBusy(false);
    }
  }

  async function doRemove(member: OrganizationMember) {
    if (!token || busy) return;
    setBusy(true);
    try {
      await removeOrganizationMember(token, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setRemoveMember(null);
    } catch {
      setRemoveMember(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </Screen>
    );
  }

  if (!org) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            You don’t belong to an organization yet.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Details</Text>

          <View style={styles.logoRow}>
            <View style={[styles.logoBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {logoBusy ? (
                <ActivityIndicator color={theme.accent} />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="cover" />
              ) : (
                <Building2 color={theme.textSecondary} size={26} />
              )}
            </View>
            {canManage ? (
              <View style={styles.logoActions}>
                <Pressable
                  onPress={pickLogo}
                  disabled={logoBusy}
                  style={[styles.logoBtn, { backgroundColor: `${theme.accent}18` }]}>
                  <ImagePlus color={theme.accent} size={15} />
                  <Text style={[styles.logoBtnText, { color: theme.accent }]}>
                    {logoUrl ? 'Change logo' : 'Upload logo'}
                  </Text>
                </Pressable>
                {logoUrl ? (
                  <Pressable onPress={removeLogo} disabled={logoBusy} style={styles.logoRemove}>
                    <Text style={[styles.logoRemoveText, { color: theme.destructive }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={canManage}
            placeholder="Organization name"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                color: canManage ? theme.text : theme.textSecondary,
                borderColor: theme.border,
                backgroundColor: theme.card,
              },
            ]}
          />
          <Text style={[styles.slug, { color: theme.textSecondary }]}>@{org.slug}</Text>
          {nameError ? (
            <Text style={[styles.errorText, { color: theme.destructive }]}>{nameError}</Text>
          ) : null}
          {canManage && nameChanged ? (
            <Button label="Save name" onPress={saveName} loading={savingName} style={styles.saveBtn} />
          ) : null}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.membersHead}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Members ({members.length})
            </Text>
            {canManage ? (
              <Pressable
                onPress={() => {
                  setInviteError(null);
                  setInviteOpen(true);
                }}
                style={[styles.inviteBtn, { backgroundColor: `${theme.accent}18` }]}>
                <UserPlus color={theme.accent} size={15} />
                <Text style={[styles.inviteText, { color: theme.accent }]}>Invite</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {members.map((m, i) => {
              const initial = (m.name || m.email || '?').trim().charAt(0).toUpperCase();
              const isSelf = m.userId === user?.id;
              const actionable = canManage && m.role !== 'owner' && !isSelf;
              return (
                <View key={m.id}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                  <View style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={[styles.memberInitial, { color: theme.text }]}>{initial}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                        {m.name || m.email}
                        {isSelf ? '  (you)' : ''}
                      </Text>
                      <Text style={[styles.memberEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                        {m.email}
                      </Text>
                    </View>
                    {m.isPending ? (
                      <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
                        <Text style={[styles.pillText, { color: theme.textSecondary }]}>Pending</Text>
                      </View>
                    ) : null}
                    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={[styles.pillText, { color: theme.textSecondary }]}>{m.role}</Text>
                    </View>
                    {actionable ? (
                      <Pressable onPress={() => setActionMember(m)} hitSlop={8}>
                        <MoreVertical color={theme.textSecondary} size={18} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Invite modal */}
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Invite member</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="email@example.com"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => {
                const on = r === inviteRole;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: on ? `${theme.accent}22` : theme.backgroundElement,
                        borderColor: on ? theme.accent : theme.border,
                      },
                    ]}>
                    <Text style={[styles.roleChipText, { color: on ? theme.accent : theme.text }]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            {inviteError ? (
              <Text style={[styles.errorText, { color: theme.destructive }]}>{inviteError}</Text>
            ) : null}
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setInviteOpen(false)} style={styles.flex} />
              <Button
                label="Invite"
                onPress={doInvite}
                loading={inviting}
                disabled={!inviteEmail.trim()}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Member action sheet */}
      <Modal visible={!!actionMember} transparent animationType="fade" onRequestClose={() => setActionMember(null)}>
        <Pressable style={styles.backdrop} onPress={() => setActionMember(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {actionMember?.name || actionMember?.email}
            </Text>
            {isOwner ? (
              <Pressable
                onPress={() => {
                  const m = actionMember;
                  setActionMember(null);
                  setRoleMember(m);
                }}
                style={({ pressed }) => [styles.sheetItem, pressed && { backgroundColor: theme.backgroundElement }]}>
                <Check color={theme.text} size={20} />
                <Text style={[styles.sheetLabel, { color: theme.text }]}>Change role</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                const m = actionMember;
                setActionMember(null);
                setRemoveMember(m);
              }}
              style={({ pressed }) => [styles.sheetItem, pressed && { backgroundColor: theme.backgroundElement }]}>
              <Trash2 color={theme.destructive} size={20} />
              <Text style={[styles.sheetLabel, { color: theme.destructive }]}>Remove from org</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change role modal */}
      <Modal visible={!!roleMember} transparent animationType="fade" onRequestClose={() => setRoleMember(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setRoleMember(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.dialogHead}>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>Change role</Text>
              <Pressable onPress={() => setRoleMember(null)} hitSlop={8}>
                <X color={theme.textSecondary} size={20} />
              </Pressable>
            </View>
            {ROLES.map((r) => {
              const on = r === roleMember?.role;
              return (
                <Pressable
                  key={r}
                  onPress={() => roleMember && changeRole(roleMember, r)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.roleOption,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <Text style={[styles.roleOptionText, { color: theme.text }]}>{r}</Text>
                  {on ? <Check color={theme.accent} size={18} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Remove confirm */}
      <Modal visible={!!removeMember} transparent animationType="fade" onRequestClose={() => setRemoveMember(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setRemoveMember(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, styles.center, { color: theme.text }]}>Remove member?</Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: FontWeight.semibold }}>
                {removeMember?.name || removeMember?.email}
              </Text>
              {' will lose access to this organization.'}
            </Text>
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="outline" onPress={() => setRemoveMember(null)} disabled={busy} style={styles.flex} />
              <Button
                label="Remove"
                variant="destructive"
                onPress={() => removeMember && doRemove(removeMember)}
                loading={busy}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },

  section: { gap: Spacing.two },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.one },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoActions: { gap: Spacing.two, alignItems: 'flex-start' },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  logoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  logoRemove: { paddingHorizontal: Spacing.two },
  logoRemoveText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
  },
  slug: { fontSize: FontSize.sm },
  errorText: { fontSize: FontSize.sm },
  saveBtn: { marginTop: Spacing.one, alignSelf: 'flex-start', minWidth: 140 },

  membersHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  inviteText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  memberName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  memberEmail: { fontSize: FontSize.sm, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  pill: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  // Dialogs / sheets
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dialogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  center: { textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  roleChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: Spacing.two,
  },
  sheetTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sheetLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  roleOptionText: { fontSize: FontSize.md, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
});
