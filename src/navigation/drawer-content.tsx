/**
 * DrawerContent — custom sidebar content, mirroring the RantAI Agents web sidebar:
 * logo header + menu list (DrawerItemList) + profile & log-out footer.
 */
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { MessageCircle, Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Logo } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { ChatSessionSummary, getChatSessions } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from './auth-context';

export function DrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const { user, token } = useAuth();
  const displayName = user?.name || user?.email || 'User';

  const [recent, setRecent] = useState<ChatSessionSummary[]>([]);
  const drawerStatus = useDrawerStatus();

  // Refresh the recent-chats list each time the drawer opens.
  useEffect(() => {
    if (!token || drawerStatus !== 'open') return;
    let active = true;
    getChatSessions(token)
      .then((s) => active && setRecent(s.slice(0, 6)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, drawerStatus]);

  function openThread(s: ChatSessionSummary) {
    props.navigation.navigate('ChatTab', {
      screen: 'ChatThread',
      params: { id: s.id, title: s.title },
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header logo */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Logo width={40} />
        <Text style={[styles.brand, { color: theme.text }]}>RantAI Agents</Text>
      </View>

      {/* Menu list + recent chats */}
      <DrawerContentScrollView {...props} contentContainerStyle={styles.items}>
        <DrawerItemList {...props} />

        {recent.length ? (
          <View style={styles.recent}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.recentLabel, { color: theme.textSecondary }]}>Recent</Text>
            {recent.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => openThread(s)}
                style={({ pressed }) => [
                  styles.recentRow,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <MessageCircle color={theme.textSecondary} size={16} />
                <Text style={[styles.recentText, { color: theme.text }]} numberOfLines={1}>
                  {s.title || 'Untitled'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </DrawerContentScrollView>

      {/* Profile → Settings footer */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => props.navigation.navigate('Settings')}
          style={({ pressed }) => [
            styles.profile,
            { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
          ]}>
          <Avatar name={displayName} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
          <View style={styles.settingsBtn}>
            <Settings color={theme.textSecondary} size={20} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  items: { paddingTop: Spacing.two },
  recent: { marginTop: Spacing.two, paddingHorizontal: Spacing.three },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: Spacing.three, marginHorizontal: Spacing.one },
  recentLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
    marginLeft: Spacing.two,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  recentText: { flex: 1, fontSize: FontSize.base },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  email: { fontSize: FontSize.xs },
  settingsBtn: { padding: Spacing.two, borderRadius: Radius.md },
});
