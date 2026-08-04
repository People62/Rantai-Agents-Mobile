/**
 * AdminChannel — configure one communication channel: enable it, set it as the
 * primary, and edit its credentials. PORTAL (built-in web chat) has no config.
 * PUT /api/mobile/admin/channels.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Eye, EyeOff, Star } from 'lucide-react-native';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Button, Input, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { ApiError, updateAdminChannel } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { AdminStackParamList } from '@/navigation/types';
import { CHANNEL_FIELDS, channelLabel } from './admin-utils';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminChannel'>;

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

export function AdminChannelScreen({ route, navigation }: Props) {
  const { channel } = route.params;
  const theme = useTheme();
  const { token } = useAuth();
  const fields = CHANNEL_FIELDS[channel.channel] ?? [];

  const [enabled, setEnabled] = useState(channel.enabled);
  const [isPrimary, setIsPrimary] = useState(channel.isPrimary);
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const src = (channel.config ?? {}) as Record<string, unknown>;
    for (const f of fields) init[f.key] = src[f.key] != null ? String(src[f.key]) : '';
    return init;
  });
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    const cfg: Record<string, unknown> = {};
    for (const f of fields) {
      const v = config[f.key]?.trim();
      if (!v) continue;
      cfg[f.key] = f.keyboard === 'numeric' && !Number.isNaN(Number(v)) ? Number(v) : v;
    }
    try {
      await updateAdminChannel(token, {
        channel: channel.channel,
        enabled,
        isPrimary,
        config: cfg,
      });
      navigation.goBack();
    } catch (e) {
      setError(apiMessage(e, 'Failed to save. Try again.'));
      setSaving(false);
    }
  }, [token, saving, fields, config, channel.channel, enabled, isPrimary, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: channelLabel(channel.channel),
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={theme.accent} style={{ marginRight: Spacing.two }} />
        ) : (
          <Pressable
            onPress={save}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Save channel"
            style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.one }}>
            <Text style={{ color: theme.accent, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
              Save
            </Text>
          </Pressable>
        ),
    });
  }, [navigation, save, saving, theme, channel.channel]);

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Enabled */}
          <View style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>Enabled</Text>
              <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>
                Accept conversations from this channel.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              disabled={channel.channel === 'PORTAL'}
              trackColor={{ true: theme.accent, false: theme.border }}
              thumbColor={theme.accentForeground}
            />
          </View>

          {/* Primary */}
          {isPrimary ? (
            <View style={[styles.primaryRow, { backgroundColor: `${theme.accent}14`, borderColor: theme.accent }]}>
              <Star color={theme.accent} size={16} fill={theme.accent} />
              <Text style={[styles.primaryText, { color: theme.accent }]}>Primary channel</Text>
            </View>
          ) : (
            <Button
              label="Set as primary"
              variant="secondary"
              leftIcon={<Star color={theme.text} size={16} />}
              onPress={() => setIsPrimary(true)}
            />
          )}

          {/* Credential fields */}
          {fields.length ? (
            <View style={styles.fields}>
              {fields.map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  value={config[f.key] ?? ''}
                  onChangeText={(t) => setConfig((p) => ({ ...p, [f.key]: t }))}
                  keyboardType={f.keyboard === 'numeric' ? 'numeric' : f.keyboard === 'email-address' ? 'email-address' : 'default'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={f.secret && !reveal[f.key]}
                  rightElement={
                    f.secret ? (
                      <Pressable
                        onPress={() => setReveal((p) => ({ ...p, [f.key]: !p[f.key] }))}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={reveal[f.key] ? 'Hide' : 'Show'}>
                        {reveal[f.key] ? (
                          <EyeOff color={theme.textSecondary} size={18} />
                        ) : (
                          <Eye color={theme.textSecondary} size={18} />
                        )}
                      </Pressable>
                    ) : undefined
                  }
                />
              ))}
            </View>
          ) : (
            <Text style={[styles.noConfig, { color: theme.textSecondary }]}>
              This channel has no configuration — just enable it.
            </Text>
          )}

          {error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  toggleLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  toggleHint: { fontSize: FontSize.sm, marginTop: Spacing.half },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  primaryText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  fields: { gap: Spacing.three },
  noConfig: { fontSize: FontSize.base, lineHeight: 20 },
  error: { fontSize: FontSize.sm },
});
