/**
 * MediaGenerate — the studio. Pick a modality (image/audio), model, prompt and
 * parameters, then generate. Generation is synchronous, so on success we jump
 * straight to the finished asset.
 */
import { pick, types } from '@react-native-documents/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronDown, ImagePlus, Sparkles, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  GenerateMediaInput,
  MediaModality,
  MediaModel,
  generateMedia,
  getMediaModels,
  mediaFileSource,
  uploadMediaReference,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';
import type { MediaStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaGenerate'>;

const ASPECT_RATIOS: Array<{ label: string; w: number; h: number }> = [
  { label: '1:1', w: 1024, h: 1024 },
  { label: '16:9', w: 1280, h: 720 },
  { label: '9:16', w: 720, h: 1280 },
  { label: '4:3', w: 1024, h: 768 },
];
const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/** Style presets — chips that append a hint to the prompt (mirrors the web). */
const STYLE_PRESETS: Record<'IMAGE' | 'AUDIO', Array<{ id: string; label: string; icon: string }>> = {
  IMAGE: [
    { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
    { id: 'photoreal', label: 'Photo Real', icon: '📷' },
    { id: 'anime', label: 'Anime', icon: '🌸' },
    { id: 'watercolor', label: 'Watercolor', icon: '🎨' },
    { id: '3d', label: '3D Render', icon: '🧊' },
    { id: 'sketch', label: 'Sketch', icon: '✏️' },
    { id: 'oil', label: 'Oil Paint', icon: '🖼️' },
    { id: 'cyberpunk', label: 'Cyberpunk', icon: '⚡' },
  ],
  AUDIO: [
    { id: 'ambient', label: 'Ambient', icon: '🌊' },
    { id: 'cinematic', label: 'Cinematic', icon: '🎻' },
    { id: 'electronic', label: 'Electronic', icon: '🎹' },
    { id: 'lofi', label: 'Lo-Fi', icon: '☕' },
    { id: 'orchestral', label: 'Orchestral', icon: '🎼' },
    { id: 'jazz', label: 'Jazz', icon: '🎷' },
    { id: 'vocal', label: 'Vocal', icon: '🎤' },
  ],
};

const STYLE_SUFFIX: Record<string, string> = {
  cinematic: 'cinematic lighting, dramatic composition',
  photoreal: 'photorealistic, sharp focus, ultra detailed',
  anime: 'anime style, studio ghibli inspired',
  watercolor: 'watercolor painting, soft edges',
  '3d': '3d render, octane, ray-traced',
  sketch: 'pencil sketch, hand-drawn',
  oil: 'oil painting, thick brush strokes',
  cyberpunk: 'cyberpunk, neon lights, futuristic',
  ambient: 'ambient soundscape, atmospheric',
  electronic: 'electronic, synthesized',
  lofi: 'lo-fi, vinyl warmth',
  orchestral: 'orchestral arrangement, full ensemble',
  jazz: 'smooth jazz, brushed drums',
  vocal: 'vocal performance',
};

export function MediaGenerateScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [modality, setModality] = useState<MediaModality>('IMAGE');
  const [prompt, setPrompt] = useState('');
  const [models, setModels] = useState<MediaModel[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [ratio, setRatio] = useState(ASPECT_RATIOS[0]);
  const [count, setCount] = useState(1);
  const [voice, setVoice] = useState('alloy');
  const [style, setStyle] = useState<string | null>(null);
  const [references, setReferences] = useState<string[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-add a reference passed from an asset's "use as reference".
  useEffect(() => {
    const ref = route.params?.referenceAssetId;
    if (ref) {
      setModality('IMAGE');
      setReferences((prev) => (prev.includes(ref) ? prev : [...prev, ref]));
    }
  }, [route.params?.referenceAssetId]);

  // Load models whenever the modality changes.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) return;
      try {
        const list = await getMediaModels(token, modality);
        if (!active) return;
        setModels(list);
        setModelId((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0]?.id ?? null));
      } catch {
        if (active) setModels([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, modality]);

  const addReference = useCallback(async () => {
    if (!token) return;
    try {
      const [file] = await pick({ type: [types.images], allowMultiSelection: false });
      if (!file?.uri) return;
      const { assetId } = await uploadMediaReference(token, {
        uri: file.uri,
        name: file.name ?? 'image.png',
        type: file.type ?? 'image/png',
      });
      setReferences((prev) => (prev.length >= 4 ? prev : [...prev, assetId]));
    } catch (e) {
      // The picker throws on user cancel; ignore that, surface real failures.
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'DOCUMENT_PICKER_CANCELED') return;
      Alert.alert('Upload failed', 'Could not add the reference image.');
    }
  }, [token]);

  async function generate() {
    if (!token || !modelId || !prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    // Style presets are prompt hints, not provider params (same as the web).
    const styledPrompt = style
      ? `${prompt.trim()}, ${STYLE_SUFFIX[style] ?? style}`
      : prompt.trim();
    const input: GenerateMediaInput = {
      modality,
      modelId,
      prompt: styledPrompt,
      parameters:
        modality === 'IMAGE'
          ? { width: ratio.w, height: ratio.h, count }
          : { voice },
      referenceAssetIds: modality === 'IMAGE' ? references : [],
    };
    try {
      const job = await generateMedia(token, input);
      if (job.status === 'SUCCEEDED' && job.assets.length) {
        navigation.navigate('MediaAsset', { id: job.assets[0].id });
      } else {
        setError(job.errorMessage || 'Generation did not return any output.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  const selectedModelName = models.find((m) => m.id === modelId)?.name ?? modelId ?? 'No model';
  const canGenerate = !!token && !!modelId && !!prompt.trim() && !generating;

  return (
    <Screen padded={false} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Modality toggle */}
          <View style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}>
            {(['IMAGE', 'AUDIO'] as const).map((m) => {
              const active = modality === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setModality(m);
                    setStyle(null);
                  }}
                  style={[styles.toggleBtn, active && { backgroundColor: theme.accent }]}>
                  <Text
                    style={[
                      styles.toggleText,
                      { color: active ? theme.accentForeground : theme.textSecondary },
                    ]}>
                    {m === 'IMAGE' ? 'Image' : 'Audio'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Prompt */}
          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Prompt</Text>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder={
                modality === 'IMAGE'
                  ? 'Describe the image you want…'
                  : 'Text for the voice to speak…'
              }
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                styles.textarea,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
          </View>

          {/* Model */}
          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Model</Text>
            <Pressable
              onPress={() => models.length && setPickerOpen(true)}
              style={[
                styles.input,
                styles.selectRow,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}>
              <Text style={[styles.selectText, { color: models.length ? theme.text : theme.textSecondary }]} numberOfLines={1}>
                {models.length ? selectedModelName : 'No models available'}
              </Text>
              <ChevronDown color={theme.textSecondary} size={18} />
            </Pressable>
          </View>

          {/* Style preset */}
          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Style preset <Text style={styles.optional}>(optional)</Text>
            </Text>
            <View style={styles.chips}>
              {STYLE_PRESETS[modality === 'IMAGE' ? 'IMAGE' : 'AUDIO'].map((p) => {
                const active = style === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setStyle((prev) => (prev === p.id ? null : p.id))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.accent : theme.backgroundElement,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>
                      {p.icon} {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Params */}
          {modality === 'IMAGE' ? (
            <>
              <View>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Aspect ratio</Text>
                <View style={styles.chips}>
                  {ASPECT_RATIOS.map((r) => {
                    const active = ratio.label === r.label;
                    return (
                      <Pressable
                        key={r.label}
                        onPress={() => setRatio(r)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.accent : theme.backgroundElement,
                            borderColor: active ? theme.accent : theme.border,
                          },
                        ]}>
                        <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Count</Text>
                <View style={styles.chips}>
                  {[1, 2, 3, 4].map((n) => {
                    const active = count === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setCount(n)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.accent : theme.backgroundElement,
                            borderColor: active ? theme.accent : theme.border,
                          },
                        ]}>
                        <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {/* Reference images */}
              <View>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Reference images <Text style={styles.optional}>(optional)</Text>
                </Text>
                <View style={styles.refRow}>
                  {references.map((id) => (
                    <View key={id} style={styles.refThumb}>
                      <Image source={mediaFileSource(token!, id)} style={styles.refImg} />
                      <Pressable
                        onPress={() => setReferences((prev) => prev.filter((r) => r !== id))}
                        style={[styles.refRemove, { backgroundColor: theme.destructive }]}>
                        <X color="#fff" size={12} />
                      </Pressable>
                    </View>
                  ))}
                  {references.length < 4 ? (
                    <Pressable
                      onPress={addReference}
                      style={[styles.refAdd, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                      <ImagePlus color={theme.textSecondary} size={22} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </>
          ) : (
            <View>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Voice</Text>
              <View style={styles.chips}>
                {VOICES.map((v) => {
                  const active = voice === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setVoice(v)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.accent : theme.backgroundElement,
                          borderColor: active ? theme.accent : theme.border,
                        },
                      ]}>
                      <Text style={[styles.chipText, { color: active ? theme.accentForeground : theme.textSecondary }]}>
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}

          <Button
            label={generating ? 'Generating…' : 'Generate'}
            leftIcon={!generating ? <Sparkles color={theme.primaryForeground} size={18} /> : undefined}
            onPress={generate}
            loading={generating}
            disabled={!canGenerate}
            style={styles.generateBtn}
          />
          {generating ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              This can take a little while — keep the screen open.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Model picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Choose a model</Text>
            <FlatList
              data={models}
              keyExtractor={(m) => m.id}
              style={styles.sheetList}
              ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setModelId(item.id);
                    setPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.sheetItem, pressed && { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.modelName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.modelProvider, { color: theme.textSecondary }]}>
                      {item.provider}
                      {item.isFree ? ' · Free' : ''}
                    </Text>
                  </View>
                  {item.id === modelId ? <Check color={theme.accent} size={18} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four },
  toggle: { flexDirection: 'row', borderRadius: Radius.full, padding: 3, alignSelf: 'center' },
  toggleBtn: { paddingHorizontal: Spacing.five, paddingVertical: Spacing.one + 2, borderRadius: Radius.full },
  toggleText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.two },
  optional: { fontWeight: FontWeight.regular },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: FontSize.md,
  },
  textarea: { minHeight: 100 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: FontSize.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  refRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  refThumb: { width: 64, height: 64 },
  refImg: { width: 64, height: 64, borderRadius: Radius.sm },
  refRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refAdd: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: FontSize.sm },
  generateBtn: { marginTop: Spacing.one },
  hint: { fontSize: FontSize.xs, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  sheetList: { flexGrow: 0 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  modelName: { fontSize: FontSize.md, fontWeight: FontWeight.medium },
  modelProvider: { fontSize: FontSize.sm },
  sep: { height: StyleSheet.hairlineWidth },
});
