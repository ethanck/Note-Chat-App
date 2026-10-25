import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, shadows } from '../theme/theme';
import { useAppStore } from '../store/AppStore';
import { AppIcon, IconButton, Pill, SearchField, SectionTitle, Surface } from '../components/Ui';
import { Folder, Note, OrganizationProposal, Reference } from '../types';
import { attachmentIcon, formatAttachmentSize } from '../services/attachments';
import { formatDate, previewText } from '../utils/text';

export const NotesScreen = ({ onOpenDrawer }: { onOpenDrawer: () => void }) => {
  const { data, createFolder, createNote, updateNote, toggleNoteFavorite, toggleNotePin, toggleNoteLocked, toggleFolderLocked, deleteReference, applyOrganizationProposal, dismissOrganizationProposal } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Pinned' | 'Favorites'>('All');
  const [folderId, setFolderId] = useState<string>();
  const [selectedNoteId, setSelectedNoteId] = useState<string>();
  const [showInbox, setShowInbox] = useState(false);
  const [showOrganizationReview, setShowOrganizationReview] = useState(false);
  const [prompt, setPrompt] = useState<'note' | 'folder'>();
  const [promptValue, setPromptValue] = useState('');

  const selectedNote = data.notes.find((note) => note.id === selectedNoteId);
  const currentFolder = data.folders.find((folder) => folder.id === folderId);
  const visibleFolders = useMemo(() => data.folders.filter((folder) => folder.parentId === folderId), [data.folders, folderId]);
  const visibleNotes = useMemo(() => data.notes.filter((note) => {
    const matchesFolder = folderId ? note.folderId === folderId : !note.folderId;
    const matchesSearch = `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'All' || (filter === 'Pinned' ? note.isPinned : note.isFavorite);
    return matchesFolder && matchesSearch && matchesFilter;
  }), [data.notes, folderId, query, filter]);
  const inboxReferences = useMemo(() => data.references.filter((reference) => reference.isInInbox), [data.references]);
  const pendingProposals = useMemo(() => data.organizationProposals.filter((proposal) => proposal.status === 'pending'), [data.organizationProposals]);

  const createFromPrompt = () => {
    const value = promptValue.trim();
    if (!value) return;
    if (prompt === 'folder') createFolder(value, folderId);
    if (prompt === 'note') createNote({ title: value, content: '', folderId });
    setPrompt(undefined);
    setPromptValue('');
  };

  if (selectedNote) {
    return <NoteEditor note={selectedNote} references={data.references.filter((reference) => selectedNote.referenceIds?.includes(reference.id))} onBack={() => setSelectedNoteId(undefined)} onSave={(patch) => updateNote(selectedNote.id, patch)} onFavorite={() => toggleNoteFavorite(selectedNote.id)} onPin={() => toggleNotePin(selectedNote.id)} onLock={() => toggleNoteLocked(selectedNote.id)} folderName={data.folders.find((folder) => folder.id === selectedNote.folderId)?.name} />;
  }

  if (showInbox) return <ReferenceInbox references={inboxReferences} onBack={() => setShowInbox(false)} onDelete={deleteReference} />;
  if (showOrganizationReview) return <OrganizationReview proposals={pendingProposals} onBack={() => setShowOrganizationReview(false)} onApply={applyOrganizationProposal} onDismiss={dismissOrganizationProposal} />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton icon="menu" onPress={onOpenDrawer} color={colors.text} accessibilityLabel="Open menu" />
        <View style={{ flex: 1 }}><Text style={styles.kicker}>YOUR LIBRARY</Text><Text style={styles.title}>Notes</Text></View>
        <IconButton icon="folder-open-outline" onPress={() => setPrompt('folder')} color={colors.primary} accessibilityLabel="Create folder" />
        <IconButton icon="add" onPress={() => setPrompt('note')} color={colors.primary} accessibilityLabel="Create note" />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search notes and folders" />
        <View style={styles.filterRow}>
          {(['All', 'Pinned', 'Favorites'] as const).map((item) => <Pill key={item} label={item} active={filter === item} onPress={() => setFilter(item)} />)}
        </View>
        {!folderId && pendingProposals.length > 0 && <Pressable onPress={() => setShowOrganizationReview(true)} style={styles.reviewCard}><View style={styles.reviewIcon}><AppIcon name="sparkles-outline" size={21} color={colors.peach} /></View><View style={{ flex: 1 }}><Text style={styles.reviewTitle}>Review organization</Text><Text style={styles.reviewBody}>{pendingProposals.length} chat proposal{pendingProposals.length === 1 ? '' : 's'} waiting for your approval</Text></View><AppIcon name="chevron-forward" size={17} color={colors.peach} /></Pressable>}
        {!folderId && inboxReferences.length > 0 && <Pressable onPress={() => setShowInbox(true)} style={styles.inboxCard}><View style={styles.inboxIcon}><AppIcon name="file-tray-full-outline" size={22} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.inboxTitle}>Inbox</Text><Text style={styles.inboxBody}>{inboxReferences.length} unsorted reference{inboxReferences.length === 1 ? '' : 's'} from recent chats</Text></View><AppIcon name="chevron-forward" size={17} color={colors.primary} /></Pressable>}
        {currentFolder && <Pressable onPress={() => setFolderId(currentFolder.parentId)} style={styles.breadcrumb}><AppIcon name="arrow-back" size={15} color={colors.primary} /><Text style={styles.breadcrumbText}>Back to {data.folders.find((folder) => folder.id === currentFolder.parentId)?.name || 'Notes'}</Text></Pressable>}
        <SectionTitle eyebrow={currentFolder ? 'FOLDER' : 'ORGANIZE'} title={currentFolder?.name || 'Your library'} action={<Text style={styles.itemCount}>{visibleFolders.length + visibleNotes.length} items</Text>} />
        {visibleFolders.length > 0 && <View style={styles.folderGrid}>{visibleFolders.map((folder) => <FolderCard key={folder.id} folder={folder} onPress={() => setFolderId(folder.id)} onToggleLocked={() => toggleFolderLocked(folder.id)} />)}</View>}
        {visibleNotes.length > 0 ? visibleNotes.map((note) => <NoteCard key={note.id} note={note} onPress={() => setSelectedNoteId(note.id)} onFavorite={() => toggleNoteFavorite(note.id)} onPin={() => toggleNotePin(note.id)} onLock={() => toggleNoteLocked(note.id)} folderName={data.folders.find((folder) => folder.id === note.folderId)?.name} />) : visibleFolders.length === 0 && <View style={styles.empty}><AppIcon name="documents-outline" size={28} color={colors.primary} /><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.emptyBody}>Create a note or folder to start building your library.</Text></View>}
      </ScrollView>
      <PromptModal visible={Boolean(prompt)} title={prompt === 'folder' ? 'New folder' : 'New note'} placeholder={prompt === 'folder' ? 'Folder name' : 'Note title'} value={promptValue} onChange={setPromptValue} onCancel={() => { setPrompt(undefined); setPromptValue(''); }} onConfirm={createFromPrompt} />
    </View>
  );
};

const FolderCard = ({ folder, onPress, onToggleLocked }: { folder: Folder; onPress: () => void; onToggleLocked: () => void }) => (
  <Pressable onPress={onPress} style={styles.folderCard}>
    <View style={styles.folderCardTop}><View style={styles.folderIcon}><AppIcon name="folder" size={23} color={colors.primary} /></View><Pressable onPress={onToggleLocked} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${folder.isLocked ? 'Unlock' : 'Lock'} ${folder.name}`}><AppIcon name={folder.isLocked ? 'lock-closed' : 'lock-open-outline'} size={16} color={folder.isLocked ? colors.primary : colors.textFaint} /></Pressable></View>
    <Text numberOfLines={1} style={styles.folderName}>{folder.name}</Text>
    <Text style={styles.folderMeta}>{folder.isLocked ? 'AI organization locked' : folder.isFavorite ? 'Favorite folder' : 'Folder'}</Text>
  </Pressable>
);

const ReferenceInbox = ({ references, onBack, onDelete }: { references: Reference[]; onBack: () => void; onDelete: (id: string) => void }) => (
  <View style={styles.screen}>
    <View style={styles.header}><IconButton icon="arrow-back" onPress={onBack} color={colors.text} accessibilityLabel="Back to notes" /><View style={{ flex: 1 }}><Text style={styles.kicker}>UNSORTED REFERENCES</Text><Text style={styles.title}>Inbox</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={styles.inboxIntro}><AppIcon name="information-circle-outline" size={18} color={colors.primary} /><Text style={styles.inboxIntroText}>These files are available to their chats but have not been saved into the note structure yet.</Text></Surface>
      {references.map((reference) => <ReferenceCard key={reference.id} reference={reference} onDelete={() => Alert.alert('Delete reference?', `${reference.name} will be removed from this device and unlinked from chats and notes.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => onDelete(reference.id) }])} />)}
    </ScrollView>
  </View>
);

const ReferenceCard = ({ reference, onDelete }: { reference: Reference; onDelete: () => void }) => (
  <Surface style={styles.referenceCard}><View style={styles.referenceIcon}><AppIcon name={attachmentIcon(reference.kind)} size={19} color={colors.primary} /></View><View style={styles.referenceMain}><Text numberOfLines={1} style={styles.referenceName}>{reference.name}</Text><Text style={styles.referenceMeta}>{reference.kind.toUpperCase()} · {formatAttachmentSize(reference.size)} · Local only</Text></View><Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${reference.name}`}><AppIcon name="trash-outline" size={18} color={colors.danger} /></Pressable></Surface>
);

const OrganizationReview = ({ proposals, onBack, onApply, onDismiss }: { proposals: OrganizationProposal[]; onBack: () => void; onApply: (id: string) => void; onDismiss: (id: string) => void }) => (
  <View style={styles.screen}>
    <View style={styles.header}><IconButton icon="arrow-back" onPress={onBack} color={colors.text} accessibilityLabel="Back to notes" /><View style={{ flex: 1 }}><Text style={styles.kicker}>AI ORGANIZATION</Text><Text style={styles.title}>Review changes</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={styles.inboxIntro}><AppIcon name="shield-checkmark-outline" size={18} color={colors.primary} /><Text style={styles.inboxIntroText}>High-confidence plans apply automatically. These plans fell below the confidence threshold or were explicitly set to review mode.</Text></Surface>
      {proposals.length === 0 && <View style={styles.empty}><AppIcon name="checkmark-circle-outline" size={28} color={colors.success} /><Text style={styles.emptyTitle}>Nothing needs review</Text><Text style={styles.emptyBody}>New organization proposals will appear here.</Text></View>}
      {proposals.map((proposal) => <Surface key={proposal.id} style={styles.proposalCard}><View style={styles.proposalHeader}><View style={styles.proposalIcon}><AppIcon name="sparkles" size={17} color={colors.peach} /></View><View style={{ flex: 1 }}><Text style={styles.proposalTitle} numberOfLines={1}>{proposal.chatTitle}</Text><Text style={styles.proposalMeta}>{proposal.plan.action.toUpperCase()} · {Math.round(proposal.plan.confidence * 100)}% confidence</Text></View></View><Text style={styles.proposalBody}>{proposal.plan.rationale}</Text><View style={styles.proposalActions}><Pressable onPress={() => onDismiss(proposal.id)} style={styles.proposalDismiss}><Text style={styles.proposalDismissText}>Keep in Inbox</Text></Pressable><Pressable onPress={() => onApply(proposal.id)} style={styles.proposalApply}><Text style={styles.proposalApplyText}>Apply plan</Text></Pressable></View></Surface>)}
    </ScrollView>
  </View>
);

const NoteCard = ({ note, onPress, onFavorite, onPin, onLock, folderName }: { note: Note; onPress: () => void; onFavorite: () => void; onPin: () => void; onLock: () => void; folderName?: string }) => (
  <Pressable onPress={onPress} style={styles.noteCard}>
    <View style={styles.noteIcon}><AppIcon name="document-text" size={20} color={colors.peach} /></View>
    <View style={styles.noteMain}>
      <View style={styles.noteTitleRow}><Text numberOfLines={1} style={styles.noteTitle}>{note.title}</Text>{note.isPinned && <AppIcon name="pin" size={14} color={colors.primary} />}</View>
      <Text numberOfLines={2} style={styles.notePreview}>{previewText(note.content || 'Empty note')}</Text>
      <View style={styles.noteMeta}><Text style={styles.noteDate}>{folderName || 'Unfiled'} · {formatDate(note.updatedAt)}</Text>{note.latestChange && <Text style={styles.updatedBadge}>AI updated</Text>}</View>
    </View>
    <View style={styles.noteActions}><Pressable onPress={onFavorite} hitSlop={8}><AppIcon name={note.isFavorite ? 'star' : 'star-outline'} size={18} color={note.isFavorite ? colors.peach : colors.textFaint} /></Pressable><Pressable onPress={onPin} hitSlop={8}><AppIcon name={note.isPinned ? 'pin' : 'pin-outline'} size={18} color={note.isPinned ? colors.primary : colors.textFaint} /></Pressable><Pressable onPress={onLock} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${note.isLocked ? 'Unlock' : 'Lock'} ${note.title}`}><AppIcon name={note.isLocked ? 'lock-closed' : 'lock-open-outline'} size={17} color={note.isLocked ? colors.primary : colors.textFaint} /></Pressable></View>
  </Pressable>
);

const NoteEditor = ({ note, references, folderName, onBack, onSave, onFavorite, onPin, onLock }: { note: Note; references: Reference[]; folderName?: string; onBack: () => void; onSave: (patch: Partial<Note>) => void; onFavorite: () => void; onPin: () => void; onLock: () => void }) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  const insert = (prefix: string, suffix = '') => setContent((current) => `${current}${current ? '\n' : ''}${prefix}${suffix}`);

  return (
    <View style={styles.screen}>
      <View style={styles.editorHeader}>
        <IconButton icon="arrow-back" onPress={() => { onSave({ title, content }); onBack(); }} color={colors.text} accessibilityLabel="Back to notes" />
        <View style={{ flex: 1 }}><Text style={styles.kicker}>{folderName || 'UNFILED NOTE'}</Text><Text style={styles.title}>Edit note</Text></View>
        <IconButton icon={note.isFavorite ? 'star' : 'star-outline'} onPress={onFavorite} color={note.isFavorite ? colors.peach : colors.textMuted} accessibilityLabel="Favorite note" />
        <IconButton icon={note.isPinned ? 'pin' : 'pin-outline'} onPress={onPin} color={note.isPinned ? colors.primary : colors.textMuted} accessibilityLabel="Pin note" />
        <IconButton icon={note.isLocked ? 'lock-closed' : 'lock-open-outline'} onPress={onLock} color={note.isLocked ? colors.primary : colors.textMuted} accessibilityLabel={note.isLocked ? 'Unlock note for AI organization' : 'Lock note from AI organization'} />
      </View>
      <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
        <TextInput value={title} onChangeText={setTitle} placeholder="Note title" placeholderTextColor={colors.textFaint} style={styles.noteTitleInput} />
        <View style={styles.editorToolbar}>
          <ToolbarButton label="H1" onPress={() => insert('# ')} /><ToolbarButton label="B" bold onPress={() => insert('**bold**')} /><ToolbarButton label="•" onPress={() => insert('- ')} /><ToolbarButton label="☑" onPress={() => insert('- [ ] ')} /><ToolbarButton label="<>" onPress={() => insert('```\n', '\n```')} /><ToolbarButton label="↗" onPress={() => insert('[link](https://)')} />
        </View>
        <TextInput value={content} onChangeText={setContent} placeholder="Start writing..." placeholderTextColor={colors.textFaint} multiline textAlignVertical="top" style={styles.editorInput} />
        <ReferencePanel references={references} />
        {note.latestChange && <View style={styles.changeCard}><View style={styles.changeHeader}><AppIcon name="sparkles" size={16} color={colors.primary} /><Text style={styles.changeTitle}>Automatic organization</Text></View><Text style={styles.changeLabel}>ADDED</Text><Text style={styles.addedText}>{note.latestChange.added}</Text>{note.latestChange.removed && <><Text style={[styles.changeLabel, { color: colors.danger }]}>REMOVED</Text><Text style={styles.removedText}>{note.latestChange.removed}</Text></>}</View>}
        <View style={styles.localBadge}><AppIcon name="lock-closed-outline" size={14} color={colors.success} /><Text style={styles.localBadgeText}>Stored locally on this device</Text></View>
      </ScrollView>
      <Pressable onPress={() => onSave({ title, content })} style={styles.saveBar}><Text style={styles.saveText}>Save changes</Text><AppIcon name="checkmark" size={18} color="#FFFFFF" /></Pressable>
    </View>
  );
};

const ReferencePanel = ({ references }: { references: Reference[] }) => references.length > 0 ? (
  <View style={styles.referencePanel}><View style={styles.referencePanelHeader}><AppIcon name="link-outline" size={15} color={colors.primary} /><Text style={styles.referencePanelTitle}>References</Text></View>{references.map((reference) => <View key={reference.id} style={styles.referencePanelRow}><AppIcon name={attachmentIcon(reference.kind)} size={14} color={colors.primary} /><Text numberOfLines={1} style={styles.referencePanelText}>{reference.name}</Text></View>)}</View>
) : null;

const ToolbarButton = ({ label, onPress, bold }: { label: string; onPress: () => void; bold?: boolean }) => <Pressable onPress={onPress} style={styles.toolbarButton}><Text style={[styles.toolbarLabel, bold && { fontWeight: '900' }]}>{label}</Text></Pressable>;

const PromptModal = ({ visible, title, placeholder, value, onChange, onCancel, onConfirm }: { visible: boolean; title: string; placeholder: string; value: string; onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.modalBackdrop}><View style={styles.promptCard}><Text style={styles.promptTitle}>{title}</Text><TextInput autoFocus value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textFaint} style={styles.promptInput} /><View style={styles.promptActions}><Pressable onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={onConfirm} style={styles.confirmButton}><Text style={styles.confirmText}>Create</Text></Pressable></View></View></View>
  </Modal>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 13, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  editorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 13, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  content: { padding: 16, paddingBottom: 36 },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFF5E8', borderRadius: radii.md, padding: 13, marginBottom: 10 },
  reviewIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  reviewTitle: { color: '#895A1A', fontSize: 14, fontWeight: '800' },
  reviewBody: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  inboxCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: 13, marginBottom: 18 },
  inboxIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  inboxTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  inboxBody: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  inboxIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, marginBottom: 14, backgroundColor: colors.primarySoft },
  inboxIntroText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  referenceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, marginBottom: 9 },
  referenceIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  referenceMain: { flex: 1, minWidth: 0 },
  referenceName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  referenceMeta: { color: colors.textFaint, fontSize: 10, marginTop: 4 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  breadcrumbText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  itemCount: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginBottom: 18 },
  folderCard: { width: '47.5%', backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, ...shadows },
  folderCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  folderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  folderName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  folderMeta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, marginBottom: 10, ...shadows },
  noteIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#FFF0DE', alignItems: 'center', justifyContent: 'center' },
  noteMain: { flex: 1, minWidth: 0 },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  notePreview: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  noteDate: { color: colors.textFaint, fontSize: 10 },
  updatedBadge: { color: colors.success, backgroundColor: colors.successSoft, fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  noteActions: { gap: 9, paddingTop: 2 },
  proposalCard: { padding: 14, marginBottom: 11 },
  proposalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  proposalIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#FFF0DE', alignItems: 'center', justifyContent: 'center' },
  proposalTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  proposalMeta: { color: colors.textFaint, fontSize: 10, marginTop: 3, fontWeight: '800' },
  proposalBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  proposalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 14 },
  proposalDismiss: { paddingHorizontal: 10, paddingVertical: 9 },
  proposalDismissText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  proposalApply: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.primary },
  proposalApplyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 55 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 11 },
  emptyBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6 },
  editorContent: { padding: 16, paddingBottom: 110 },
  noteTitleInput: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, paddingVertical: 8 },
  editorToolbar: { flexDirection: 'row', gap: 7, paddingVertical: 13, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.border, marginVertical: 12 },
  toolbarButton: { minWidth: 34, height: 32, paddingHorizontal: 8, borderRadius: 9, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  toolbarLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  editorInput: { minHeight: 350, color: colors.text, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 15, fontSize: 16, lineHeight: 25 },
  referencePanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 13, marginTop: 14 },
  referencePanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  referencePanelTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  referencePanelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  referencePanelText: { flex: 1, color: colors.textMuted, fontSize: 11 },
  changeCard: { backgroundColor: colors.surface, borderRadius: radii.md, marginTop: 16, padding: 15, borderWidth: 1, borderColor: colors.border },
  changeHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 13 },
  changeTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  changeLabel: { color: colors.success, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 5, marginBottom: 4 },
  addedText: { color: colors.success, backgroundColor: colors.successSoft, padding: 9, borderRadius: 8, fontSize: 13, lineHeight: 19 },
  removedText: { color: colors.danger, backgroundColor: colors.dangerSoft, textDecorationLine: 'line-through', padding: 9, borderRadius: 8, fontSize: 13, lineHeight: 19 },
  localBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 18 },
  localBadgeText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  saveBar: { position: 'absolute', left: 16, right: 16, bottom: 16, height: 50, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
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
