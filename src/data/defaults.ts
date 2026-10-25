import { AppData, Chat } from '../types';
import { makeId } from '../utils/text';

const now = new Date().toISOString();

const welcomeChat: Chat = {
  id: makeId('chat'),
  title: 'Welcome to Note App Chat',
  createdAt: now,
  updatedAt: now,
  isPinned: true,
  isFavorite: true,
  isArchived: false,
  isSaved: true,
  messages: [
    {
      id: makeId('message'),
      role: 'assistant',
      content:
        'Welcome! I can help you think through ideas, turn conversations into organized notes, and build quizzes from what you learn. Try asking me something or open the drawer to explore your workspace.',
      createdAt: now,
    },
  ],
};

export const createDefaultData = (): AppData => ({
  chats: [welcomeChat],
  references: [],
  folders: [
    { id: makeId('folder'), name: 'Getting Started', createdAt: now, isPinned: true, isFavorite: true, isLocked: false },
    { id: makeId('folder'), name: 'Ideas', createdAt: now, isPinned: false, isFavorite: false, isLocked: false },
  ],
  notes: [
    {
      id: makeId('note'),
      title: 'How this workspace works',
      content:
        '# Your learning workspace\n\n- Chat with your AI tutor\n- Save useful conversations into structured notes\n- Create quizzes when you are ready to test yourself\n- Keep a scratchpad for ideas and writing',
      folderId: undefined,
      createdAt: now,
      updatedAt: now,
      isPinned: true,
      isFavorite: true,
      isLocked: false,
      referenceIds: [],
      relatedNoteIds: [],
    },
  ],
  notebooks: [
    {
      id: makeId('notebook'),
      name: 'New Notebook',
      content: '',
      createdAt: now,
      updatedAt: now,
    },
  ],
  quizzes: [],
  organizationProposals: [],
  settings: {
    aiComplexity: 5,
    aiPersonality: 6,
    responseFormat: 'Bullet Points',
    notebookFont: 'System',
    organizationMode: 'automatic',
    organizationConfidenceThreshold: 0.85,
  },
  chatGPTAccount: { connected: false },
});
