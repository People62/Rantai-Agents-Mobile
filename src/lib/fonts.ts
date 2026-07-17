/**
 * Apply Poppins to the ENTIRE app without changing every component.
 *
 * RN 0.86 (React 19) exports Text/TextInput as function components (not
 * forwardRef), so `Text.render` cannot be patched. Instead we redefine the
 * `Text`/`TextInput` properties on the react-native module object with wrapped
 * versions that inject the Poppins fontFamily based on fontWeight. Because Metro
 * accesses `reactNative.Text` per usage, the whole app (including navigation
 * headers & libraries) also uses Poppins.
 *
 * An explicit fontFamily (e.g. mono for code) is still respected.
 * Import this module once, as early as possible (see index.js).
 */
import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (moduleName: string) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RN: Record<string, any> = require('react-native');

const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'Poppins-Light',
  '200': 'Poppins-Light',
  '300': 'Poppins-Light',
  '400': 'Poppins-Regular',
  normal: 'Poppins-Regular',
  '500': 'Poppins-Medium',
  '600': 'Poppins-SemiBold',
  '700': 'Poppins-Bold',
  bold: 'Poppins-Bold',
  '800': 'Poppins-Bold',
  '900': 'Poppins-Bold',
};

function withPoppins(style: unknown): unknown {
  const flat = (StyleSheet.flatten(style as TextStyle) ?? {}) as TextStyle;
  // Respect an explicit fontFamily (e.g. Fonts.mono for code blocks).
  if (flat.fontFamily) return style;
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = FAMILY_BY_WEIGHT[weight] ?? 'Poppins-Regular';
  return [{ fontFamily }, style];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapWithPoppins(Original: any) {
  // ref is passed via props (React 19 treats ref as a regular prop).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Wrapped = (props: any) =>
    React.createElement(Original, { ...props, style: withPoppins(props.style) });
  Wrapped.displayName = `Poppins(${Original?.displayName ?? 'Component'})`;
  return Wrapped;
}

for (const name of ['Text', 'TextInput'] as const) {
  const Original = RN[name];
  if (!Original) continue;
  const Wrapped = wrapWithPoppins(Original);
  try {
    Object.defineProperty(RN, name, {
      configurable: true,
      enumerable: true,
      get: () => Wrapped,
    });
  } catch {
    // leave the default if the property cannot be redefined
  }
}
