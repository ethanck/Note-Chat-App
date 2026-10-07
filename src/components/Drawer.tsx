import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, shadows } from '../theme/theme';
import { TabKey } from '../types';
import { useAppStore } from '../store/AppStore';
import { AppIcon, IconButton } from './Ui';

export const Drawer = ({
  visible,
  onClose,
  activeChatId,
  onSelectChat,
  onNavigate,
  onOpenSettings,
}: {
  visible: boolean;
  onClose: () => void;
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onNavigate: (tab: TabKey) => void;
  onOpenSettings: () => void;
}) => {
  const { data, createChat, toggleChatFavorite, toggleChatPin } = useAppStore();
  const [query, setQuery] = useState('');
  const chats = useMemo(
    () =>
      data.chats
        .filter((chat) => !chat.isArchived && chat.title.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.localeCompare(a.updatedAt)),
    [data.chats, query],
  );

  const navigate = (tab: TabKey) => {
    onNavigate(tab);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View style={styles.brandMark}><AppIcon name="sparkles" size={20} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Note App Chat</Text>
              <Text style={styles.brandSub}>Your thinking workspace</Text>
            </View>
            <IconButton icon="close" onPress={onClose} color={colors.textMuted} accessibilityLabel="Close menu" />
          </View>

          <TextInput value={query} onChangeText={setQuery} placeholder="Search chats" placeholderTextColor={colors.textFaint} style={styles.search} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.chatHeader}>
              <Text style={styles.groupLabel}>RECENT CHATS</Text>
              <Pressable onPress={() => { const id = createChat(); onSelectChat(id); onClose(); }} style={styles.newChatButton}>
                <AppIcon name="add" size={16} color={colors.primary} />
                <Text style={styles.newChatText}>New</Text>
              </Pressable>
            </View>
            {chats.slice(0, 5).map((chat) => (
              <Pressable key={chat.id} onPress={() => { onSelectChat(chat.id); onClose(); }} style={[styles.chatRow, chat.id === activeChatId && styles.chatRowActive]}>
                <View style={[styles.chatDot, chat.id === activeChatId && styles.chatDotActive]}><AppIcon name="chatbubble-ellipses-outline" size={16} color={chat.id === activeChatId ? colors.primary : colors.textMuted} /></View>
                <Text numberOfLines={1} style={[styles.chatTitle, chat.id === activeChatId && styles.chatTitleActive]}>{chat.title}</Text>
                <Pressable onPress={() => toggleChatPin(chat.id)} hitSlop={8}><AppIcon name={chat.isPinned ? 'pin' : 'pin-outline'} size={15} color={chat.isPinned ? colors.primary : colors.textFaint} /></Pressable>
                <Pressable onPress={() => toggleChatFavorite(chat.id)} hitSlop={8}><AppIcon name={chat.isFavorite ? 'star' : 'star-outline'} size={15} color={chat.isFavorite ? colors.peach : colors.textFaint} /></Pressable>
              </Pressable>
            ))}
            {!chats.length && <Text style={styles.noChats}>No chats match your search.</Text>}

            <View style={styles.divider} />
            <Text style={styles.groupLabel}>WORKSPACE</Text>
            <MenuRow icon="document-text" label="Notes" prominent onPress={() => navigate('notes')} />
            <MenuRow icon="school" label="Quizzes" prominent onPress={() => navigate('quizzes')} />
            <MenuRow icon="create" label="Notebook" prominent onPress={() => navigate('notebook')} />

            <View style={styles.divider} />
            <Text style={styles.groupLabel}>MORE</Text>
            <MenuRow icon="archive-outline" label="Archived chats" onPress={() => onClose()} />
            <MenuRow icon="settings-outline" label="Settings" onPress={() => { onClose(); onOpenSettings(); }} />
          </ScrollView>
          <View style={styles.drawerFooter}>
            <View style={styles.accountAvatar}><Text style={styles.avatarText}>E</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.accountName}>Local workspace</Text><Text style={styles.accountSub}>ChatGPT connection in Settings</Text></View>
            <AppIcon name="chevron-forward" size={16} color={colors.textFaint} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const MenuRow = ({ icon, label, prominent, onPress }: { icon: string; label: string; prominent?: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.menuRow, prominent && styles.menuRowProminent]}>
    <View style={[styles.menuIcon, prominent && styles.menuIconProminent]}><AppIcon name={icon} size={prominent ? 20 : 18} color={prominent ? colors.primary : colors.textMuted} /></View>
    <Text style={[styles.menuLabel, prominent && styles.menuLabelProminent]}>{label}</Text>
    <AppIcon name="chevron-forward" size={15} color={colors.textFaint} />
  </Pressable>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  drawer: { width: '86%', maxWidth: 390, backgroundColor: colors.background, paddingTop: 56, ...shadows },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 22 },
  brandMark: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  brand: { color: colors.text, fontSize: 17, fontWeight: '800' },
  brandSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  search: { height: 44, marginHorizontal: 20, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.text, fontSize: 14 },
  scroll: { padding: 20, paddingBottom: 28 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupLabel: { color: colors.textFaint, fontWeight: '800', fontSize: 10, letterSpacing: 1.1 },
  newChatButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5 },
  newChatText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  chatRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 9, paddingHorizontal: 10, borderRadius: 13, marginBottom: 3 },
  chatRowActive: { backgroundColor: colors.primarySoft },
  chatDot: { width: 29, height: 29, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  chatDotActive: { backgroundColor: '#FFFFFF' },
  chatTitle: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chatTitleActive: { color: colors.primaryDark, fontWeight: '800' },
  noChats: { color: colors.textFaint, fontSize: 12, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 45, paddingHorizontal: 8, borderRadius: 14, marginTop: 4 },
  menuRowProminent: { backgroundColor: colors.surface, minHeight: 58, paddingHorizontal: 12, ...shadows },
  menuIcon: { width: 30, alignItems: 'center' },
  menuIconProminent: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  menuLabel: { flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  menuLabelProminent: { color: colors.text, fontSize: 15, fontWeight: '800' },
  drawerFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  accountAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#6F421D', fontWeight: '900' },
  accountName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  accountSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
});
