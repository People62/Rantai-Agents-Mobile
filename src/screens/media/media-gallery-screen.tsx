/**
 * MediaGallery — the org's media library. Grid of image thumbnails and audio
 * tiles; filter by modality/favorites/search. Tap a tile to open its detail.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Music, Search, Star } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { MediaAsset, MediaModality, getMediaAssets, mediaFileSource } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { MediaStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaGallery'>;

const COLS = 3;
const FILTERS: Array<{ label: string; value: MediaModality | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Images', value: 'IMAGE' },
  { label: 'Audio', value: 'AUDIO' },
];

export function MediaGalleryScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MediaModality | 'ALL'>('ALL');
  const [favOnly, setFavOnly] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const { items } = await getMediaAssets(token, {
        modality: filter === 'ALL' ? undefined : filter,
        favorite: favOnly || undefined,
        q: query.trim() || undefined,
        limit: 60,
      });
      setAssets(items);
    } catch {
      setError('Failed to load the library. Tap to try again.');
    } finally {
      setLoading(false);
    }
  }, [token, filter, favOnly, query]);

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

  if (error) {
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

  return (
    <Screen padded={false} edges={['bottom']}>
      <View style={styles.filters}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Search color={theme.textSecondary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={load}
            placeholder="Search prompts…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? theme.accent : theme.backgroundElement, borderColor: active ? theme.accent : theme.border },
                ]}>
                <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>{f.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setFavOnly((v) => !v)}
            style={[
              styles.chip,
              styles.favChip,
              { backgroundColor: favOnly ? `${theme.accent}22` : theme.backgroundElement, borderColor: favOnly ? theme.accent : theme.border },
            ]}>
            <Star color={favOnly ? theme.accent : theme.textSecondary} size={13} fill={favOnly ? theme.accent : 'transparent'} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={assets}
        keyExtractor={(a) => a.id}
        numColumns={COLS}
        contentContainerStyle={assets.length ? styles.grid : styles.emptyWrap}
        columnWrapperStyle={styles.col}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing here yet</Text>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              Generated media will appear in your library.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('MediaAsset', { id: item.id })}
            style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {item.modality === 'IMAGE' ? (
              <Image source={mediaFileSource(token!, item.id)} style={styles.tileImg} resizeMode="cover" />
            ) : (
              <View style={styles.audioTile}>
                <Music color={theme.textSecondary} size={26} />
                <Text style={[styles.audioLabel, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.job?.prompt ?? 'Audio'}
                </Text>
              </View>
            )}
            {item.isFavorite ? (
              <View style={styles.favBadge}>
                <Star color="#fff" size={12} fill="#fff" />
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.four },
  emptyWrap: { flexGrow: 1 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  filters: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  chipRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  favChip: { paddingHorizontal: Spacing.two, marginLeft: 'auto' },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  grid: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one, gap: Spacing.two },
  col: { gap: Spacing.two },
  tile: {
    flex: 1 / COLS,
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  tileImg: { width: '100%', height: '100%' },
  audioTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.two },
  audioLabel: { fontSize: 10, textAlign: 'center' },
  favBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    padding: 3,
  },
});
