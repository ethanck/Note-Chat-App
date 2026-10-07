import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, radii, shadows } from '../theme/theme';
import { Chat, ChatMessage } from '../types';
import { useAppStore } from '../store/AppStore';
import { AppIcon, IconButton, Pill } from '../components/Ui';
import { formatTime } from '../utils/text';

export const ChatScreen = ({
  chatId,
  onOpenDrawer,
}: {
  chatId: string;
  onOpenDrawer: () => void;
}) => {
  const { data, sendMessage, organizeChatToNotes, createChat, lastAction, clearLastAction } = useAppStore();
  const chat = data.chats.find((item) => item.id === chatId) || data.chats[0];
  const [input, setInput] = useState('');
  const [quickMode, setQuickMode] = useState(false);
  const [attachmentName, setAttachmentName] = useState<string>();
  const scrollRef = useRef<ScrollView>(null);

  const orderedMessages = useMemo(() => [...(chat?.messages || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [chat]);

  const submit = () => {
    if (!chat || !input.trim()) return;
    sendMessage(chat.id, quickMode ? `${input}\n\nPlease keep the response concise.` : input, attachmentName);
    setInput('');
    setAttachmentName(undefined);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const attachFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) setAttachmentName(result.assets[0].name);
  };

  if (!chat) return null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconButton icon="menu" onPress={onOpenDrawer} color={colors.text} accessibilityLabel="Open chat menu" />
          <View>
            <Text style={styles.kicker}>AI STUDY COMPANION</Text>
            <Text style={styles.title} numberOfLines={1}>{chat.title}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton icon="document-text-outline" onPress={() => organizeChatToNotes(chat.id)} color={colors.primary} accessibilityLabel="Add chat to notes" />
          <IconButton icon="ellipsis-horizontal" onPress={() => Alert.alert('Chat actions', 'Rename, archive, pin, and favorite are available from the chat drawer.')} color={colors.textMuted} accessibilityLabel="Chat actions" />
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messageContent} showsVerticalScrollIndicator={false}>
        {orderedMessages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}><AppIcon name="sparkles" size={30} color={colors.primary} /></View>
            <Text style={styles.welcomeTitle}>What are you learning today?</Text>
            <Text style={styles.welcomeBody}>Ask a question, share a conversation, or start a thought. I can turn it into organized notes when you are ready.</Text>
            <View style={styles.suggestionGrid}>
              <Suggestion label="Explain a concept" onPress={() => setInput('Explain a concept to me in a memorable way')} icon="bulb-outline" />
              <Suggestion label="Make a study plan" onPress={() => setInput('Help me make a study plan')} icon="calendar-outline" />
              <Suggestion label="Summarize this" onPress={() => setInput('Summarize the following idea: ')} icon="sparkles-outline" />
              <Suggestion label="Quiz me" onPress={() => setInput('Quiz me on this topic')} icon="school-outline" />
            </View>
          </View>
        ) : (
          orderedMessages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        {lastAction && (
          <Pressable onPress={clearLastAction} style={styles.actionToast}>
            <AppIcon name="checkmark-circle" size={17} color={colors.success} />
            <Text style={styles.actionToastText}>{lastAction}</Text>
            <AppIcon name="close" size={15} color={colors.textMuted} />
          </Pressable>
        )}
      </ScrollView>

      {attachmentName && (
        <View style={styles.attachmentPill}>
          <AppIcon name="attach" size={15} color={colors.primary} />
          <Text style={styles.attachmentText} numberOfLines={1}>{attachmentName}</Text>
          <Pressable onPress={() => setAttachmentName(undefined)}><AppIcon name="close-circle" size={16} color={colors.textMuted} /></Pressable>
        </View>
      )}
      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>Response style</Text>
        <View style={styles.modePills}>
          <Pill label="Quick" active={quickMode} onPress={() => setQuickMode(true)} />
          <Pill label="Advanced" active={!quickMode} onPress={() => setQuickMode(false)} />
        </View>
      </View>
      <View style={styles.composerWrap}>
        <IconButton icon="add-circle-outline" onPress={attachFile} color={colors.textMuted} accessibilityLabel="Attach file" />
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          placeholder="Ask anything..."
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={4000}
          style={styles.composer}
        />
        <Pressable onPress={submit} disabled={!input.trim()} style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}>
          <AppIcon name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>Your notes stay on this device. AI context is only shared when you ask for help.</Text>
    </KeyboardAvoidingView>
  );
};

const Suggestion = ({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.suggestion}>
    <AppIcon name={icon} size={17} color={colors.primary} />
    <Text style={styles.suggestionText}>{label}</Text>
  </Pressable>
);

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const user = message.role === 'user';
  return (
    <View style={[styles.messageRow, user && styles.messageRowUser]}>
      {!user && <View style={styles.aiAvatar}><AppIcon name="sparkles" size={14} color="#FFFFFF" /></View>}
      <View style={[styles.bubble, user ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, user && styles.userMessageText]}>{message.content}</Text>
        <View style={styles.messageMeta}>
          {message.attachmentName && <AppIcon name="attach" size={12} color={user ? 'rgba(255,255,255,.75)' : colors.textMuted} />}
          <Text style={[styles.time, user && styles.userTime]}>{formatTime(message.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', maxWidth: 190, marginTop: 2 },
  messages: { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingVertical: 22, gap: 16 },
  welcome: { alignItems: 'center', paddingTop: 35 },
  welcomeIcon: { width: 68, height: 68, borderRadius: 25, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  welcomeTitle: { color: colors.text, fontSize: 23, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  welcomeBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 330, marginTop: 9 },
  suggestionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginTop: 25 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 11 },
  suggestionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  messageRowUser: { justifyContent: 'flex-end' },
  aiAvatar: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bubble: { maxWidth: '82%', paddingHorizontal: 15, paddingTop: 13, paddingBottom: 9, borderRadius: 20, ...shadows },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  aiBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: 5 },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  userMessageText: { color: '#FFFFFF' },
  messageMeta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 6 },
  time: { color: colors.textFaint, fontSize: 10 },
  userTime: { color: 'rgba(255,255,255,.72)' },
  actionToast: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successSoft, borderRadius: 14, padding: 12 },
  actionToastText: { flex: 1, color: colors.success, fontSize: 12, fontWeight: '700' },
  attachmentPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 15, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.primarySoft, borderRadius: radii.md },
  attachmentText: { flex: 1, color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 5 },
  modeLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  modePills: { flexDirection: 'row', gap: 6 },
  composerWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 12, paddingTop: 5, paddingBottom: 3 },
  composer: { flex: 1, minHeight: 45, maxHeight: 110, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 11, fontSize: 15 },
  sendButton: { width: 43, height: 43, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows },
  sendButtonDisabled: { backgroundColor: colors.textFaint },
  disclaimer: { color: colors.textFaint, fontSize: 10, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 10, paddingTop: 3 },
});
