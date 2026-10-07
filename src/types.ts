export type TabKey = 'chat' | 'notes' | 'quizzes' | 'notebook';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachmentName?: string;
};

export type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  messages: ChatMessage[];
};

export type Folder = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  isPinned: boolean;
  isFavorite: boolean;
};

export type NoteChange = {
  added: string;
  removed?: string;
  createdAt: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  notebookId?: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isFavorite: boolean;
  latestChange?: NoteChange;
};

export type Notebook = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
};

export type Quiz = {
  id: string;
  title: string;
  questionCount: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdAt: string;
  questions: QuizQuestion[];
  lastScore?: number;
};

export type AppSettings = {
  aiComplexity: number;
  aiPersonality: number;
  responseFormat: 'Bullet Points' | 'Numbered Lists' | 'Paragraphs';
  notebookFont: 'System' | 'Serif' | 'Monospace';
};

export type ChatGPTAccount = {
  connected: boolean;
  email?: string;
  displayName?: string;
  connectedAt?: string;
};

export type AppData = {
  chats: Chat[];
  folders: Folder[];
  notes: Note[];
  notebooks: Notebook[];
  quizzes: Quiz[];
  settings: AppSettings;
  chatGPTAccount: ChatGPTAccount;
};
