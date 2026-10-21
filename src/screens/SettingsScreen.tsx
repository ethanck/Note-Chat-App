import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, radii, shadows } from '../theme/theme';
import { AppIcon, IconButton, Surface } from '../components/Ui';
import { useAppStore } from '../store/AppStore';
import { exportAppData } from '../data/storage';
import { clearChatGPTAccount, openChatGPTUsageSettings, signInWithChatGPT } from '../services/chatgptAuth';
import { attachmentIcon, formatAttachmentSize } from '../services/attachments';

export const SettingsScreen = ({ onClose }: { onClose: () => void }) => {
  const { data, updateSettings, connectChatGPT, disconnectChatGPT, deleteReference } = useAppStore();
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      const connection = await signInWithChatGPT();
      connectChatGPT(connection.account);
      Alert.alert('ChatGPT connected', connection.account.sharingEnabled ? 'Eligible AI requests can now use your ChatGPT plan. Your local notes stay on this device.' : 'Your ChatGPT identity is connected, but plan usage was not enabled. Reconnect from here to approve it.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ChatGPT sign-in could not be completed.';
      if (!message.toLowerCase().includes('canceled')) Alert.alert('Could not connect ChatGPT', message);
    } finally {
      setConnecting(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out of ChatGPT?', 'Your local notes and notebooks will remain on this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { await clearChatGPTAccount(); disconnectChatGPT(); } }]);
  };

  const exportLibrary = async () => {
    const content = await exportAppData(data);
    const path = `${FileSystem.cacheDirectory}note-app-chat-backup.json`;
    await FileSystem.writeAsStringAsync(path, content);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export your local library' });
    else await Share.share({ message: content, title: 'Note App Chat backup' });
  };

  return (
    <View style={styles.screen}><View style={styles.header}><IconButton icon="close" onPress={onClose} color={colors.text} accessibilityLabel="Close settings" /><View style={{ flex: 1 }}><Text style={styles.kicker}>PREFERENCES</Text><Text style={styles.title}>Settings</Text></View></View><ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.groupLabel}>ACCOUNT</Text>
      <Surface style={styles.accountCard}><View style={styles.accountIcon}><AppIcon name="logo-electron" size={22} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{data.chatGPTAccount.connected ? data.chatGPTAccount.displayName || 'ChatGPT connected' : 'ChatGPT not connected'}</Text><Text style={styles.cardBody}>{data.chatGPTAccount.connected ? data.chatGPTAccount.email || (data.chatGPTAccount.sharingEnabled ? 'ChatGPT plan usage enabled' : 'Identity connected; plan usage not enabled') : 'Connect to use your ChatGPT plan without an API key.'}</Text></View>{data.chatGPTAccount.connected ? <Pressable onPress={signOut} style={styles.outlineButton}><Text style={styles.outlineText}>Sign out</Text></Pressable> : <Pressable onPress={connect} disabled={connecting} style={[styles.connectButton, connecting && styles.disabledButton]}><Text style={styles.connectText}>{connecting ? 'Opening…' : 'Continue with ChatGPT'}</Text></Pressable>}</Surface>
      {data.chatGPTAccount.connected && <Pressable onPress={openChatGPTUsageSettings} style={styles.usageRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Manage ChatGPT plan usage</Text><Text style={styles.rowBody}>Review how this app uses your ChatGPT plan.</Text></View><AppIcon name="open-outline" size={17} color={colors.primary} /></Pressable>}
      <Text style={styles.groupLabel}>CHAT PREFERENCES</Text>
      <Surface><PreferenceRow label="Explanation complexity" value={String(data.settings.aiComplexity)} onPress={() => updateSettings({ aiComplexity: data.settings.aiComplexity >= 10 ? 1 : data.settings.aiComplexity + 1 })} hint="Tap to cycle from beginner to expert" /><PreferenceRow label="Personality" value={String(data.settings.aiPersonality)} onPress={() => updateSettings({ aiPersonality: data.settings.aiPersonality >= 10 ? 1 : data.settings.aiPersonality + 1 })} hint="Tap to cycle from direct to playful" /><PreferenceRow label="Response format" value={data.settings.responseFormat} onPress={() => { const options = ['Bullet Points', 'Numbered Lists', 'Paragraphs'] as const; const index = options.indexOf(data.settings.responseFormat); updateSettings({ responseFormat: options[(index + 1) % options.length] }); }} /></Surface>
      <Text style={styles.groupLabel}>REFERENCES</Text>
      <Surface><Text style={styles.referenceHelper}>Local source files used by chats and notes. Deleting a reference removes the file and its links, but keeps note text already imported from it.</Text>{data.references.length ? data.references.map((reference) => <ReferenceRow key={reference.id} name={reference.name} kind={reference.kind} size={reference.size} onDelete={() => Alert.alert('Delete reference?', `${reference.name} will be removed from this device and unlinked from chats and notes.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteReference(reference.id) }])} />) : <Text style={styles.emptyReferences}>No local references yet.</Text>}</Surface>
      <Text style={styles.groupLabel}>LOCAL DATA</Text>
      <Surface><SettingRow icon="lock-closed-outline" title="Local-first storage" body="Notes, notebooks, quizzes, and chats remain on this device." /><SettingRow icon="cloud-offline-outline" title="Firebase sync" body="Prepared for a future version, intentionally unused in v1." /><Pressable onPress={exportLibrary} style={styles.exportRow}><View style={styles.rowIcon}><AppIcon name="download-outline" size={18} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Export local library</Text><Text style={styles.rowBody}>Create a portable JSON backup for moving devices.</Text></View><AppIcon name="chevron-forward" size={17} color={colors.textFaint} /></Pressable></Surface>
      <Text style={styles.footerNote}>Note App Chat · local-first preview build</Text>
    </ScrollView></View>
  );
};

const PreferenceRow = ({ label, value, hint, onPress }: { label: string; value: string; hint?: string; onPress: () => void }) => <Pressable onPress={onPress} style={styles.preferenceRow}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{label}</Text>{hint && <Text style={styles.rowBody}>{hint}</Text>}</View><View style={styles.valuePill}><Text style={styles.valueText}>{value}</Text></View></Pressable>;
const SettingRow = ({ icon, title, body }: { icon: string; title: string; body: string }) => <View style={styles.settingRow}><View style={styles.rowIcon}><AppIcon name={icon} size={18} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View><AppIcon name="checkmark-circle" size={17} color={colors.success} /></View>;
const ReferenceRow = ({ name, kind, size, onDelete }: { name: string; kind: 'text' | 'pdf' | 'word' | 'image'; size?: number; onDelete: () => void }) => <View style={styles.referenceRow}><View style={styles.rowIcon}><AppIcon name={attachmentIcon(kind)} size={17} color={colors.primary} /></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.rowTitle}>{name}</Text><Text style={styles.rowBody}>{kind.toUpperCase()} · {formatAttachmentSize(size)}</Text></View><Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${name}`}><AppIcon name="trash-outline" size={17} color={colors.danger} /></Pressable></View>;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 13, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  groupLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 10, marginBottom: 9 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  accountIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  cardBody: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  connectButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  disabledButton: { opacity: 0.6 },
  connectText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  outlineButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  outlineText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', minHeight: 59, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  valuePill: { borderRadius: 9, backgroundColor: colors.primarySoft, paddingHorizontal: 9, paddingVertical: 6 },
  valueText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 65, borderBottomWidth: 1, borderBottomColor: colors.border },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 65 },
  referenceHelper: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginBottom: 5 },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 58, borderTopWidth: 1, borderTopColor: colors.border },
  emptyReferences: { color: colors.textFaint, fontSize: 12, paddingVertical: 12 },
  usageRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 13, padding: 13, marginTop: 10, gap: 10 },
  rowIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  rowBody: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  footerNote: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 28 },
});
