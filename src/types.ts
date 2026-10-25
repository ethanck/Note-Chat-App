export type TabKey = 'chat' | 'notes' | 'quizzes' | 'notebook';

export type ChatRole = 'user' | 'assistant';

export type AttachmentKind = 'text' | 'pdf' | 'word' | 'image';

export type AttachmentProcessingStatus = 'ready' | 'stored' | 'failed';

export type Attachment = {
  id: string;
  name: string;
  localUri: string;
  mimeType: string;
  extension: string;
  kind: AttachmentKind;
  size?: number;
  createdAt: string;
  processingStatus: AttachmentProcessingStatus;
  extractedText?: string;
  errorMessage?: string;
};

export type Reference = Attachment & {
  chatIds: string[];
  noteIds: string[];
  folderId?: string;
  isInInbox: boolean;
  savedToNotesAt?: string;
};

export type OrganizationAction = 'append' | 'create' | 'split' | 'link' | 'ask_user';

export type OrganizationPlan = {
  action: OrganizationAction;
  confidence: number;
  rationale: string;
  needsFullText: boolean;
  targetNoteId: string | null;
  targetFolderId: string | null;
  newFolderName: string | null;
  newNoteTitle: string | null;
  rewrittenContent: string | null;
  removedContent: string | null;
  splitFolderName: string | null;
  splitNotes: Array<{ title: string; content: string }>;
  linkNoteIds: string[];
};

export type OrganizationProposal = {
  id: string;
  chatId: string;
  chatTitle: string;
  createdAt: string;
  status: 'pending' | 'applied' | 'dismissed';
  plan: OrganizationPlan;
  referenceIds: string[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: Attachment[];
  /** Kept for migration of chats saved before the attachment model existed. */
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
  isSaved: boolean;
  messages: ChatMessage[];
};

export type Folder = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  isPinned: boolean;
  isFavorite: boolean;
  isLocked?: boolean;
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
  isLocked?: boolean;
  referenceIds?: string[];
  relatedNoteIds?: string[];
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
  organizationMode: 'automatic' | 'review';
  organizationConfidenceThreshold: number;
};

export type ChatGPTAccount = {
  connected: boolean;
  email?: string;
  displayName?: string;
  connectedAt?: string;
  subject?: string;
  clientId?: string;
  hostId?: string;
  sharingEnabled?: boolean;
  model?: string;
};

export type AppData = {
  chats: Chat[];
  references: Reference[];
  folders: Folder[];
  notes: Note[];
  notebooks: Notebook[];
  quizzes: Quiz[];
  organizationProposals: OrganizationProposal[];
  settings: AppSettings;
  chatGPTAccount: ChatGPTAccount;
};
