export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const previewText = (value: string, length = 90) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
};

export const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3);

export const topicFromText = (value: string) => {
  const words = value
    .replace(/[#*_]/g, '')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9'-]/g, ''))
    .filter(Boolean);
  return words.slice(0, 3).join(' ') || 'New Study Notes';
};

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
