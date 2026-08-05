/**
 * AdminUsersTab — platform user directory (GET /api/mobile/admin/users).
 * Server-side search + role/suspended filters; tap a row to manage a user;
 * a modal creates a new user (optionally returning a generated password).
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserPlus, Users, Search, Copy } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { Button, EmptyState } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AdminStackParamList } from '@/navigation/types';
import { AdminUser, createAdminUser, getAdminUsers } from '@/lib/api';

type RoleFilter = 'ALL' | 'USER' | 'ADMIN';

const ROLE_FILTERS: Array<{ label: string; value: RoleFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Users', value: 'USER' },
  { label: 'Admins', value: 'ADMIN' },
];

export function AdminUsersTab({
  navigation,
}: {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminHome'>;
}) {
  const theme = useTheme();
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [suspendedOnly, setSuspendedOnly] = useState(false);

  // Create-user modal state.
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const page = await getAdminUsers(token, {
        search: query.trim() || undefined,
        role: role === 'ALL' ? undefined : role,
        suspended: suspendedOnly ? true : undefined,
      });
      setUsers(page.users);
    } catch {
      setError('Failed to load users. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token, query, role, suspendedOnly]);

  // Debounce search / filter changes into a single fetch.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      load();
      return;
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const resetForm = () => {
    setEmail('');
    setName('');
    setPassword('');
    setNewIsAdmin(false);
    setFormError(null);
    setGeneratedPassword(null);
  };

  const submitCreate = async () => {
    if (!token || !email.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await createAdminUser(token, {
        email: email.trim(),
        name: name.trim() || undefined,
        password: password.trim() || undefined,
        role: newIsAdmin ? 'ADMIN' : 'USER',
      });
      if (res.generatedPassword) {
        setGeneratedPassword(res.generatedPassword);
      } else {
        setCreating(false);
        resetForm();
      }
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <Pressable
        style={styles.centered}
        onPress={() => {
          setLoading(true);
          load();
        }}>
        <Text style={[styles.muted, { color: theme.destructive }]}>{error}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Search color={theme.textSecondary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or email…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <View style={styles.chipsRow}>
          {ROLE_FILTERS.map((f) => {
            const active = role === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setRole(f.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.backgroundElement,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? theme.accentForeground : theme.textSecondary },
                  ]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setSuspendedOnly((v) => !v)}
            style={[
              styles.chip,
              {
                backgroundColor: suspendedOnly ? theme.destructive : theme.backgroundElement,
                borderColor: suspendedOnly ? theme.destructive : theme.border,
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                { color: suspendedOnly ? '#FFFFFF' : theme.textSecondary },
              ]}>
              Suspended
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={users.length ? styles.list : styles.emptyWrap}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <EmptyState
              icon={query || role !== 'ALL' || suspendedOnly ? Search : Users}
              title={query || role !== 'ALL' || suspendedOnly ? 'No results' : 'No users'}
              subtitle={
                query || role !== 'ALL' || suspendedOnly
                  ? 'No users match your filter.'
                  : 'Platform users appear here.'
              }
            />
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('AdminUserDetail', { id: item.id })}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.name?.trim() || item.email}
                </Text>
                {item.role === 'ADMIN' ? (
                  <View style={[styles.tag, { backgroundColor: `${theme.accent}22` }]}>
                    <Text style={[styles.tagText, { color: theme.accent }]}>Admin</Text>
                  </View>
                ) : null}
                {item.suspendedAt ? (
                  <View style={[styles.tag, { backgroundColor: `${theme.destructive}22` }]}>
                    <Text style={[styles.tagText, { color: theme.destructive }]}>Suspended</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.email}
                {item.organizations.length
                  ? ` · ${item.organizations.length} org${item.organizations.length === 1 ? '' : 's'}`
                  : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <View style={[styles.fabWrap, { borderTopColor: theme.border }]}>
        <Button
          label="New user"
          leftIcon={<UserPlus color={theme.primaryForeground} size={18} />}
          onPress={() => {
            resetForm();
            setCreating(true);
          }}
        />
      </View>

      <Modal
        visible={creating}
        transparent
        animationType="slide"
        onRequestClose={() => setCreating(false)}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setCreating(false)}>
            <Pressable
              style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>New user</Text>

              {generatedPassword ? (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    User created. Share this one-time password — it won't be shown again.
                  </Text>
                  <Pressable
                    onPress={() => Clipboard.setString(generatedPassword)}
                    accessibilityRole="button"
                    accessibilityLabel="Copy generated password"
                    style={[
                      styles.passwordBox,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.passwordText, { color: theme.text }]} selectable>
                      {generatedPassword}
                    </Text>
                    <Copy color={theme.textSecondary} size={18} />
                  </Pressable>
                  <Button
                    label="Done"
                    onPress={() => {
                      setCreating(false);
                      resetForm();
                    }}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="user@example.com"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  />

                  <Text style={[styles.label, { color: theme.textSecondary }]}>Name (optional)</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  />

                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Password (optional — generated if blank)
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Leave blank to auto-generate"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  />

                  <Pressable
                    onPress={() => setNewIsAdmin((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: newIsAdmin }}
                    accessibilityLabel="Grant platform admin"
                    style={[
                      styles.adminToggle,
                      {
                        backgroundColor: newIsAdmin ? `${theme.accent}22` : theme.backgroundElement,
                        borderColor: newIsAdmin ? theme.accent : theme.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.adminToggleText,
                        { color: newIsAdmin ? theme.accent : theme.text },
                      ]}>
                      Platform admin
                    </Text>
                  </Pressable>

                  {formError ? (
                    <Text style={[styles.errorText, { color: theme.destructive }]}>{formError}</Text>
                  ) : null}

                  <View style={styles.formActions}>
                    <Button
                      label="Cancel"
                      variant="outline"
                      onPress={() => setCreating(false)}
                      style={styles.flex}
                    />
                    <Button
                      label="Create"
                      onPress={submitCreate}
                      loading={saving}
                      disabled={!email.trim()}
                      style={styles.flex}
                    />
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
  },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  toolbar: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    marginHorizontal: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  row: { paddingVertical: Spacing.three, borderRadius: Radius.lg },
  rowText: { gap: Spacing.half, marginHorizontal: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, flexShrink: 1 },
  tag: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  meta: { fontSize: FontSize.xs },
  sep: { height: StyleSheet.hairlineWidth },
  fabWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Create modal
  sheetBackdrop: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
  sheet: {
    padding: Spacing.four,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: Spacing.two,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.one },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    fontSize: FontSize.md,
  },
  adminToggle: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  adminToggleText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
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
  errorText: { fontSize: FontSize.sm },
  formActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
