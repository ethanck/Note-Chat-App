import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, shadows } from '../theme/theme';
import { useAppStore } from '../store/AppStore';
import { AppIcon, IconButton, Pill } from '../components/Ui';

export const NotebookScreen = ({ onOpenDrawer }: { onOpenDrawer: () => void }) => {
  const { data, createNotebook, updateNotebook, addNotebookToNotes } = useAppStore();
  const [selectedId, setSelectedId] = useState(data.notebooks[0]?.id);
  const [promptVisible, setPromptVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const notebook = data.notebooks.find((item) => item.id === selectedId) || data.notebooks[0];

  const create = () => {
    const id = createNotebook(newName || 'New Notebook');
    setSelectedId(id);
    setNewName('');
    setPromptVisible(false);
  };

  if (!notebook) return null;

  const insert = (prefix: string, suffix = '') => updateNotebook(notebook.id, { content: `${notebook.content}${notebook.content ? '\n' : ''}${prefix}${suffix}` });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton icon="menu" onPress={onOpenDrawer} color={colors.text} accessibilityLabel="Open menu" />
        <View style={{ flex: 1 }}><Text style={styles.kicker}>PRIVATE WRITING SPACE</Text><Text style={styles.title}>Notebook</Text></View>
        <IconButton icon="add" onPress={() => setPromptVisible(true)} color={colors.primary} accessibilityLabel="Add notebook" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notebookTabs}>
        {data.notebooks.map((item) => <Pill key={item.id} label={item.name} active={item.id === notebook.id} onPress={() => setSelectedId(item.id)} />)}
      </ScrollView>
      <View style={styles.notebookTitleRow}><View><Text style={styles.notebookName}>{notebook.name}</Text><Text style={styles.notebookMeta}>Autosaved locally · {notebook.content.length} characters</Text></View><Pressable onPress={() => addNotebookToNotes(notebook.id)} style={styles.addToNotes}><AppIcon name="document-text-outline" size={16} color={colors.primary} /><Text style={styles.addToNotesText}>Add to Notes</Text></Pressable></View>
      <View style={styles.editorToolbar}>
        <ToolbarButton label="H1" onPress={() => insert('# ')} /><ToolbarButton label="B" bold onPress={() => insert('**bold**')} /><ToolbarButton label="I" italic onPress={() => insert('_italic_')} /><ToolbarButton label="•" onPress={() => insert('- ')} /><ToolbarButton label="☑" onPress={() => insert('- [ ] ')} /><ToolbarButton label="↗" onPress={() => insert('[link](https://)')} />
      </View>
      <TextInput value={notebook.content} onChangeText={(content) => updateNotebook(notebook.id, { content })} multiline textAlignVertical="top" placeholder="Write freely. Capture a thought, draft an idea, or paste a conversation here..." placeholderTextColor={colors.textFaint} style={styles.editor} />
      <View style={styles.footer}><View style={styles.localBadge}><AppIcon name="lock-closed-outline" size={14} color={colors.success} /><Text style={styles.localText}>Local-only notebook</Text></View><Text style={styles.helper}>Use “Add to Notes” when you want AI organization.</Text></View>
      <Modal visible={promptVisible} transparent animationType="fade" onRequestClose={() => setPromptVisible(false)}><View style={styles.modalBackdrop}><View style={styles.promptCard}><Text style={styles.promptTitle}>New notebook</Text><TextInput autoFocus value={newName} onChangeText={setNewName} placeholder="Notebook name" placeholderTextColor={colors.textFaint} style={styles.promptInput} /><View style={styles.promptActions}><Pressable onPress={() => setPromptVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={create} style={styles.confirmButton}><Text style={styles.confirmText}>Create</Text></Pressable></View></View></View></Modal>
    </View>
  );
};

const ToolbarButton = ({ label, onPress, bold, italic }: { label: string; onPress: () => void; bold?: boolean; italic?: boolean }) => <Pressable onPress={onPress} style={styles.toolbarButton}><Text style={[styles.toolbarLabel, bold && { fontWeight: '900' }, italic && { fontStyle: 'italic' }]}>{label}</Text></Pressable>;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 2 },
  notebookTabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  notebookTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, paddingTop: 9, paddingBottom: 14 },
  notebookName: { color: colors.text, fontSize: 21, fontWeight: '800' },
  notebookMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  addToNotes: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 },
  addToNotesText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  editorToolbar: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  toolbarButton: { minWidth: 34, height: 32, paddingHorizontal: 8, borderRadius: 9, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  toolbarLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  editor: { flex: 1, margin: 16, marginTop: 15, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, color: colors.text, fontSize: 17, lineHeight: 27, ...shadows },
  footer: { alignItems: 'center', gap: 6 },
  localBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  localText: { color: colors.success, fontSize: 11, fontWeight: '800' },
  helper: { color: colors.textFaint, fontSize: 10 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  promptCard: { width: '100%', backgroundColor: colors.surface, borderRadius: radii.lg, padding: 20, ...shadows },
  promptTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 15 },
  promptInput: { height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 17 },
  cancelButton: { paddingHorizontal: 13, paddingVertical: 11 },
  cancelText: { color: colors.textMuted, fontWeight: '700' },
  confirmButton: { backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 17, paddingVertical: 11 },
  confirmText: { color: '#FFFFFF', fontWeight: '800' },
});
