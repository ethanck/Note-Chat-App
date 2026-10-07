import { Platform } from 'react-native';

export const colors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F7',
  text: '#141522',
  textMuted: '#73778B',
  textFaint: '#A4A7B6',
  border: '#E6E8F0',
  primary: '#5E5CE6',
  primaryDark: '#4644C4',
  primarySoft: '#ECEBFF',
  purple: '#8C71FF',
  peach: '#FFB66E',
  mint: '#7ED8B0',
  sky: '#78B9FF',
  danger: '#D85C6E',
  dangerSoft: '#FFE9ED',
  success: '#23966B',
  successSoft: '#E3F7EE',
  overlay: 'rgba(20, 21, 34, 0.42)',
};

export const shadows = Platform.select({
  ios: {
    shadowColor: '#25244A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 4 },
  default: {},
});

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};
