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
  Notebook,
  OrganizationPlan,
  OrganizationProposal,
  Quiz,
  Reference,
} from '../types';
import { makeId, previewText } from '../utils/text';
import { completeChatGPTRequest, completeStructuredChatGPTRequest, loadChatGPTAccount } from '../services/chatgptAuth';
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
  canUndoOrganization: boolean;
  undoLastOrganization: () => void;
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
  addNotebookToNotes: (id: string) => Promise<void>;
  createQuiz: (title?: string) => Promise<void>;
  saveQuizScore: (id: string, score: number) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  connectChatGPT: (account: ChatGPTAccount) => void;
  disconnectChatGPT: () => void;
  clearLastAction: () => void;
};

type OrganizationCollections = Pick<AppData, 'folders' | 'notes' | 'chats' | 'references' | 'organizationProposals'>;

type OrganizationUndo = {
  id: string;
  label: string;
  before: OrganizationCollections;
  after: OrganizationCollections;
};

const AppStoreContext = createContext<AppStore | null>(null);

const disconnectedReply = 'Connect with ChatGPT in Settings to receive an AI response. Your chats and notes remain local until you choose to connect.';

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
  .map((message) => {
    const attachments = (message.attachments || [])
      .map((attachment) => attachment.extractedText?.trim() ? `Attached text from “${attachment.name}”:\n${attachment.extractedText}` : `Attached file: ${attachment.name}`)
      .join('\n\n');
    return [`${message.role === 'user' ? 'Question' : 'Answer'}: ${message.content}`, attachments].filter(Boolean).join('\n\n');
  })
  .join('\n\n');

const applyOrganizationPlan = (current: AppData, sourceId: string, plan: OrganizationPlan, sourceType: 'chat' | 'notebook' = 'chat'): { data: AppData; noteIds: string[]; folderId?: string; label: string } => {
  const chat = sourceType === 'chat' ? current.chats.find((item) => item.id === sourceId) : undefined;
  const notebook = sourceType === 'notebook' ? current.notebooks.find((item) => item.id === sourceId) : undefined;
  if (!chat && !notebook) return { data: current, noteIds: [], label: sourceType === 'notebook' ? 'Notebook could not be found' : 'Chat could not be found' };
  const sourceTitle = chat?.title || notebook?.name || 'Notes from source';
  const sourceText = chat ? chatText(chat) : notebook?.content || '';
  const now = new Date().toISOString();
  const notes = [...current.notes];
  const folders = [...current.folders];
  const addedNoteIds: string[] = [];
  let targetFolderId: string | undefined;
  let label = sourceType === 'notebook' ? 'Saved notebook to Notes' : 'Saved conversation to Notes';
  const incomingReferenceIds = sourceType === 'chat'
    ? current.references.filter((reference) => reference.chatIds.includes(sourceId)).map((reference) => reference.id)
    : [];

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
      content: content.trim() || sourceText,
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
      const rewritten = plan.rewrittenContent?.trim() || `${target.content.trim()}\n\n${sourceText}`;
      notes.splice(notes.indexOf(target), 1, {
        ...target,
        content: rewritten,
        updatedAt: now,
        referenceIds: mergeReferenceIds(target.referenceIds, incomingReferenceIds),
        latestChange: {
          added: rewritten === target.content ? sourceText : rewritten,
          removed: plan.removedContent || (rewritten !== target.content ? target.content : undefined),
          createdAt: now,
        },
      });
      addedNoteIds.push(target.id);
      targetFolderId = target.folderId;
      label = `Updated “${target.title}”`;
    }
  } else if (plan.action === 'create') {
    if (plan.newFolderName) targetFolderId = addFolder(plan.newFolderName, targetFolderId);
    addNote(plan.newNoteTitle || sourceTitle, plan.rewrittenContent || sourceText, targetFolderId);
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
    chats: sourceType === 'chat'
      ? current.chats.map((item) => item.id === sourceId ? { ...item, isSaved: true, updatedAt: savedReferenceAt } : item)
      : current.chats,
    references: current.references.map((reference) => reference.chatIds.includes(sourceId)
      ? { ...reference, folderId: targetFolderId, isInInbox: false, savedToNotesAt: savedReferenceAt, noteIds: mergeReferenceIds(reference.noteIds, addedNoteIds) }
      : reference),
  };
  return { data: next, noteIds: addedNoteIds, folderId: targetFolderId, label };
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [lastAction, setLastAction] = useState<string>();
  const [organizationUndo, setOrganizationUndo] = useState<OrganizationUndo>();

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

  const organizeChatToNotes = async (chatId: string): Promise<'saved' | 'review' | 'failed'> => {
    const chat = data.chats.find((item) => item.id === chatId);
    if (!chat || !chat.messages.length) return 'failed';
    const existingProposal = data.organizationProposals.find((proposal) => proposal.chatId === chatId && proposal.status === 'pending');
    if (existingProposal) {
      setLastAction(`Organization proposal ready for “${chat.title}” · review required`);
      return 'review';
    }
    const plan = await requestOrganizationPlan({ chatTitle: chat.title, chatText: chatText(chat), data });
    const proposal: OrganizationProposal = {
      id: makeId('organization-proposal'),
      chatId,
      sourceId: chatId,
      sourceType: 'chat',
      chatTitle: chat.title,
      createdAt: new Date().toISOString(),
      status: 'pending',
      plan,
      referenceIds: data.references.filter((reference) => reference.chatIds.includes(chatId)).map((reference) => reference.id),
    };
    update((current) => ({ ...current, organizationProposals: [...current.organizationProposals, proposal] }));
    setLastAction(`Organization proposal ready for “${chat.title}” · review required`);
    return 'review';
  };

  const applyOrganizationProposal = (id: string) => {
    const proposal = data.organizationProposals.find((item) => item.id === id && item.status === 'pending');
    if (!proposal) return;
    const before = data;
    const sourceType = proposal.sourceType || 'chat';
    const sourceId = proposal.sourceId || proposal.chatId;
    const result = applyOrganizationPlan(before, sourceId, proposal.plan, sourceType);
    if (result.data === before) {
      setLastAction(result.label);
      return;
    }
    const after = {
      ...result.data,
      organizationProposals: result.data.organizationProposals.map((item) => item.id === id ? { ...item, status: 'applied' as const } : item),
    };
    update(() => after);
    setOrganizationUndo({
      id: makeId('organization-undo'),
      label: result.label,
      before: {
        folders: before.folders,
        notes: before.notes,
        chats: before.chats,
        references: before.references,
        organizationProposals: before.organizationProposals,
      },
      after: {
        folders: after.folders,
        notes: after.notes,
        chats: after.chats,
        references: after.references,
        organizationProposals: after.organizationProposals,
      },
    });
    setLastAction(`${result.label} · organization proposal applied`);
  };

  const undoLastOrganization = () => {
    const undo = organizationUndo;
    if (!undo) return;
    update((current) => ({
      ...current,
      folders: current.folders === undo.after.folders ? undo.before.folders : current.folders,
      notes: current.notes === undo.after.notes ? undo.before.notes : current.notes,
      chats: current.chats === undo.after.chats ? undo.before.chats : current.chats,
      references: current.references === undo.after.references ? undo.before.references : current.references,
      organizationProposals: current.organizationProposals === undo.after.organizationProposals ? undo.before.organizationProposals : current.organizationProposals,
    }));
    setOrganizationUndo(undefined);
    setLastAction(`Undid ${undo.label}`);
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

  const addNotebookToNotes = async (id: string) => {
    const notebook = data.notebooks.find((item) => item.id === id);
    if (!notebook || !notebook.content.trim()) return;
    const existingProposal = data.organizationProposals.find((proposal) => proposal.sourceType === 'notebook' && proposal.sourceId === id && proposal.status === 'pending');
    if (existingProposal) {
      setLastAction(`Organization proposal ready for “${notebook.name}” · review required`);
      return;
    }
    if (!data.chatGPTAccount.connected) {
      setLastAction('Connect with ChatGPT before organizing a notebook');
      return;
    }
    try {
      const plan = await requestOrganizationPlan({ chatTitle: notebook.name, chatText: notebook.content, data });
      const proposal: OrganizationProposal = {
        id: makeId('organization-proposal'),
        chatId: '',
        sourceId: id,
        sourceType: 'notebook',
        chatTitle: notebook.name,
        createdAt: new Date().toISOString(),
        status: 'pending',
        plan,
        referenceIds: [],
      };
      update((current) => ({ ...current, organizationProposals: [...current.organizationProposals, proposal] }));
      setLastAction(`Organization proposal ready for “${notebook.name}” · review required`);
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : 'Notebook organization failed. Please try again.');
    }
  };

  const createQuiz = async (title = 'Study Checkpoint') => {
    if (!data.notes.length) {
      setLastAction('Add at least one note before generating a quiz');
      return;
    }
    if (!data.chatGPTAccount.connected) {
      setLastAction('Connect with ChatGPT before generating a quiz');
      return;
    }
    const quizSchema: Record<string, unknown> = {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
        questions: {
          type: 'array',
          minItems: 3,
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              prompt: { type: 'string' },
              options: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string' } },
              answer: { type: 'string' },
            },
            required: ['prompt', 'options', 'answer'],
          },
        },
      },
      required: ['title', 'difficulty', 'questions'],
    };
    const notesContext = data.notes
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 12)
      .map((note) => `NOTE: ${note.title}\n${previewText(note.content, 1200)}`)
      .join('\n\n');
    try {
      const generated = await completeStructuredChatGPTRequest<{
        title: string;
        difficulty: Quiz['difficulty'];
        questions: Array<{ prompt: string; options: string[]; answer: string }>;
      }>({
        name: 'study_quiz',
        schema: quizSchema,
        instructions: 'You generate accurate study quizzes from local notes. Return only JSON. Write 3 to 8 questions that test understanding, not trivia. Every answer must exactly match one option. Do not invent facts outside the supplied notes.',
        input: `Create a quiz titled “${title}” from these notes:\n\n${notesContext}`,
      });
      const questions = generated.questions
        .filter((question) => question.prompt?.trim() && question.options?.length >= 3 && question.options.includes(question.answer))
        .map((question) => ({ ...question, id: makeId('question'), options: question.options.slice(0, 4) }));
      if (!questions.length) throw new Error('ChatGPT returned no usable quiz questions.');
      const quiz: Quiz = {
        id: makeId('quiz'),
        title: generated.title?.trim() || title,
        questionCount: questions.length,
        difficulty: generated.difficulty || 'Medium',
        createdAt: new Date().toISOString(),
        questions,
      };
      update((current) => ({ ...current, quizzes: [quiz, ...current.quizzes] }));
      setLastAction('Quiz generated from your local notes');
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : 'Quiz generation failed. Please try again.');
    }
  };

  const saveQuizScore = (id: string, score: number) =>
    update((current) => ({
      ...current,
      quizzes: current.quizzes.map((quiz) => quiz.id === id ? { ...quiz, lastScore: score } : quiz),
    }));

  const deleteReference = (id: string) => {
    const reference = data.references.find((item) => item.id === id);
    if (!reference) return;
    update((current) => ({
      ...current,
      references: current.references.filter((item) => item.id !== id),
      notes: current.notes.map((note) => ({ ...note, referenceIds: note.referenceIds?.filter((referenceId) => referenceId !== id) })),
      organizationProposals: current.organizationProposals.map((proposal) => ({ ...proposal, referenceIds: proposal.referenceIds.filter((referenceId) => referenceId !== id) })),
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
      canUndoOrganization: Boolean(organizationUndo),
      undoLastOrganization,
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
      saveQuizScore,
      updateSettings,
      connectChatGPT,
      disconnectChatGPT,
      clearLastAction,
    }),
    [data, ready, lastAction, activeChat, organizationUndo],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

export const useAppStore = () => {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppProvider');
  return store;
};
