import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useAppStore } from './src/store/AppStore';
import { BottomNav } from './src/components/BottomNav';
import { Drawer } from './src/components/Drawer';
import { colors } from './src/theme/theme';
import { TabKey } from './src/types';
import { ChatScreen } from './src/screens/ChatScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const AppShell = () => {
  const { data, ready, activeChat, createChat } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeChatId, setActiveChatId] = useState(activeChat.id);

  useEffect(() => {
    if (data.chats.some((chat) => chat.id === activeChatId)) return;
    setActiveChatId(data.chats[0]?.id || createChat());
  }, [data.chats, activeChatId, createChat]);

  if (!ready) {
    return <View style={styles.loading}><View style={styles.loadingMark}><Text style={styles.loadingSparkle}>✦</Text></View><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Preparing your local workspace…</Text></View>;
  }

  const goTo = (tab: TabKey) => setActiveTab(tab);
  const bottomTab = activeTab === 'chat' ? 'notes' : activeTab;

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {activeTab === 'chat' && <ChatScreen chatId={activeChatId} onOpenDrawer={() => setDrawerVisible(true)} />}
        {activeTab === 'notes' && <NotesScreen onOpenDrawer={() => setDrawerVisible(true)} />}
        {activeTab === 'quizzes' && <QuizScreen onOpenDrawer={() => setDrawerVisible(true)} />}
        {activeTab === 'notebook' && <NotebookScreen onOpenDrawer={() => setDrawerVisible(true)} />}
      </View>
      {activeTab !== 'chat' && <BottomNav active={bottomTab as Exclude<TabKey, 'chat'>} onChange={setActiveTab} />}
      <Drawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} activeChatId={activeChatId} onSelectChat={(id) => { setActiveChatId(id); setActiveTab('chat'); }} onNavigate={goTo} onOpenSettings={() => setSettingsVisible(true)} />
      <Modal visible={settingsVisible} animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <SafeAreaView style={styles.settingsSafe}><SettingsScreen onClose={() => setSettingsVisible(false)} /></SafeAreaView>
      </Modal>
    </View>
  );
};

export default function App() {
  return <SafeAreaView style={styles.safe}><AppProvider><AppShell /></AppProvider></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  settingsSafe: { flex: 1, backgroundColor: colors.surface },
  app: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingMark: { width: 66, height: 66, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  loadingSparkle: { color: '#FFFFFF', fontSize: 32 },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
