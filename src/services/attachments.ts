import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Attachment, AttachmentKind } from '../types';
import { makeId } from '../utils/text';

const ATTACHMENTS_DIRECTORY = 'attachments/';
const MAX_EXTRACTED_TEXT_LENGTH = 200_000;

export const SUPPORTED_ATTACHMENT_TYPES = [
  'text/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/*',
];

const extensionFromName = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase();
  return extension && extension !== name.toLowerCase() ? extension : '';
};

const kindFromAsset = (name: string, mimeType = ''): AttachmentKind => {
  const extension = extensionFromName(name);
  const normalizedMimeType = mimeType.toLowerCase();
  if (normalizedMimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(extension)) return 'image';
  if (normalizedMimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (
    normalizedMimeType === 'application/msword' ||
    normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ['doc', 'docx'].includes(extension)
  ) return 'word';
  return 'text';
};

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const persistAsset = async (assetId: string, name: string, sourceUri: string) => {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return sourceUri;
  const directory = `${FileSystem.documentDirectory}${ATTACHMENTS_DIRECTORY}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${assetId}-${safeFileName(name)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
};

const extractText = async (asset: DocumentPicker.DocumentPickerAsset, uri: string) => {
  const content = Platform.OS === 'web' && asset.file
    ? await asset.file.text()
    : await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  return content.length > MAX_EXTRACTED_TEXT_LENGTH ? content.slice(0, MAX_EXTRACTED_TEXT_LENGTH) : content;
};

const toAttachment = async (asset: DocumentPicker.DocumentPickerAsset): Promise<Attachment> => {
  const id = makeId('attachment');
  const mimeType = asset.mimeType || 'application/octet-stream';
  const kind = kindFromAsset(asset.name, mimeType);
  const localUri = await persistAsset(id, asset.name, asset.uri);
  const base: Attachment = {
    id,
    name: asset.name,
    localUri,
    mimeType,
    extension: extensionFromName(asset.name),
    kind,
    size: asset.size,
    createdAt: new Date().toISOString(),
    processingStatus: 'stored',
  };

  if (kind !== 'text') return base;
  try {
    return { ...base, processingStatus: 'ready', extractedText: await extractText(asset, localUri) };
  } catch (error) {
    return {
      ...base,
      processingStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : 'The text could not be read.',
    };
  }
};

/** Opens the platform picker and persists selected files inside the app sandbox. */
export const pickAttachments = async (): Promise<Attachment[]> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: SUPPORTED_ATTACHMENT_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (result.canceled || !result.assets?.length) return [];
  return Promise.all(result.assets.map(toAttachment));
};

export const formatAttachmentSize = (size?: number) => {
  if (!size || size < 1024) return size ? `${size} B` : 'Size unavailable';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const removeStoredAttachment = async (attachment: Attachment) => {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  const attachmentsDirectory = `${FileSystem.documentDirectory}${ATTACHMENTS_DIRECTORY}`;
  if (!attachment.localUri.startsWith(attachmentsDirectory)) return;
  await FileSystem.deleteAsync(attachment.localUri, { idempotent: true });
};

export const attachmentIcon = (kind: AttachmentKind) => {
  if (kind === 'image') return 'image-outline';
  if (kind === 'pdf') return 'document-text-outline';
  if (kind === 'word') return 'document-attach-outline';
  return 'reader-outline';
};
