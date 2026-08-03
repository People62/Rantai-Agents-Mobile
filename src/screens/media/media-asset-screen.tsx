/**
 * MediaAsset — full view of one generated asset. Images show full-screen; audio
 * plays in-app. Favorite, save an image to the device gallery, reuse an image
 * as a generation reference, or delete.
 */
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Download, ImageUp, Pause, Play, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';

import { Button, Screen } from '@/components/ui';
import { Scrim, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  MediaAsset,
  deleteMediaAsset,
  favoriteMediaAsset,
  getMediaAsset,
  mediaFileSource,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { MediaStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaAsset'>;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function MediaAssetScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();
  const { token } = useAuth();

  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Audio player state
  const [paused, setPaused] = useState(true);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) return;
      try {
        const a = await getMediaAsset(token, id);
        if (active) setAsset(a);
      } catch {
        if (active) setAsset(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, id]);

  async function toggleFavorite() {
    if (!token || !asset || busy) return;
    setBusy(true);
    try {
      const updated = await favoriteMediaAsset(token, asset.id, !asset.isFavorite);
      setAsset((prev) => (prev ? { ...prev, isFavorite: updated.isFavorite } : prev));
    } catch {
      Alert.alert('Failed', 'Could not update favorite.');
    } finally {
      setBusy(false);
    }
  }

  async function saveToGallery() {
    if (!token || !asset || busy) return;
    setBusy(true);
    try {
      if (Platform.OS === 'android' && Platform.Version < 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
      }
      // The proxy needs a Bearer header, so download the bytes to a local file
      // first (CameraRoll can't attach auth headers to a remote URL).
      const src = mediaFileSource(token, asset.id, true);
      const ext = asset.mimeType.split('/')[1]?.split(';')[0] ?? 'png';
      const localPath = `${RNFS.CachesDirectoryPath}/${asset.id}.${ext}`;
      await RNFS.downloadFile({ fromUrl: src.uri, toFile: localPath }).promise;
      await CameraRoll.save(`file://${localPath}`, { type: 'photo' });
      Alert.alert('Saved', 'Image saved to your gallery.');
    } catch {
      Alert.alert('Save failed', 'Could not save the image to your gallery.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAudio() {
    if (!token || !asset || busy) return;
    setBusy(true);
    try {
      const src = mediaFileSource(token, asset.id, true);
      const ext = asset.mimeType.split('/')[1]?.split(';')[0] ?? 'wav';
      const dir =
        Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      await RNFS.downloadFile({ fromUrl: src.uri, toFile: `${dir}/rantai-${asset.id}.${ext}` })
        .promise;
      Alert.alert(
        'Saved',
        Platform.OS === 'android'
          ? 'Audio saved to your Downloads folder.'
          : 'Audio saved to the Files app.',
      );
    } catch {
      Alert.alert('Save failed', 'Could not save the audio.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!token || !asset || busy) return;
    setBusy(true);
    try {
      await deleteMediaAsset(token, asset.id);
      setDeleteOpen(false);
      navigation.goBack();
    } catch {
      Alert.alert('Failed', 'Could not delete the asset.');
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

  if (!asset) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={{ color: theme.destructive, fontSize: FontSize.base }}>Asset not found.</Text>
        </View>
      </Screen>
    );
  }

  const isImage = asset.modality === 'IMAGE';

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {isImage ? (
          <Image
            source={mediaFileSource(token!, asset.id)}
            style={[
              styles.image,
              { backgroundColor: theme.backgroundElement },
              asset.width && asset.height ? { aspectRatio: asset.width / asset.height } : null,
            ]}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.audioBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Video
              source={mediaFileSource(token!, asset.id)}
              paused={paused}
              onLoad={(d) => setDur(d.duration)}
              onProgress={(p) => setPos(p.currentTime)}
              onEnd={() => {
                setPaused(true);
                setPos(0);
              }}
              style={styles.hiddenVideo}
              ignoreSilentSwitch="ignore"
            />
            <Pressable
              onPress={() => setPaused((p) => !p)}
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Play audio' : 'Pause audio'}
              style={[styles.playBtn, { backgroundColor: theme.accent }]}>
              {paused ? <Play color={theme.accentForeground} size={30} /> : <Pause color={theme.accentForeground} size={30} />}
            </Pressable>
            <View style={styles.progressWrap}>
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View
                  style={[styles.progressFill, { backgroundColor: theme.accent, width: dur ? `${(pos / dur) * 100}%` : '0%' }]}
                />
              </View>
              <View style={styles.times}>
                <Text style={[styles.time, { color: theme.textSecondary }]}>{fmt(pos)}</Text>
                <Text style={[styles.time, { color: theme.textSecondary }]}>{fmt(dur)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Prompt */}
        {asset.job?.prompt ? (
          <Text style={[styles.prompt, { color: theme.textSecondary }]}>{asset.job.prompt}</Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <Action
            icon={<Star color={asset.isFavorite ? theme.accent : theme.text} size={22} fill={asset.isFavorite ? theme.accent : 'transparent'} />}
            label={asset.isFavorite ? 'Favorited' : 'Favorite'}
            onPress={toggleFavorite}
            theme={theme}
          />
          <Action
            icon={<Download color={theme.text} size={22} />}
            label="Save"
            onPress={isImage ? saveToGallery : saveAudio}
            theme={theme}
          />
          {isImage ? (
            <Action
              icon={<ImageUp color={theme.text} size={22} />}
              label="Reference"
              onPress={() => navigation.navigate('MediaGenerate', { referenceAssetId: asset.id })}
              theme={theme}
            />
          ) : null}
          <Action icon={<Trash2 color={theme.destructive} size={22} />} label="Delete" onPress={() => setDeleteOpen(true)} theme={theme} destructive />
        </View>
      </ScrollView>

      {/* Delete confirmation */}
      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (busy ? undefined : setDeleteOpen(false))}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setDeleteOpen(false))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.dangerIcon, { backgroundColor: `${theme.destructive}1A` }]}>
              <Trash2 color={theme.destructive} size={26} />
            </View>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>Delete asset?</Text>
            <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>
              This asset will be permanently deleted. This action cannot be undone.
            </Text>
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setDeleteOpen(false)}
                disabled={busy}
                style={styles.flex}
              />
              <Button
                label="Delete"
                variant="destructive"
                onPress={confirmDelete}
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

function Action({
  icon,
  label,
  onPress,
  theme,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      {icon}
      <Text style={[styles.actionLabel, { color: destructive ? theme.destructive : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.four, gap: Spacing.four },
  image: { width: '100%', aspectRatio: 1, borderRadius: Radius.md },
  audioBox: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  hiddenVideo: { width: 0, height: 0 },
  playBtn: { width: 64, height: 64, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  progressWrap: { alignSelf: 'stretch', gap: Spacing.one },
  progressTrack: { height: 4, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: Radius.full },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: FontSize.xs },
  prompt: { fontSize: FontSize.base, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.two },
  action: { alignItems: 'center', gap: Spacing.one, minWidth: 64 },
  actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  // Delete confirmation dialog
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
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMessage: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
});
