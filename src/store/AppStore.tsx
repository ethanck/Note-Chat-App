import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createDefaultData } from '../data/defaults';
import { loadAppData, saveAppData } from '../data/storage';
import {
  AppData,
  AppSettings,
  Chat,
  ChatMessage,
  ChatGPTAccount,
  Folder,
  Note,
  NoteChange,
  Notebook,
  Quiz,
} from '../types';
import { makeId, previewText, tokenize, topicFromText } from '../utils/text';
import { completeChatGPTRequest, loadChatGPTAccount } from '../services/chatgptAuth';

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
  sendMessage: (chatId: string, content: string, attachmentName?: string) => Promise<void>;
  organizeChatToNotes: (chatId: string) => void;
  createFolder: (name: string, parentId?: string) => string;
  createNote: (note: Partial<Note> & Pick<Note, 'title' | 'content'>) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  toggleNoteFavorite: (id: string) => void;
  toggleNotePin: (id: string) => void;
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

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [lastAction, setLastAction] = useState<string>();

  useEffect(() => {
    Promise.all([loadAppData(), loadChatGPTAccount()])
      .then(([stored, account]) => {
        if (stored) setData({ ...stored, chatGPTAccount: account || { connected: false } });
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

  const deleteChat = (id: string) =>
    update((current) => ({ ...current, chats: current.chats.filter((chat) => chat.id !== id) }));

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

  const sendMessage = async (chatId: string, content: string, attachmentName?: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: makeId('message'),
      role: 'user',
      content: trimmed,
      createdAt: now,
      attachmentName,
    };
    const chat = data.chats.find((item) => item.id === chatId);
    if (!chat) return;
    update((current) => ({
      ...current,
      chats: current.chats.map((item) =>
        item.id === chatId
          ? {
              ...item,
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
        { id, name: name.trim() || 'Untitled Folder', parentId, createdAt: new Date().toISOString(), isPinned: false, isFavorite: false },
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
      return;
    }

    createNote({ title: `Notes from ${title}`, content: text, folderId: targetFolderId });
    setLastAction(`${action || 'Created a new note'} · changes applied automatically`);
  };

  const organizeChatToNotes = (chatId: string) => {
    const chat = data.chats.find((item) => item.id === chatId);
    if (!chat) return;
    const text = chat.messages
      .map((message) => `${message.role === 'user' ? 'Question' : 'Answer'}: ${message.content}`)
      .join('\n\n');
    organizeTextToNotes(text, chat.title);
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
      organizeChatToNotes,
      createFolder,
      createNote,
      updateNote,
      toggleNoteFavorite,
      toggleNotePin,
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
