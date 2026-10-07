import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TabKey } from '../types';
import { AppIcon } from './Ui';
import { colors, radii } from '../theme/theme';

const items: { key: Exclude<TabKey, 'chat'>; label: string; icon: string }[] = [
  { key: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { key: 'quizzes', label: 'Quizzes', icon: 'school-outline' },
  { key: 'notebook', label: 'Notebook', icon: 'create-outline' },
];

export const BottomNav = ({ active, onChange }: { active: Exclude<TabKey, 'chat'>; onChange: (key: Exclude<TabKey, 'chat'>) => void }) => (
  <View style={styles.container}>
    {items.map((item) => {
      const selected = active === item.key;
      return (
        <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.item}>
          <View style={[styles.iconWrap, selected && styles.iconWrapActive]}>
            <AppIcon name={selected ? item.icon.replace('-outline', '') : item.icon} size={21} color={selected ? colors.primary : colors.textMuted} />
          </View>
          <Text style={[styles.label, selected && styles.labelActive]}>{item.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, paddingBottom: 10 },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { minWidth: 48, height: 29, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  labelActive: { color: colors.primaryDark },
});
