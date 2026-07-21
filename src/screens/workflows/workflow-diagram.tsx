/**
 * WorkflowDiagram — a read-only visual of the workflow graph. Nodes are placed
 * at their React Flow (x/y) coordinates and connected by SVG edges. Pinch to
 * zoom, drag to pan, double-tap (or the Reset button) to fit again.
 *
 * This is a viewer only — there is no editing (the visual builder stays on web).
 */
import { useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import type { WorkflowEdge, WorkflowNode } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { nodeAccent, nodeLabel, nodeType } from './workflow-utils';

const NODE_W = 150;
const NODE_H = 56;
const PAD = 40;
const VIEWPORT_H = 380;

type Props = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export function WorkflowDiagram({ nodes, edges }: Props) {
  const theme = useTheme();

  const layout = useMemo(() => {
    const laid = nodes.map((n, i) => ({
      node: n,
      x: n.position?.x ?? 0,
      y: n.position?.y ?? i * 120,
    }));
    if (!laid.length) {
      return { placed: [], edges: [], width: 0, height: 0 };
    }
    const minX = Math.min(...laid.map((l) => l.x));
    const minY = Math.min(...laid.map((l) => l.y));
    const maxX = Math.max(...laid.map((l) => l.x));
    const maxY = Math.max(...laid.map((l) => l.y));

    const placed = laid.map((l) => ({
      node: l.node,
      left: l.x - minX + PAD,
      top: l.y - minY + PAD,
    }));
    const pos = new Map(placed.map((p) => [p.node.id, p]));

    const width = maxX - minX + NODE_W + PAD * 2;
    const height = maxY - minY + NODE_H + PAD * 2;

    const drawn = edges
      .map((e) => {
        const s = pos.get(e.source);
        const t = pos.get(e.target);
        if (!s || !t) return null;
        const sx = s.left + NODE_W / 2;
        const sy = s.top + NODE_H;
        const tx = t.left + NODE_W / 2;
        const ty = t.top;
        const my = (sy + ty) / 2;
        const path = `M ${sx} ${sy} C ${sx} ${my} ${tx} ${my} ${tx} ${ty}`;
        // Arrowhead at the target. Edges enter a node from the top, so it points down.
        const ah = 7;
        const a = Math.PI / 2;
        const a1x = tx - ah * Math.cos(a - Math.PI / 6);
        const a1y = ty - ah * Math.sin(a - Math.PI / 6);
        const a2x = tx - ah * Math.cos(a + Math.PI / 6);
        const a2y = ty - ah * Math.sin(a + Math.PI / 6);
        return { path, arrow: `${tx},${ty} ${a1x},${a1y} ${a2x},${a2y}`, key: `${e.source}-${e.target}` };
      })
      .filter((e): e is NonNullable<typeof e> => !!e);

    return { placed, edges: drawn, width, height };
  }, [nodes, edges]);

  // Fit-to-width initial scale.
  const viewportW = Dimensions.get('window').width - Spacing.four * 2;
  const fit = layout.width > 0 ? Math.min(1, viewportW / layout.width) : 1;

  const scale = useSharedValue(fit);
  const savedScale = useSharedValue(fit);
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
      const next = savedScale.value * e.scale;
      scale.value = Math.min(3, Math.max(0.3, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  function reset() {
    scale.value = withTiming(fit);
    savedScale.value = fit;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    stx.value = 0;
    sty.value = 0;
  }

  if (!layout.placed.length) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.backgroundElement }]}>
        <Text style={{ color: theme.textSecondary, fontSize: FontSize.base }}>
          No graph to display.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.viewport,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.canvasWrap, animStyle]}>
          <View style={{ width: layout.width, height: layout.height }}>
            <Svg
              width={layout.width}
              height={layout.height}
              style={StyleSheet.absoluteFill}>
              {layout.edges.map((e) => (
                <Path key={e.key} d={e.path} stroke={theme.textSecondary} strokeWidth={1.5} fill="none" />
              ))}
              {layout.edges.map((e) => (
                <Polygon key={`${e.key}-a`} points={e.arrow} fill={theme.textSecondary} />
              ))}
            </Svg>
            {layout.placed.map((p) => {
              const type = nodeType(p.node);
              const color = nodeAccent(type, theme);
              return (
                <View
                  key={p.node.id}
                  style={[
                    styles.node,
                    {
                      left: p.left,
                      top: p.top,
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                    },
                  ]}>
                  <View style={[styles.nodeBar, { backgroundColor: color }]} />
                  <View style={styles.nodeBody}>
                    <Text style={[styles.nodeLabel, { color: theme.text }]} numberOfLines={2}>
                      {nodeLabel(p.node)}
                    </Text>
                    <Text style={[styles.nodeType, { color: theme.textSecondary }]} numberOfLines={1}>
                      {type}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>

      <Pressable
        onPress={reset}
        style={[styles.reset, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.resetText, { color: theme.text }]}>Reset</Text>
      </Pressable>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>Pinch to zoom · drag to pan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 120,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: {
    height: VIEWPORT_H,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  canvasWrap: {
    // Scale/translate anchored at the top-left so pan math stays predictable.
    transformOrigin: 'top left',
  },
  node: {
    position: 'absolute',
    width: NODE_W,
    height: NODE_H,
    flexDirection: 'row',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  nodeBar: { width: 4 },
  nodeBody: { flex: 1, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, justifyContent: 'center' },
  nodeLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  nodeType: { fontSize: 10, marginTop: 1 },
  reset: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  resetText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  hint: {
    position: 'absolute',
    bottom: Spacing.two,
    left: Spacing.three,
    fontSize: FontSize.xs,
  },
});
