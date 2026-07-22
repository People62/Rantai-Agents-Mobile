/**
 * Composer — shared message input for Home (new conversation) and ChatThread.
 *
 * Contains: "+" button (tools bottom sheet), attachments, text field, and send
 * button. All tool selections are returned via onSend so the calling screen
 * can just forward them to the backend.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import {
  Braces,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  LayoutGrid,
  LucideIcon,
  Paperclip,
  Plus,
  ScanLine,
  Send,
  SendHorizontal,
  Sparkles,
  SquareTerminal,
  Type,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Input } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { getSkills, Skill, uploadAttachment } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

/** Tool selections sent along with a message. */
export interface ComposerOptions {
  enableWebSearch: boolean;
  enableCodeInterpreter: boolean;
  enabledToolNames: string[];
  enabledSkillIds: string[];
  canvasMode?: string;
  fileContext?: string;
}

/**
 * Built-in tools that can be selected (names must match the backend BUILTIN_TOOLS).
 * web_search & code_interpreter have their own rows, so they are not here.
 */
const SELECTABLE_TOOLS: Array<{ name: string; label: string; desc: string; icon: LucideIcon }> = [
  { name: 'calculator', label: 'Calculator', desc: 'Evaluate math expressions', icon: Calculator },
  { name: 'date_time', label: 'Date & Time', desc: 'Current date & time', icon: Clock },
  { name: 'document_analysis', label: 'Document Analysis', desc: 'Analyze document contents', icon: FileText },
  { name: 'json_transform', label: 'JSON Transform', desc: 'Transform JSON data', icon: Braces },
  { name: 'ocr_document', label: 'OCR Document', desc: 'Read text from images/scans', icon: ScanLine },
  { name: 'text_utilities', label: 'Text Utilities', desc: 'Text processing utilities', icon: Type },
  { name: 'customer_lookup', label: 'Customer Lookup', desc: 'Look up customer data', icon: Users },
  { name: 'channel_dispatch', label: 'Send via Channel', desc: 'Send through a channel', icon: Send },
];

/**
 * Canvas artifact types. Values MUST match the backend ARTIFACT_TYPES exactly
 * (MIME-like) — sending "html" instead of "text/html" makes the tool rejected.
 */
export const ARTIFACT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'text/html', label: 'HTML Page' },
  { value: 'application/react', label: 'React Component' },
  { value: 'image/svg+xml', label: 'SVG Graphic' },
  { value: 'application/mermaid', label: 'Mermaid Diagram' },
  { value: 'text/markdown', label: 'Markdown' },
  { value: 'text/document', label: 'Document' },
  { value: 'application/code', label: 'Code' },
  { value: 'application/sheet', label: 'Spreadsheet' },
  { value: 'text/latex', label: 'LaTeX / Math' },
  { value: 'application/slides', label: 'Slides' },
  { value: 'application/python', label: 'Python Notebook' },
  { value: 'application/3d', label: '3D Scene' },
];

/** Base row layout in the bottom sheet (icon + text + right element). */
function ToolRowBase({
  icon: Icon,
  label,
  description,
  highlight,
  disabled,
  onPress,
  right,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  highlight?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const theme = useTheme();
  const tint = highlight && !disabled ? theme.accent : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.toolRow, { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      <View
        style={[
          styles.toolIcon,
          { backgroundColor: highlight && !disabled ? `${theme.accent}1A` : theme.backgroundElement },
        ]}>
        <Icon color={tint} size={20} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.toolLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.toolDesc, { color: theme.textSecondary }]} numberOfLines={1}>
          {description}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

/** Tool row rendered as an on/off switch. */
function ToolToggleRow(props: {
  icon: LucideIcon;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <ToolRowBase
      icon={props.icon}
      label={props.label}
      description={props.description}
      highlight={props.value}
      onPress={() => props.onValueChange(!props.value)}
      right={
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
          thumbColor="#fff"
        />
      }
    />
  );
}

type ComposerProps = {
  placeholder: string;
  /** Used to associate attachments with a session. Home has no session yet → may be empty. */
  sessionId?: string;
  /** Managed by the caller: true while waiting for a reply. */
  sending?: boolean;
  /** Error message from the caller (e.g. send failed). */
  error?: string | null;
  /** Quote of the message being replied to (reply feature). */
  replyingTo?: { id: string; content: string } | null;
  onCancelReply?: () => void;
  /** Throwing an error → the text is restored so it can be retried. */
  onSend: (content: string, options: ComposerOptions) => Promise<void> | void;
};

export function Composer({
  placeholder,
  sessionId,
  sending,
  error,
  replyingTo,
  onCancelReply,
  onSend,
}: ComposerProps) {
  const theme = useTheme();
  const { token } = useAuth();

  const [text, setText] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [codeInterpreter, setCodeInterpreter] = useState(false);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [toolsMode, setToolsMode] = useState<'auto' | 'off'>('auto');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);
  const [skillsMode, setSkillsMode] = useState<'auto' | 'off'>('auto');
  const [canvasMode, setCanvasMode] = useState<string>('');
  const [attachment, setAttachment] = useState<{ name: string; text?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sheetView, setSheetView] = useState<'main' | 'tools' | 'skills' | 'canvas'>('main');

  const sheet = useRef<BottomSheetModal>(null);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />
    ),
    [],
  );

  const activeToolNames = toolsMode === 'off' ? [] : enabledTools;
  const activeSkillIds = skillsMode === 'off' ? [] : enabledSkills;
  const anyTool =
    webSearch ||
    codeInterpreter ||
    !!attachment ||
    activeToolNames.length > 0 ||
    activeSkillIds.length > 0 ||
    canvasMode !== '';
  const canSend = text.trim().length > 0 && !sending;
  const shownError = error ?? localError;
  const canvasLabel =
    canvasMode === ''
      ? 'Off'
      : canvasMode === 'auto'
        ? 'Auto (AI decides)'
        : (ARTIFACT_TYPES.find((t) => t.value === canvasMode)?.label ?? canvasMode);

  function toggleTool(name: string) {
    setEnabledTools((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  }
  function toggleSkill(id: string) {
    setEnabledSkills((p) => (p.includes(id) ? p.filter((s) => s !== id) : [...p, id]));
  }

  /** Load the skill list once, when the Skills sub-menu is first opened. */
  async function openSkillsView() {
    setSheetView('skills');
    if (!token || skills.length > 0 || skillsLoading) return;
    setSkillsLoading(true);
    try {
      setSkills(await getSkills(token));
    } catch {
      // leave empty — the UI shows "no skills available"
    } finally {
      setSkillsLoading(false);
    }
  }

  async function pickAndUpload() {
    if (!token || uploading) return;
    sheet.current?.dismiss();
    setLocalError(null);
    try {
      const [file] = await pick({ type: [types.allFiles] });
      if (!file?.uri) return;
      setUploading(true);
      const uploaded = await uploadAttachment(token, sessionId ?? '', {
        uri: file.uri,
        name: file.name ?? 'attachment',
        type: file.type ?? 'application/octet-stream',
      });
      setAttachment({ name: file.name ?? 'attachment', text: uploaded.text });
      if (uploaded.type === 'rag' && !uploaded.text) {
        setLocalError('Large file saved, but its contents cannot be read directly yet.');
      }
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      setLocalError('Failed to upload attachment. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    setLocalError(null);
    try {
      await onSend(content, {
        enableWebSearch: webSearch,
        enableCodeInterpreter: codeInterpreter,
        enabledToolNames: activeToolNames,
        enabledSkillIds: activeSkillIds,
        canvasMode: canvasMode || undefined,
        fileContext: attachment?.text,
      });
      setAttachment(null); // attachment applies to a single message
    } catch {
      setText(content); // restore so it can be retried
    }
  }

  return (
    <View>
      {shownError ? (
        <Text style={[styles.error, { color: theme.destructive }]}>{shownError}</Text>
      ) : null}

      {/* Quote of the message being replied to */}
      {replyingTo ? (
        <View style={styles.attachWrap}>
          <View
            style={[
              styles.replyChip,
              { backgroundColor: theme.backgroundElement, borderLeftColor: theme.accent },
            ]}>
            <View style={styles.flex}>
              <Text style={[styles.replyLabel, { color: theme.accent }]}>Replying</Text>
              <Text style={[styles.replyText, { color: theme.textSecondary }]} numberOfLines={2}>
                {replyingTo.content}
              </Text>
            </View>
            <Pressable onPress={onCancelReply} hitSlop={8}>
              <X color={theme.textSecondary} size={16} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {attachment || uploading ? (
        <View style={styles.attachWrap}>
          <View
            style={[
              styles.attachChip,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            {uploading ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <Paperclip color={theme.accent} size={16} />
            )}
            <Text style={[styles.attachName, { color: theme.text }]} numberOfLines={1}>
              {uploading ? 'Uploading…' : attachment?.name}
            </Text>
            {!uploading ? (
              <Pressable onPress={() => setAttachment(null)} hitSlop={8}>
                <X color={theme.textSecondary} size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.inputBar, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => {
            setSheetView('main');
            sheet.current?.present();
          }}
          style={({ pressed }) => [
            styles.plusBtn,
            {
              backgroundColor: anyTool ? `${theme.accent}1A` : theme.backgroundElement,
              borderColor: anyTool ? theme.accent : theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Plus color={anyTool ? theme.accent : theme.textSecondary} size={22} />
        </Pressable>

        <View style={styles.flex}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            onSubmitEditing={submit}
            returnKeyType="send"
            editable={!sending}
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: theme.accent,
              opacity: !canSend ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}>
          {sending ? (
            <ActivityIndicator color={theme.accentForeground} size="small" />
          ) : (
            <SendHorizontal color={theme.accentForeground} size={20} />
          )}
        </Pressable>
      </View>

      {/* Bottom sheet: tools, skills, canvas, attachment */}
      <BottomSheetModal
        ref={sheet}
        snapPoints={['60%', '90%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: theme.card }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: 40 }}>
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {sheetView === 'main' ? (
            <>
              <Text style={[styles.sheetHeading, { color: theme.text }]}>Tools</Text>
              <ToolRowBase
                icon={Paperclip}
                label="Attach file"
                description={attachment ? attachment.name : 'PDF, images, text, documents'}
                highlight={!!attachment}
                disabled={uploading}
                onPress={pickAndUpload}
                right={uploading ? <ActivityIndicator color={theme.accent} size="small" /> : null}
              />
              <ToolToggleRow
                icon={Globe}
                label="Web Search"
                description="Search the web for the latest information"
                value={webSearch}
                onValueChange={setWebSearch}
              />
              <ToolToggleRow
                icon={SquareTerminal}
                label="Code Interpreter"
                description="Run code in a sandbox"
                value={codeInterpreter}
                onValueChange={setCodeInterpreter}
              />
              <ToolRowBase
                icon={Wrench}
                label="Tools"
                description={
                  toolsMode === 'off' ? 'Off' : `Auto (${enabledTools.length}/${SELECTABLE_TOOLS.length})`
                }
                highlight={activeToolNames.length > 0}
                onPress={() => setSheetView('tools')}
                right={<ChevronRight color={theme.textSecondary} size={20} />}
              />
              <ToolRowBase
                icon={Zap}
                label="Skills"
                description={
                  skillsMode === 'off'
                    ? 'Off'
                    : `Auto (${enabledSkills.length}${skills.length ? `/${skills.length}` : ''})`
                }
                highlight={activeSkillIds.length > 0}
                onPress={openSkillsView}
                right={<ChevronRight color={theme.textSecondary} size={20} />}
              />
              <ToolRowBase
                icon={LayoutGrid}
                label="Canvas"
                description={canvasLabel}
                highlight={canvasMode !== ''}
                onPress={() => setSheetView('canvas')}
                right={<ChevronRight color={theme.textSecondary} size={20} />}
              />
            </>
          ) : sheetView === 'tools' ? (
            <>
              <View style={styles.sheetHeaderRow}>
                <Pressable onPress={() => setSheetView('main')} hitSlop={8}>
                  <ChevronLeft color={theme.text} size={22} />
                </Pressable>
                <Text style={[styles.sheetHeading, { color: theme.text }]}>Tools</Text>
              </View>
              <ToolRowBase
                icon={Zap}
                label="Auto"
                description="Use the selected tools"
                highlight={toolsMode === 'auto'}
                onPress={() => setToolsMode('auto')}
                right={toolsMode === 'auto' ? <Check color={theme.accent} size={20} /> : null}
              />
              <ToolRowBase
                icon={X}
                label="Off"
                description="Turn off all tools"
                highlight={toolsMode === 'off'}
                onPress={() => setToolsMode('off')}
                right={toolsMode === 'off' ? <Check color={theme.accent} size={20} /> : null}
              />
              <Text style={[styles.sheetSection, { color: theme.textSecondary }]}>Select tools</Text>
              {SELECTABLE_TOOLS.map((t) => {
                const on = enabledTools.includes(t.name);
                return (
                  <ToolRowBase
                    key={t.name}
                    icon={t.icon}
                    label={t.label}
                    description={t.desc}
                    highlight={on && toolsMode !== 'off'}
                    disabled={toolsMode === 'off'}
                    onPress={() => toggleTool(t.name)}
                    right={
                      <View
                        style={[
                          styles.check,
                          {
                            borderColor: on ? theme.accent : theme.border,
                            backgroundColor: on ? theme.accent : 'transparent',
                          },
                        ]}>
                        {on ? <Check color={theme.accentForeground} size={14} /> : null}
                      </View>
                    }
                  />
                );
              })}
            </>
          ) : sheetView === 'skills' ? (
            <>
              <View style={styles.sheetHeaderRow}>
                <Pressable onPress={() => setSheetView('main')} hitSlop={8}>
                  <ChevronLeft color={theme.text} size={22} />
                </Pressable>
                <Text style={[styles.sheetHeading, { color: theme.text }]}>Skills</Text>
              </View>
              <ToolRowBase
                icon={Zap}
                label="Auto"
                description="Use the selected skills"
                highlight={skillsMode === 'auto'}
                onPress={() => setSkillsMode('auto')}
                right={skillsMode === 'auto' ? <Check color={theme.accent} size={20} /> : null}
              />
              <ToolRowBase
                icon={X}
                label="Off"
                description="Turn off all skills"
                highlight={skillsMode === 'off'}
                onPress={() => setSkillsMode('off')}
                right={skillsMode === 'off' ? <Check color={theme.accent} size={20} /> : null}
              />
              <Text style={[styles.sheetSection, { color: theme.textSecondary }]}>Select skills</Text>
              {skillsLoading ? (
                <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.three }} />
              ) : skills.length === 0 ? (
                <Text style={[styles.toolDesc, { color: theme.textSecondary }]}>
                  No skills available.
                </Text>
              ) : (
                skills.map((s) => {
                  const on = enabledSkills.includes(s.id);
                  return (
                    <ToolRowBase
                      key={s.id}
                      icon={Sparkles}
                      label={s.displayName}
                      description={s.description}
                      highlight={on && skillsMode !== 'off'}
                      disabled={skillsMode === 'off'}
                      onPress={() => toggleSkill(s.id)}
                      right={
                        <View
                          style={[
                            styles.check,
                            {
                              borderColor: on ? theme.accent : theme.border,
                              backgroundColor: on ? theme.accent : 'transparent',
                            },
                          ]}>
                          {on ? <Check color={theme.accentForeground} size={14} /> : null}
                        </View>
                      }
                    />
                  );
                })
              )}
            </>
          ) : (
            <>
              <View style={styles.sheetHeaderRow}>
                <Pressable onPress={() => setSheetView('main')} hitSlop={8}>
                  <ChevronLeft color={theme.text} size={22} />
                </Pressable>
                <Text style={[styles.sheetHeading, { color: theme.text }]}>Canvas</Text>
              </View>
              <ToolRowBase
                icon={X}
                label="Off"
                description="No artifact"
                highlight={canvasMode === ''}
                onPress={() => setCanvasMode('')}
                right={canvasMode === '' ? <Check color={theme.accent} size={20} /> : null}
              />
              <ToolRowBase
                icon={Zap}
                label="Auto"
                description="AI decides the artifact type"
                highlight={canvasMode === 'auto'}
                onPress={() => setCanvasMode('auto')}
                right={canvasMode === 'auto' ? <Check color={theme.accent} size={20} /> : null}
              />
              <Text style={[styles.sheetSection, { color: theme.textSecondary }]}>Artifact Type</Text>
              {ARTIFACT_TYPES.map((t) => {
                const on = canvasMode === t.value;
                return (
                  <ToolRowBase
                    key={t.value}
                    icon={LayoutGrid}
                    label={t.label}
                    description={t.value}
                    highlight={on}
                    onPress={() => setCanvasMode(t.value)}
                    right={on ? <Check color={theme.accent} size={20} /> : null}
                  />
                );
              })}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { fontSize: FontSize.sm, textAlign: 'center', paddingTop: Spacing.two },
  attachWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
  },
  replyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  replyText: { fontSize: FontSize.sm },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  attachName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flexShrink: 1 },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.one,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sheetHeading: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.two },
  sheetSection: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  toolDesc: { fontSize: FontSize.sm },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
