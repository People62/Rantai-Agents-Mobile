import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontSize, FontWeight, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: FontSize.base,
    lineHeight: 20,
    fontWeight: FontWeight.medium,
  },
  smallBold: {
    fontSize: FontSize.base,
    lineHeight: 20,
    fontWeight: FontWeight.bold,
  },
  default: {
    fontSize: FontSize.lg,
    lineHeight: 24,
    fontWeight: FontWeight.medium,
  },
  title: {
    fontSize: 48,
    fontWeight: FontWeight.semibold,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: FontWeight.semibold,
  },
  link: {
    lineHeight: 30,
    fontSize: FontSize.base,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: FontSize.base,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: FontWeight.bold }) ?? FontWeight.medium,
    fontSize: FontSize.xs,
  },
});
