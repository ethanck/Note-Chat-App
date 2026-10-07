import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows } from '../theme/theme';

export const AppIcon = ({ name, size = 20, color = colors.textMuted }: { name: string; size?: number; color?: string }) => (
  <Ionicons name={name as never} size={size} color={color} />
);

export const IconButton = ({
  icon,
  onPress,
  color = colors.text,
  size = 20,
  style,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.iconButton, style]}>
    <AppIcon name={icon} size={size} color={color} />
  </Pressable>
);

export const SearchField = ({ value, onChangeText, placeholder = 'Search' }: TextInputProps) => (
  <View style={styles.searchField}>
    <AppIcon name="search-outline" size={18} color={colors.textMuted} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      style={styles.searchInput}
      autoCapitalize="none"
    />
  </View>
);

export const Pill = ({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) => {
  const body = (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
};

export const Surface = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.surface, style]}>{children}</View>
);

export const EmptyState = ({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}><AppIcon name={icon} size={28} color={colors.primary} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {action}
  </View>
);

export const PrimaryButton = ({ label, onPress, icon, compact = false }: { label: string; onPress: () => void; icon?: string; compact?: boolean }) => (
  <Pressable onPress={onPress} style={[styles.primaryButton, compact && styles.primaryButtonCompact]}>
    {icon && <AppIcon name={icon} size={17} color="#FFFFFF" />}
    <Text style={styles.primaryButtonText}>{label}</Text>
  </Pressable>
);

export const SectionTitle = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) => (
  <View style={styles.sectionTitleRow}>
    <View>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {action}
  </View>
);

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  pillText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: colors.primaryDark },
  surface: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 18, ...shadows },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 70 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: 18, paddingVertical: 13, marginTop: 18 },
  primaryButtonCompact: { paddingVertical: 10, marginTop: 0 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 5 },
  sectionTitle: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
});
