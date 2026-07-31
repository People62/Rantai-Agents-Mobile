/**
 * MessageContent — renders a chat message, splitting fenced code blocks
 * (```lang … ```) out of the prose into a dedicated, editor-like CodeBlock
 * (monospace surface, line numbers, language label, copy button, horizontal
 * scroll) instead of leaving raw ``` text inside the bubble.
 *
 * Plain-text messages take a fast path that renders exactly like before.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BorderWidth, Fonts, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CODE_LINE_HEIGHT = 20;

/** One fenced code block matched as ```lang\n…```. */
const FENCE_RE = /```([^\n`]*)\n?([\s\S]*?)```/g;

// ── Lightweight syntax tokenizer (Python / JS-TS-leaning, dependency-free) ──
// Ordered alternation: comment, string, decorator, number, keyword, function,
// identifier, whitespace, punctuation. The matched capture group → token kind.
type TokenKind = 'com' | 'str' | 'dec' | 'num' | 'kw' | 'fn' | 'txt';
type Span = { text: string; kind: TokenKind };

const TOKEN_RE =
  /(#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(@[A-Za-z_][\w.]*)|(\b\d[\w.]*\b)|(\b(?:def|class|return|if|elif|else|for|while|import|from|as|in|not|and|or|is|None|True|False|lambda|try|except|finally|with|yield|pass|break|continue|global|nonlocal|raise|assert|del|await|async|const|let|var|function|new|typeof|instanceof|export|default|extends|super|this|null|undefined|void|switch|case|do|throw|catch|of)\b)|(\b[A-Za-z_]\w*(?=\s*\())|(\b[A-Za-z_]\w*\b)|(\s+)|([^\s\w]+)/g;

/** Turn source into typed spans (whitespace/identifiers/punctuation → 'txt'). */
function tokenize(code: string): Span[] {
  const spans: Span[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    const kind: TokenKind = m[1]
      ? 'com'
      : m[2]
        ? 'str'
        : m[3]
          ? 'dec'
          : m[4]
            ? 'num'
            : m[5]
              ? 'kw'
              : m[6]
                ? 'fn'
                : 'txt';
    spans.push({ text: m[0], kind });
    if (m.index === TOKEN_RE.lastIndex) TOKEN_RE.lastIndex++; // zero-width guard
  }
  return spans;
}

/** Split spans on newlines so each source line renders as its own <Text> row. */
function splitLines(spans: Span[]): Span[][] {
  const lines: Span[][] = [[]];
  for (const sp of spans) {
    const parts = sp.text.split('\n');
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: sp.kind });
    });
  }
  return lines;
}

type Segment = { type: 'text'; value: string } | { type: 'code'; lang: string; value: string };

/** Split a message into alternating prose / fenced-code segments. */
function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  FENCE_RE.lastIndex = 0;
  while ((match = FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).replace(/^\n+|\n+$/g, '');
      if (text) segments.push({ type: 'text', value: text });
    }
    segments.push({
      type: 'code',
      lang: (match[1] || '').trim(),
      value: match[2].replace(/\n$/, ''),
    });
    lastIndex = FENCE_RE.lastIndex;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).replace(/^\n+|\n+$/g, '');
    if (text) segments.push({ type: 'text', value: text });
  }

  if (segments.length === 0) segments.push({ type: 'text', value: content });
  return segments;
}

/** Editor-like read-only viewer for one fenced code block. */
export function CodeBlock({ language, code }: { language?: string; code: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => splitLines(tokenize(code)), [code]);

  const kindColor: Record<TokenKind, string> = {
    com: theme.codeComment,
    str: theme.codeString,
    dec: theme.codeDecorator,
    num: theme.codeNumber,
    kw: theme.codeKeyword,
    fn: theme.codeFunction,
    txt: theme.codeText,
  };

  function copy() {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={[styles.codeWrap, { backgroundColor: theme.codeSurface, borderColor: theme.border }]}>
      <View style={[styles.codeHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.codeLang, { color: theme.textSecondary }]}>{language || 'code'}</Text>
        <Pressable
          onPress={copy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Copy code"
          style={styles.copyBtn}>
          {copied ? (
            <Check color={theme.accent} size={14} />
          ) : (
            <Copy color={theme.textSecondary} size={14} />
          )}
          <Text style={[styles.copyText, { color: copied ? theme.accent : theme.textSecondary }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.codeBody}>
        {/* Fixed line-number gutter (doesn't scroll horizontally with the code). */}
        <View style={styles.gutter}>
          {lines.map((_, i) => (
            <Text key={i} style={[styles.lineNo, { color: theme.textSecondary }]}>
              {i + 1}
            </Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeScroll}>
          <View>
            {lines.map((spans, i) => (
              <Text key={i} style={styles.codeLine}>
                {spans.length ? (
                  spans.map((s, j) => (
                    <Text key={j} style={{ color: kindColor[s.kind] }}>
                      {s.text}
                    </Text>
                  ))
                ) : (
                  <Text style={{ color: theme.codeText }}> </Text>
                )}
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export function MessageContent({ content, color }: { content: string; color: string }) {
  const segments = parseSegments(content);

  // Fast path: no code → render a single Text, identical to the old bubble.
  if (segments.length === 1 && segments[0].type === 'text') {
    return <Text style={{ color, fontSize: FontSize.md }}>{segments[0].value}</Text>;
  }

  return (
    <View style={styles.segments}>
      {segments.map((seg, i) =>
        seg.type === 'code' ? (
          <CodeBlock key={i} language={seg.lang} code={seg.value} />
        ) : (
          <Text key={i} style={{ color, fontSize: FontSize.md }}>
            {seg.value}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { gap: Spacing.two },
  codeWrap: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    borderWidth: BorderWidth.regular,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeLang: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: Fonts.mono },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  copyText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  codeBody: { flexDirection: 'row', paddingVertical: Spacing.two },
  gutter: { paddingLeft: Spacing.three, paddingRight: Spacing.two, alignItems: 'flex-end' },
  lineNo: { fontSize: FontSize.sm, lineHeight: CODE_LINE_HEIGHT, fontFamily: Fonts.mono, opacity: 0.6 },
  codeScroll: { paddingRight: Spacing.three, paddingLeft: Spacing.one },
  codeLine: { fontSize: FontSize.sm, lineHeight: CODE_LINE_HEIGHT, fontFamily: Fonts.mono },
});
