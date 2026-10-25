import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createDefaultData } from '../data/defaults';
import { loadAppData, saveAppData } from '../data/storage';
import {
  AppData,
  AppSettings,
  Attachment,
  Chat,
  ChatMessage,
  ChatGPTAccount,
  Folder,
  Note,
  NoteChange,
  Notebook,
  OrganizationPlan,
  OrganizationProposal,
  Quiz,
  Reference,
} from '../types';
import { makeId, previewText, tokenize, topicFromText } from '../utils/text';
import { completeChatGPTRequest, loadChatGPTAccount } from '../services/chatgptAuth';
import { removeStoredAttachment } from '../services/attachments';
import { mergeReferenceIds, requestOrganizationPlan } from '../services/organization';

type AppStore = {
  data: AppData;
  ready: boolean;
  lastAction?: string;
  activeChat: Chat;
  createChat: (title?: string) => string;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  archiveChat: (id: string) => void;
  toggleChatFavorite: (id: string) => void;
  toggleChatPin: (id: string) => void;
  sendMessage: (chatId: string, content: string, attachments?: Attachment[]) => Promise<void>;
  deleteReference: (id: string) => void;
  organizeChatToNotes: (chatId: string) => Promise<'saved' | 'review' | 'failed'>;
  applyOrganizationProposal: (id: string) => void;
  dismissOrganizationProposal: (id: string) => void;
  createFolder: (name: string, parentId?: string) => string;
  createNote: (note: Partial<Note> & Pick<Note, 'title' | 'content'>) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  toggleNoteFavorite: (id: string) => void;
  toggleNotePin: (id: string) => void;
  toggleNoteLocked: (id: string) => void;
  toggleFolderLocked: (id: string) => void;
  createNotebook: (name: string) => string;
  updateNotebook: (id: string, patch: Partial<Notebook>) => void;
  addNotebookToNotes: (id: string) => void;
  createQuiz: (title?: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  connectChatGPT: (account: ChatGPTAccount) => void;
  disconnectChatGPT: () => void;
  clearLastAction: () => void;
};

const AppStoreContext = createContext<AppStore | null>(null);

const disconnectedReply = 'Connect with ChatGPT in Settings to receive an AI response. Your chats and notes remain local until you choose to connect.';

const bestFolderForText = (folders: Folder[], text: string) => {
  const tokens = new Set(tokenize(text));
  return folders
    .map((folder) => ({
      folder,
      score: tokenize(folder.name).reduce((score, token) => score + (tokens.has(token) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
};

const bestNoteForText = (notes: Note[], text: string) => {
  const tokens = new Set(tokenize(text));
  return notes
    .map((note) => ({
      note,
      score: tokenize(`${note.title} ${note.content}`).reduce(
        (score, token) => score + (tokens.has(token) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];
};

const withMigrations = (stored: AppData): AppData => ({
  ...stored,
  references: stored.references || [],
  organizationProposals: stored.organizationProposals || [],
  chats: stored.chats.map((chat) => ({ ...chat, isSaved: chat.isSaved ?? false })),
  folders: stored.folders.map((folder) => ({ ...folder, isLocked: folder.isLocked ?? false })),
  notes: stored.notes.map((note) => ({ ...note, isLocked: note.isLocked ?? false, referenceIds: note.referenceIds || [], relatedNoteIds: note.relatedNoteIds || [] })),
  settings: {
    ...stored.settings,
    organizationMode: stored.settings.organizationMode || 'automatic',
    organizationConfidenceThreshold: stored.settings.organizationConfidenceThreshold ?? 0.85,
  },
});

const addReferencesToChat = (references: Reference[], attachments: Attachment[], chatId: string) => {
  const next = [...references];
  attachments.forEach((attachment) => {
    const existing = next.find((reference) => reference.id === attachment.id);
    if (existing) {
      existing.chatIds = Array.from(new Set([...existing.chatIds, chatId]));
      return;
    }
    next.push({ ...attachment, chatIds: [chatId], noteIds: [], isInInbox: true });
  });
  return next;
};

const folderIsLocked = (folders: Folder[], folderId?: string) => {
  let currentId = folderId;
  while (currentId) {
    const folder = folders.find((item) => item.id === currentId);
    if (!folder) return false;
    if (folder.isLocked) return true;
    currentId = folder.parentId;
  }
  return false;
};

const chatText = (chat: Chat) => chat.messages
  .map((message) => `${message.role === 'user' ? 'Question' : 'Answer'}: ${message.content}`)
  .join('\n\n');

const applyOrganizationPlan = (current: AppData, chatId: string, plan: OrganizationPlan): { data: AppData; noteIds: string[]; folderId?: string; label: string } => {
  const chat = current.chats.find((item) => item.id === chatId);
  if (!chat) return { data: current, noteIds: [], label: 'Chat could not be found' };
  const now = new Date().toISOString();
  const notes = [...current.notes];
  const folders = [...current.folders];
  const addedNoteIds: string[] = [];
  let targetFolderId: string | undefined;
  let label = 'Saved conversation to Notes';
  const incomingReferenceIds = current.references.filter((reference) => reference.chatIds.includes(chatId)).map((reference) => reference.id);

  const addFolder = (name: string, parentId?: string) => {
    const id = makeId('folder');
    folders.push({ id, name: name.trim() || 'Chat Notes', parentId, createdAt: now, isPinned: false, isFavorite: false, isLocked: false });
    return id;
  };

  const addNote = (title: string, content: string, folderId?: string, relatedNoteIds: string[] = []) => {
    const id = makeId('note');
    notes.push({
      id,
      title: title.trim() || 'Notes from conversation',
      content: content.trim() || chatText(chat),
      folderId,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      isFavorite: false,
      isLocked: false,
      referenceIds: incomingReferenceIds,
      relatedNoteIds,
    });
    addedNoteIds.push(id);
    return id;
  };

  const requestedFolder = plan.targetFolderId && folders.find((folder) => folder.id === plan.targetFolderId);
  if (requestedFolder && !folderIsLocked(folders, requestedFolder.id)) targetFolderId = requestedFolder.id;

  if (plan.action === 'append' && plan.targetNoteId) {
    const target = notes.find((note) => note.id === plan.targetNoteId);
    if (target && !target.isLocked && !folderIsLocked(folders, target.folderId)) {
      const rewritten = plan.rewrittenContent?.trim() || `${target.content.trim()}\n\n${chatText(chat)}`;
      notes.splice(notes.indexOf(target), 1, {
        ...target,
        content: rewritten,
        updatedAt: now,
        referenceIds: mergeReferenceIds(target.referenceIds, incomingReferenceIds),
        latestChange: {
          added: rewritten === target.content ? chatText(chat) : rewritten,
          removed: plan.removedContent || (rewritten !== target.content ? target.content : undefined),
          createdAt: now,
        },
      });
      addedNoteIds.push(target.id);
      targetFolderId = target.folderId;
      label = `Updated “${target.title}”`;
    }
  } else if (plan.action === 'create') {
    if (!targetFolderId && plan.newFolderName) targetFolderId = addFolder(plan.newFolderName);
    addNote(plan.newNoteTitle || chat.title, plan.rewrittenContent || chatText(chat), targetFolderId);
    label = targetFolderId ? 'Created a new organized note' : 'Created a new note in Inbox';
  } else if (plan.action === 'split' && plan.targetNoteId && plan.splitNotes.length >= 2) {
    const source = notes.find((note) => note.id === plan.targetNoteId);
    if (source && !source.isLocked && !folderIsLocked(folders, source.folderId)) {
      const splitFolderId = plan.splitFolderName ? addFolder(plan.splitFolderName, source.folderId) : source.folderId;
      const sourceIndex = notes.indexOf(source);
      notes.splice(sourceIndex, 1);
      const newIds = plan.splitNotes.map((item) => addNote(item.title, item.content, splitFolderId, []));
      newIds.forEach((id) => {
        const note = notes.find((item) => item.id === id);
        if (note) notes.splice(notes.indexOf(note), 1, { ...note, relatedNoteIds: newIds.filter((otherId) => otherId !== id), referenceIds: mergeReferenceIds(source.referenceIds, incomingReferenceIds) });
      });
      targetFolderId = splitFolderId;
      label = plan.splitFolderName ? `Split “${source.title}” into a new folder` : `Split “${source.title}” in place`;
    }
  } else if (plan.action === 'link') {
    const linkIds = Array.from(new Set([plan.targetNoteId, ...plan.linkNoteIds].filter(Boolean) as string[]));
    const validIds = linkIds.filter((id) => notes.some((note) => note.id === id));
    validIds.forEach((id) => {
      const note = notes.find((item) => item.id === id);
      if (note) notes.splice(notes.indexOf(note), 1, { ...note, relatedNoteIds: mergeReferenceIds(note.relatedNoteIds, validIds.filter((otherId) => otherId !== id)), updatedAt: now });
    });
    addedNoteIds.push(...validIds);
    label = validIds.length > 1 ? 'Linked related notes' : 'Saved conversation with no note link';
  }

  if (!addedNoteIds.length && plan.action !== 'link') return { data: current, noteIds: [], label: 'The proposed organization could not be applied safely' };
  const savedReferenceAt = new Date().toISOString();
  const next: AppData = {
    ...current,
    folders,
    notes,
    chats: current.chats.map((item) => item.id === chatId ? { ...item, isSaved: true, updatedAt: savedReferenceAt } : item),
    references: current.references.map((reference) => reference.chatIds.includes(chatId)
      ? { ...reference, folderId: targetFolderId, isInInbox: false, savedToNotesAt: savedReferenceAt, noteIds: mergeReferenceIds(reference.noteIds, addedNoteIds) }
      : reference),
  };
  return { data: next, noteIds: addedNoteIds, folderId: targetFolderId, label };
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [lastAction, setLastAction] = useState<string>();

  useEffect(() => {
    Promise.all([loadAppData(), loadChatGPTAccount()])
      .then(([stored, account]) => {
        if (stored) setData({ ...withMigrations(stored), chatGPTAccount: account || { connected: false } });
        else if (account) setData((current) => ({ ...current, chatGPTAccount: account }));
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) {
      saveAppData(data).catch(() => undefined);
    }
  }, [data, ready]);

  const update = (recipe: (current: AppData) => AppData) => setData((current) => recipe(current));

  const createChat = (title = 'New Chat') => {
    const id = makeId('chat');
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      chats: [
        {
          id,
          title,
          createdAt: now,
          updatedAt: now,
          isPinned: false,
          isFavorite: false,
          isArchived: false,
          isSaved: false,
          messages: [],
        },
        ...current.chats,
      ],
    }));
    return id;
  };

  const renameChat = (id: string, title: string) =>
    update((current) => ({
      ...current,
      chats: current.chats.map((chat) => (chat.id === id ? { ...chat, title: title.trim() || chat.title } : chat)),
    }));

  const deleteChat = (id: string) => {
    const referencesToDelete = data.references.filter((reference) => reference.chatIds.includes(id) && !reference.savedToNotesAt && reference.chatIds.length === 1);
    update((current) => ({
      ...current,
      chats: current.chats.filter((chat) => chat.id !== id),
      references: current.references
        .filter((reference) => !referencesToDelete.some((item) => item.id === reference.id))
        .map((reference) => ({ ...reference, chatIds: reference.chatIds.filter((chatId) => chatId !== id) })),
    }));
    void Promise.all(referencesToDelete.map(removeStoredAttachment));
  };

  const archiveChat = (id: string) =>
    update((current) => ({
      ...current,
      chats: current.chats.map((chat) => (chat.id === id ? { ...chat, isArchived: !chat.isArchived } : chat)),
    }));

  const toggleChatFavorite = (id: string) =>
    update((current) => ({
      ...current,
      chats: current.chats.map((chat) => (chat.id === id ? { ...chat, isFavorite: !chat.isFavorite } : chat)),
    }));

  const toggleChatPin = (id: string) =>
    update((current) => ({
      ...current,
      chats: current.chats.map((chat) => (chat.id === id ? { ...chat, isPinned: !chat.isPinned } : chat)),
    }));

  const sendMessage = async (chatId: string, content: string, attachments: Attachment[] = []) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: makeId('message'),
      role: 'user',
      content: trimmed,
      createdAt: now,
      attachments: attachments.length ? attachments : undefined,
    };
    const chat = data.chats.find((item) => item.id === chatId);
    if (!chat) return;
    update((current) => ({
      ...current,
      references: addReferencesToChat(current.references, attachments, chatId),
      chats: current.chats.map((item) =>
        item.id === chatId
          ? {
              ...item,
              isSaved: false,
              title: item.messages.length === 0 ? previewText(trimmed, 32) : item.title,
              updatedAt: now,
              messages: [...item.messages, userMessage],
            }
          : item,
      ),
    }));

    let responseText = disconnectedReply;
    try {
      if (data.chatGPTAccount.connected) {
        responseText = await completeChatGPTRequest({
          messages: [...chat.messages, userMessage],
          settings: data.settings,
        });
      }
    } catch (error) {
      responseText = error instanceof Error ? error.message : 'ChatGPT could not complete that request.';
    }
    const reply: ChatMessage = {
      id: makeId('message'),
      role: 'assistant',
      content: responseText,
      createdAt: new Date(Date.now() + 500).toISOString(),
    };
    update((current) => ({
      ...current,
      chats: current.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              updatedAt: new Date().toISOString(),
              messages: [...chat.messages, reply],
            }
          : chat,
      ),
    }));
  };

  const createFolder = (name: string, parentId?: string) => {
    const id = makeId('folder');
    update((current) => ({
      ...current,
      folders: [
        ...current.folders,
        { id, name: name.trim() || 'Untitled Folder', parentId, createdAt: new Date().toISOString(), isPinned: false, isFavorite: false, isLocked: false },
      ],
    }));
    return id;
  };

  const createNote = (note: Partial<Note> & Pick<Note, 'title' | 'content'>) => {
    const id = makeId('note');
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      notes: [
        ...current.notes,
        {
          id,
          title: note.title,
          content: note.content,
          folderId: note.folderId,
          notebookId: note.notebookId,
          createdAt: note.createdAt || now,
          updatedAt: now,
          isPinned: note.isPinned ?? false,
          isFavorite: note.isFavorite ?? false,
          isLocked: note.isLocked ?? false,
          referenceIds: note.referenceIds || [],
          relatedNoteIds: note.relatedNoteIds || [],
          latestChange: note.latestChange,
        },
      ],
    }));
    return id;
  };

  const updateNote = (id: string, patch: Partial<Note>) =>
    update((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note,
      ),
    }));

  const toggleNoteFavorite = (id: string) =>
    updateNote(id, { isFavorite: !data.notes.find((note) => note.id === id)?.isFavorite });

  const toggleNotePin = (id: string) =>
    updateNote(id, { isPinned: !data.notes.find((note) => note.id === id)?.isPinned });

  const toggleNoteLocked = (id: string) =>
    updateNote(id, { isLocked: !data.notes.find((note) => note.id === id)?.isLocked });

  const toggleFolderLocked = (id: string) =>
    update((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === id ? { ...folder, isLocked: !folder.isLocked } : folder),
    }));

  const organizeTextToNotes = (text: string, title: string) => {
    const topic = topicFromText(text);
    const folderMatch = bestFolderForText(data.folders, text);
    let targetFolderId = folderMatch?.score ? folderMatch.folder.id : undefined;
    let action = '';

    if (!targetFolderId) {
      targetFolderId = createFolder('Chat Notes');
      action = 'Created Chat Notes folder';
    } else if (folderMatch && folderMatch.score < 2) {
      const existingSubfolder = data.folders.find(
        (folder) => folder.parentId === folderMatch.folder.id && tokenize(folder.name).some((token) => tokenize(topic).includes(token)),
      );
      targetFolderId = existingSubfolder?.id || createFolder(topic, folderMatch.folder.id);
      action = existingSubfolder ? `Added to ${existingSubfolder.name}` : `Created ${topic} subfolder`;
    }

    const noteMatch = bestNoteForText(data.notes, text);
    if (noteMatch && noteMatch.score >= 2) {
      const added = `## ${title}\n\n${text}`;
      const change: NoteChange = { added, createdAt: new Date().toISOString() };
      updateNote(noteMatch.note.id, {
        content: `${noteMatch.note.content}\n\n${added}`,
        folderId: targetFolderId,
        latestChange: change,
      });
      setLastAction(`${action || 'Updated an existing note'} · changes applied automatically`);
      return { noteId: noteMatch.note.id, folderId: targetFolderId };
    }

    const noteId = createNote({ title: `Notes from ${title}`, content: text, folderId: targetFolderId });
    setLastAction(`${action || 'Created a new note'} · changes applied automatically`);
    return { noteId, folderId: targetFolderId };
  };

  const applyPlanForChat = (chatId: string, plan: OrganizationPlan) => {
    const result = applyOrganizationPlan(data, chatId, plan);
    if (result.data === data) {
      setLastAction(result.label);
      return false;
    }
    update(() => result.data);
    setLastAction(`${result.label} · confidence ${Math.round(plan.confidence * 100)}%`);
    return true;
  };

  const organizeChatToNotes = async (chatId: string): Promise<'saved' | 'review' | 'failed'> => {
    const chat = data.chats.find((item) => item.id === chatId);
    if (!chat || !chat.messages.length) return 'failed';
    const plan = await requestOrganizationPlan({ chatTitle: chat.title, chatText: chatText(chat), data });
    const shouldReview = data.settings.organizationMode === 'review' || plan.action === 'ask_user' || plan.confidence < data.settings.organizationConfidenceThreshold;
    if (shouldReview) {
      const proposal: OrganizationProposal = {
        id: makeId('organization-proposal'),
        chatId,
        chatTitle: chat.title,
        createdAt: new Date().toISOString(),
        status: 'pending',
        plan,
        referenceIds: data.references.filter((reference) => reference.chatIds.includes(chatId)).map((reference) => reference.id),
      };
      update((current) => ({ ...current, organizationProposals: [...current.organizationProposals, proposal] }));
      setLastAction(`Organization proposal ready for “${chat.title}” · review required`);
      return 'review';
    }
    return applyPlanForChat(chatId, plan) ? 'saved' : 'failed';
  };

  const applyOrganizationProposal = (id: string) => {
    const proposal = data.organizationProposals.find((item) => item.id === id && item.status === 'pending');
    if (!proposal) return;
    if (applyPlanForChat(proposal.chatId, proposal.plan)) {
      update((current) => ({
        ...current,
        organizationProposals: current.organizationProposals.map((item) => item.id === id ? { ...item, status: 'applied' } : item),
      }));
    }
  };

  const dismissOrganizationProposal = (id: string) => {
    update((current) => ({
      ...current,
      organizationProposals: current.organizationProposals.map((item) => item.id === id ? { ...item, status: 'dismissed' } : item),
    }));
    setLastAction('Organization proposal dismissed; the chat remains unsaved to Notes');
  };

  const createNotebook = (name: string) => {
    const id = makeId('notebook');
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      notebooks: [...current.notebooks, { id, name: name.trim() || 'New Notebook', content: '', createdAt: now, updatedAt: now }],
    }));
    return id;
  };

  const updateNotebook = (id: string, patch: Partial<Notebook>) =>
    update((current) => ({
      ...current,
      notebooks: current.notebooks.map((notebook) =>
        notebook.id === id ? { ...notebook, ...patch, updatedAt: new Date().toISOString() } : notebook,
      ),
    }));

  const addNotebookToNotes = (id: string) => {
    const notebook = data.notebooks.find((item) => item.id === id);
    if (!notebook || !notebook.content.trim()) return;
    organizeTextToNotes(notebook.content, notebook.name);
  };

  const createQuiz = (title = 'Study Checkpoint') => {
    const note = data.notes[0];
    const questionText = note ? `What is the main idea of “${note.title}”?` : 'What would you like to remember from this lesson?';
    const quiz: Quiz = {
      id: makeId('quiz'),
      title,
      questionCount: 1,
      difficulty: 'Medium',
      createdAt: new Date().toISOString(),
      questions: [{ id: makeId('question'), prompt: questionText, options: ['A key idea', 'A random detail', 'An unrelated topic'], answer: 'A key idea' }],
    };
    update((current) => ({ ...current, quizzes: [quiz, ...current.quizzes] }));
    setLastAction('Quiz generated from your local notes');
  };

  const deleteReference = (id: string) => {
    const reference = data.references.find((item) => item.id === id);
    if (!reference) return;
    update((current) => ({
      ...current,
      references: current.references.filter((item) => item.id !== id),
      chats: current.chats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) => ({
          ...message,
          attachments: message.attachments?.filter((attachment) => attachment.id !== id),
        })),
      })),
    }));
    void removeStoredAttachment(reference);
    setLastAction(`Deleted ${reference.name} and removed its reference links`);
  };

  const updateSettings = (patch: Partial<AppSettings>) =>
    update((current) => ({ ...current, settings: { ...current.settings, ...patch } }));

  const connectChatGPT = (account: ChatGPTAccount) => update((current) => ({ ...current, chatGPTAccount: account }));
  const disconnectChatGPT = () => update((current) => ({ ...current, chatGPTAccount: { connected: false } }));
  const clearLastAction = () => setLastAction(undefined);

  const activeChat = data.chats.find((chat) => !chat.isArchived) || data.chats[0] || {
    id: 'empty',
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    isSaved: false,
    messages: [],
  };

  const value = useMemo<AppStore>(
    () => ({
      data,
      ready,
      lastAction,
      activeChat,
      createChat,
      renameChat,
      deleteChat,
      archiveChat,
      toggleChatFavorite,
      toggleChatPin,
      sendMessage,
      deleteReference,
      organizeChatToNotes,
      applyOrganizationProposal,
      dismissOrganizationProposal,
      createFolder,
      createNote,
      updateNote,
      toggleNoteFavorite,
      toggleNotePin,
      toggleNoteLocked,
      toggleFolderLocked,
      createNotebook,
      updateNotebook,
      addNotebookToNotes,
      createQuiz,
      updateSettings,
      connectChatGPT,
      disconnectChatGPT,
      clearLastAction,
    }),
    [data, ready, lastAction, activeChat],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

export const useAppStore = () => {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppProvider');
  return store;
};
