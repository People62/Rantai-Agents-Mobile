/**
 * DrawerContent — custom sidebar content, mirroring the RantAI Agents web sidebar:
 * logo header + menu list (DrawerItemList) + profile & log-out footer.
 */
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { LogOut } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Logo } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from './auth-context';

export function DrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const { signOut, user } = useAuth();
  const displayName = user?.name || user?.email || 'User';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header logo */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Logo width={40} />
        <Text style={[styles.brand, { color: theme.text }]}>RantAI Agents</Text>
      </View>

      {/* Menu list */}
      <DrawerContentScrollView {...props} contentContainerStyle={styles.items}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Profile + log-out footer */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View style={styles.profile}>
          <Avatar name={displayName} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
          <Pressable
            onPress={signOut}
            hitSlop={8}
            style={({ pressed }) => [
              styles.logout,
              { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
            ]}>
            <LogOut color={theme.textSecondary} size={20} />
          </Pressable>
        </View>
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  email: { fontSize: FontSize.xs },
  logout: { padding: Spacing.two, borderRadius: Radius.md },
});
