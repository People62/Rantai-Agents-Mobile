/**
 * MessageContent — renders a chat message, splitting fenced code blocks
 * (```lang … ```) out of the prose into the shared CodeBlock viewer instead of
 * leaving raw ``` text inside the bubble.
 *
 * Plain-text messages take a fast path that renders exactly like before.
 */
import { StyleSheet, Text, View } from 'react-native';

import { CodeBlock } from '@/components/ui';
import { FontSize, Spacing } from '@/constants/theme';

/** One fenced code block matched as ```lang\n…```. */
const FENCE_RE = /```([^\n`]*)\n?([\s\S]*?)```/g;

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
});
