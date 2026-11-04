import { completeStructuredChatGPTRequest } from './chatgptAuth';
import { AppData, Folder, Note, OrganizationPlan } from '../types';
import { previewText, tokenize } from '../utils/text';

export type OrganizationRequest = {
  chatTitle: string;
  chatText: string;
  data: AppData;
};

type OrganizationCandidate = {
  id: string;
  kind: 'folder' | 'note';
  title: string;
  parentId: string | null;
  summary: string;
  concepts: string[];
  readability: number;
  childCount: number;
  locked: boolean;
  relevance: number;
};

const ORGANIZATION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['append', 'create', 'split', 'link', 'ask_user'] },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    needsFullText: { type: 'boolean' },
    targetNoteId: { type: ['string', 'null'] },
    targetFolderId: { type: ['string', 'null'] },
    newFolderName: { type: ['string', 'null'] },
    newNoteTitle: { type: ['string', 'null'] },
    rewrittenContent: { type: ['string', 'null'] },
    removedContent: { type: ['string', 'null'] },
    splitFolderName: { type: ['string', 'null'] },
    splitNotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, content: { type: 'string' } },
        required: ['title', 'content'],
      },
    },
    linkNoteIds: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'action',
    'confidence',
    'rationale',
    'needsFullText',
    'targetNoteId',
    'targetFolderId',
    'newFolderName',
    'newNoteTitle',
    'rewrittenContent',
    'removedContent',
    'splitFolderName',
    'splitNotes',
    'linkNoteIds',
  ],
};

const scoreText = (value: string, incomingTokens: Set<string>) =>
  tokenize(value).reduce((score, token) => score + (incomingTokens.has(token) ? 1 : 0), 0);

export const estimateReadability = (value: string) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const sentences = value.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (!words.length) return 100;
  const averageWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const averageWordLength = words.reduce((total, word) => total + word.replace(/[^a-zA-Z]/g, '').length, 0) / words.length;
  return Math.max(0, Math.min(100, Math.round(100 - averageWordsPerSentence * 1.6 - averageWordLength * 2.2)));
};

export const estimateConcepts = (value: string) => Array.from(new Set(tokenize(value))).slice(0, 18);

type OrganizationTreeNode = OrganizationCandidate & {
  children: OrganizationTreeNode[];
  directNotes: OrganizationCandidate[];
};

const noteSummary = (note: Note, incomingTokens: Set<string>, lockedFolderIds: Set<string>): OrganizationCandidate => ({
  id: note.id,
  kind: 'note',
  title: note.title,
  parentId: note.folderId || null,
  summary: previewText(note.content, 280),
  concepts: estimateConcepts(`${note.title} ${note.content}`),
  readability: estimateReadability(note.content),
  childCount: 0,
  locked: Boolean(note.isLocked || (note.folderId && lockedFolderIds.has(note.folderId))),
  relevance: scoreText(`${note.title} ${note.content}`, incomingTokens),
});

const compactCandidate = (candidate: OrganizationCandidate) => ({
  id: candidate.id,
  kind: candidate.kind,
  title: candidate.title,
  parentId: candidate.parentId,
  summary: candidate.summary,
  concepts: candidate.concepts,
  readability: candidate.readability,
  childCount: candidate.childCount,
  locked: candidate.locked,
  relevance: candidate.relevance,
});

/**
 * Builds a bounded hierarchical view. The organizer starts with root summaries,
 * then receives only the most relevant branch and its immediate alternatives.
 * Full note bodies are deliberately excluded until the model requests one.
 */
export const buildOrganizationContext = (data: AppData, chatText: string) => {
  const incomingTokens = new Set(tokenize(chatText));
  const foldersById = new Map(data.folders.map((folder) => [folder.id, folder]));
  const foldersByParent = new Map<string | null, Folder[]>();
  data.folders.forEach((folder) => {
    const parentId = folder.parentId || null;
    const siblings = foldersByParent.get(parentId) || [];
    siblings.push(folder);
    foldersByParent.set(parentId, siblings);
  });

  const lockedFolderIds = new Set<string>();
  data.folders.forEach((folder) => {
    let current: Folder | undefined = folder;
    while (current) {
      if (current.isLocked) {
        lockedFolderIds.add(folder.id);
        break;
      }
      current = current.parentId ? foldersById.get(current.parentId) : undefined;
    }
  });

  const notesByFolder = new Map<string | null, OrganizationCandidate[]>();
  data.notes.forEach((note) => {
    const folderId = note.folderId || null;
    const notes = notesByFolder.get(folderId) || [];
    notes.push(noteSummary(note, incomingTokens, lockedFolderIds));
    notesByFolder.set(folderId, notes);
  });

  const buildNode = (folder: Folder): OrganizationTreeNode => {
    const children = (foldersByParent.get(folder.id) || []).map(buildNode);
    const directNotes = notesByFolder.get(folder.id) || [];
    const directSummary = [
      ...children.map((child) => `${child.title}: ${child.summary}`),
      ...directNotes.map((note) => `${note.title}: ${note.summary}`),
    ].join(' · ');
    const descendantRelevance = children.reduce((best, child) => Math.max(best, child.relevance), 0);
    const relevance = scoreText(`${folder.name} ${directSummary}`, incomingTokens) + Math.round(descendantRelevance * 0.35);
    return {
      id: folder.id,
      kind: 'folder',
      title: folder.name,
      parentId: folder.parentId || null,
      summary: previewText(directSummary || folder.name, 280),
      concepts: estimateConcepts(`${folder.name} ${directSummary}`),
      readability: estimateReadability(directSummary),
      childCount: children.length + directNotes.length,
      locked: lockedFolderIds.has(folder.id),
      relevance,
      children: children.sort((a, b) => b.relevance - a.relevance),
      directNotes: directNotes.sort((a, b) => b.relevance - a.relevance),
    };
  };

  const roots = (foldersByParent.get(null) || []).map(buildNode).sort((a, b) => b.relevance - a.relevance);
  const bestPathFrom = (node: OrganizationTreeNode): OrganizationTreeNode[] => {
    const next = node.children.find((child) => child.relevance > 0);
    return next ? [node, ...bestPathFrom(next)] : [node];
  };
  const selectedPath = roots[0] ? bestPathFrom(roots[0]).slice(0, 6) : [];
  const noteCandidates = Array.from(new Map(
    selectedPath.flatMap((node) => node.directNotes).map((candidate) => [candidate.id, candidate]),
  ).values()).sort((a, b) => b.relevance - a.relevance);
  const topNotes = [...noteCandidates, ...(notesByFolder.get(null) || [])]
    .filter((candidate, index, all) => all.findIndex((other) => other.id === candidate.id) === index)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);
  const pathFolderIds = selectedPath.map((folder) => folder.id);
  const rootCandidates = roots.slice(0, 6).map(compactCandidate);
  const branch = selectedPath.map((node) => ({
    folder: compactCandidate(node),
    siblingFolders: node.children.slice(0, 5).map(compactCandidate),
    notes: node.directNotes.slice(0, 8).map(compactCandidate),
  }));
  const candidateFolders = roots.slice(0, 6).map(compactCandidate);
  const branchCandidates = selectedPath.map(compactCandidate);
  const candidates = [...branchCandidates, ...candidateFolders, ...topNotes.map(compactCandidate)]
    .filter((candidate, index, all) => all.findIndex((other) => other.id === candidate.id) === index);
  return {
    incoming: {
      title: 'Incoming conversation',
      summary: previewText(chatText, 900),
      concepts: estimateConcepts(chatText),
      readability: estimateReadability(chatText),
    },
    traversal: {
      instruction: 'Start at rootFolders, follow the selectedPath when relevant, and choose only IDs present in this traversal.',
      rootFolders: rootCandidates,
      selectedPath: branch,
    },
    candidates,
    candidateNoteIds: topNotes.map((note) => note.id),
    candidateFolderIds: Array.from(new Set([...pathFolderIds, ...roots.slice(0, 6).map((folder) => folder.id)])),
  };
};

const emptyPlan = (overrides: Partial<OrganizationPlan> = {}): OrganizationPlan => ({
  action: 'ask_user',
  confidence: 0,
  rationale: 'The organizer needs a decision before changing the library.',
  needsFullText: false,
  targetNoteId: null,
  targetFolderId: null,
  newFolderName: null,
  newNoteTitle: null,
  rewrittenContent: null,
  removedContent: null,
  splitFolderName: null,
  splitNotes: [],
  linkNoteIds: [],
  ...overrides,
});

const normalizePlan = (raw: Partial<OrganizationPlan>, data: AppData): OrganizationPlan => {
  const noteIds = new Set(data.notes.map((note) => note.id));
  const folderIds = new Set(data.folders.map((folder) => folder.id));
  const action = ['append', 'create', 'split', 'link', 'ask_user'].includes(String(raw.action)) ? raw.action : 'ask_user';
  return emptyPlan({
    ...raw,
    action,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    targetNoteId: raw.targetNoteId && noteIds.has(raw.targetNoteId) ? raw.targetNoteId : null,
    targetFolderId: raw.targetFolderId && folderIds.has(raw.targetFolderId) ? raw.targetFolderId : null,
    linkNoteIds: Array.isArray(raw.linkNoteIds) ? raw.linkNoteIds.filter((id) => noteIds.has(id)) : [],
    splitNotes: Array.isArray(raw.splitNotes) ? raw.splitNotes.filter((note) => note && typeof note.title === 'string' && typeof note.content === 'string') : [],
  });
};

const fallbackPlan = (request: OrganizationRequest): OrganizationPlan => {
  const context = buildOrganizationContext(request.data, request.chatText);
  const bestNote = context.candidates
    .filter((candidate) => candidate.kind === 'note' && !candidate.locked)
    .sort((a, b) => b.relevance - a.relevance)[0];
  if (bestNote && bestNote.relevance >= 2) {
    return emptyPlan({
      action: 'append',
      confidence: Math.min(0.78, 0.45 + bestNote.relevance / 20),
      rationale: `The incoming conversation shares concepts with “${bestNote.title}”, but a model review is recommended.`,
      needsFullText: true,
      targetNoteId: bestNote.id,
    });
  }
  return emptyPlan({
    action: 'create',
    confidence: 0.62,
    rationale: 'No existing unlocked note was a strong enough match, so a new note is recommended for review.',
    newNoteTitle: request.chatTitle,
    rewrittenContent: request.chatText,
  });
};

const planSchemaInput = (request: OrganizationRequest, context: ReturnType<typeof buildOrganizationContext>, fullText?: string) => ({
  conversation: {
    title: request.chatTitle,
    text: request.chatText,
  },
  tree: context,
  selectedNoteFullText: fullText || null,
});

const organizationInstructions = `You are the organization planner for a local-first notes app. Return only the requested JSON plan. You decide where new learning belongs; you do not discuss the plan in prose outside the JSON. Traverse the supplied hierarchy from rootFolders into selectedPath and siblingFolders instead of assuming every note was searched. Only target IDs present in the supplied traversal. Prefer high-confidence actions. Never target locked notes or folders. A locked note may only be appended to when the user explicitly requests that exact note; this request does not grant that permission. Use append when the incoming material clearly belongs in one existing note. Use create when it is a distinct topic. Use split when an existing note has become too broad or difficult to read; the original note should become a folder only when that improves the hierarchy, otherwise split in place. Use link only for meaningful conceptual relationships. Use ask_user when the hierarchy has conflicting plausible destinations or the evidence is insufficient. Summaries and concepts are the default evidence; set needsFullText true only when the exact current note body is needed to decide or rewrite. If full text is supplied, rewrittenContent or splitNotes may rewrite the affected note(s), but preserve correct existing information and do not invent facts.`;

export const requestOrganizationPlan = async (request: OrganizationRequest): Promise<OrganizationPlan> => {
  const context = buildOrganizationContext(request.data, request.chatText);
  try {
    const initial = normalizePlan(await completeStructuredChatGPTRequest<OrganizationPlan>({
      name: 'note_organization_plan',
      schema: ORGANIZATION_SCHEMA,
      instructions: organizationInstructions,
      input: JSON.stringify(planSchemaInput(request, context)),
    }), request.data);
    if (!initial.needsFullText || !initial.targetNoteId) return initial;
    const target = request.data.notes.find((note) => note.id === initial.targetNoteId);
    if (!target || target.isLocked) return emptyPlan({ action: 'ask_user', confidence: 0, rationale: 'The selected note is unavailable for automatic organization.' });
    const detailed = normalizePlan(await completeStructuredChatGPTRequest<OrganizationPlan>({
      name: 'note_organization_detail_plan',
      schema: ORGANIZATION_SCHEMA,
      instructions: `${organizationInstructions} The selected note body is included now. Return a complete rewrittenContent for append, or complete splitNotes for split. Do not return a partial note body.`,
      input: JSON.stringify(planSchemaInput(request, context, target.content)),
    }), request.data);
    return { ...initial, ...detailed, targetNoteId: target.id };
  } catch {
    return fallbackPlan(request);
  }
};

export const mergeReferenceIds = (existing: string[] = [], incoming: string[] = []) => Array.from(new Set([...existing, ...incoming]));
