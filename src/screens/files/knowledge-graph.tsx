/**
 * KnowledgeGraph — a read-only view of a document's entities (nodes) and
 * relations (edges), placed in a circular layout. Pinch to zoom, drag to pan.
 */
import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import type { KnowledgeEntity, KnowledgeRelation } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

const TYPE_COLORS = ['#3b82f6', '#8b5cf6', '#16a34a', '#d97706', '#0d9488', '#ec4899', '#ef4444', '#eab308'];

function colorForType(type: string): string {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return TYPE_COLORS[h % TYPE_COLORS.length];
}

type Props = { entities: KnowledgeEntity[]; relations: KnowledgeRelation[] };

export function KnowledgeGraph({ entities, relations }: Props) {
  const theme = useTheme();

  const layout = useMemo(() => {
    const n = entities.length;
    if (!n) return { nodes: [], edges: [], size: 0 };
    const R = Math.max(110, n * 20);
    const pad = 60;
    const size = (R + pad) * 2;
    const cx = size / 2;
    const cy = size / 2;
    const nodes = entities.map((e, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { e, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    const byId = new Map(nodes.map((nd) => [nd.e.id, nd]));
    const edges = relations
      .map((r) => {
        const s = byId.get(r.in);
        const t = byId.get(r.out);
        return s && t ? { s, t, key: r.id } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { nodes, edges, size };
  }, [entities, relations]);

  const viewportW = Dimensions.get('window').width - Spacing.four * 2;
  const fit = layout.size > 0 ? Math.min(1, viewportW / layout.size) : 1;

  const scale = useSharedValue(fit);
  const saved = useSharedValue(fit);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const stx = useSharedValue(0);
  const sty = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = stx.value + e.translationX;
      ty.value = sty.value + e.translationY;
    })
    .onEnd(() => {
      stx.value = tx.value;
      sty.value = ty.value;
    });
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(3, Math.max(0.3, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
    });
  const composed = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  function reset() {
    scale.value = withTiming(fit);
    saved.value = fit;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    stx.value = 0;
    sty.value = 0;
  }

  if (!layout.nodes.length) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.backgroundElement }]}>
        <Text style={{ color: theme.textSecondary, fontSize: FontSize.base }}>No graph data.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.viewport, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvas, animStyle]}>
          <Svg width={layout.size} height={layout.size}>
            {layout.edges.map((e) => (
              <Line
                key={e.key}
                x1={e.s.x}
                y1={e.s.y}
                x2={e.t.x}
                y2={e.t.y}
                stroke={theme.textSecondary}
                strokeWidth={1}
                opacity={0.5}
              />
            ))}
            {layout.nodes.map((nd) => (
              <Circle key={nd.e.id} cx={nd.x} cy={nd.y} r={7} fill={colorForType(nd.e.type)} />
            ))}
            {layout.nodes.map((nd) => (
              <SvgText
                key={`${nd.e.id}-t`}
                x={nd.x}
                y={nd.y - 11}
                fill={theme.text}
                fontSize={11}
                textAnchor="middle">
                {nd.e.name.length > 16 ? `${nd.e.name.slice(0, 15)}…` : nd.e.name}
              </SvgText>
            ))}
          </Svg>
        </Animated.View>
      </GestureDetector>
      <Text onPress={reset} style={[styles.reset, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}>
        Reset
      </Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>Pinch to zoom · drag to pan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { height: 120, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  viewport: { height: 360, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  canvas: { transformOrigin: 'top left' },
  reset: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    fontSize: FontSize.xs,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  hint: { position: 'absolute', bottom: Spacing.two, left: Spacing.three, fontSize: FontSize.xs },
});
