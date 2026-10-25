import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppSettings, ChatGPTAccount, ChatMessage } from '../types';

WebBrowser.maybeCompleteAuthSession();

const CREDENTIALS_KEY = 'note-app-chat.chatgpt-credentials';
const HOST_ID_KEY = 'note-app-chat.chatgpt-host-id';
const AUTHORIZATION_ENDPOINT = 'https://auth.openai.com/api/accounts/authorize';
const TOKEN_ENDPOINT = 'https://auth.openai.com/api/accounts/oauth/token';
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const MODELS_ENDPOINT = 'https://api.openai.com/v1/models';
const JWKS_ENDPOINT = 'https://auth.openai.com/.well-known/jwks.json';
const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const INITIAL_CLIENT_ID = 'dynamic_agent_client';
const AGENT_NAME = 'Note App Chat';
// Sign in with ChatGPT's open-source flow uses a loopback callback. On iOS,
// ASWebAuthenticationSession intercepts the callback and returns it to the app.
const NATIVE_REDIRECT_URI = 'http://127.0.0.1:1455/auth/callback';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';

export type ChatGPTCredentials = {
  clientId: string;
  hostId: string;
  subject: string;
  issuer: string;
  email?: string;
  displayName?: string;
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  model?: string;
};

export type ChatGPTConnection = {
  account: ChatGPTAccount;
  credentials: ChatGPTCredentials;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  earliest_refresh_at?: number;
  error?: string;
  error_description?: string;
};

const encodeBase64Url = (value: string) => value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const encodeForm = (values: Record<string, string | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join('&');

const parseQuery = (url: string) => {
  const query = url.split('?')[1]?.split('#')[0] || '';
  return Object.fromEntries(
    query
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const [key, value = ''] = pair.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' '))];
      }),
  );
};

const getRedirectUri = () => {
  if (Platform.OS !== 'web') return NATIVE_REDIRECT_URI;
  return `${window.location.origin}/oauth/callback`;
};

const getHostId = async () => {
  const existing = await SecureStore.getItemAsync(HOST_ID_KEY);
  if (existing) return existing;
  const hostId = `urn:uuid:${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(HOST_ID_KEY, hostId);
  return hostId;
};

const accountFromCredentials = (credentials: ChatGPTCredentials): ChatGPTAccount => ({
  connected: true,
  email: credentials.email,
  displayName: credentials.displayName,
  connectedAt: new Date().toISOString(),
  subject: credentials.subject,
  clientId: credentials.clientId,
  hostId: credentials.hostId,
  sharingEnabled: credentials.scopes.includes('chatgpt.tokens.use.direct'),
  model: credentials.model,
});

export const loadChatGPTCredentials = async (): Promise<ChatGPTCredentials | null> => {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  return raw ? (JSON.parse(raw) as ChatGPTCredentials) : null;
};

export const loadChatGPTAccount = async (): Promise<ChatGPTAccount | null> => {
  const credentials = await loadChatGPTCredentials();
  return credentials ? accountFromCredentials(credentials) : null;
};

export const saveChatGPTCredentials = async (credentials: ChatGPTCredentials) => {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
};

export const saveChatGPTAccount = async (account: ChatGPTAccount) => {
  const credentials = await loadChatGPTCredentials();
  if (!credentials) return;
  await saveChatGPTCredentials({ ...credentials, ...account });
};

export const clearChatGPTAccount = async () => {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
};

const refreshChatGPTCredentials = async (credentials: ChatGPTCredentials) => {
  if (!credentials.refreshToken) throw new Error('Your ChatGPT connection needs to be renewed.');
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      resource: RESOURCE,
    }),
  });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.error || 'ChatGPT token refresh failed.');
  const refreshed: ChatGPTCredentials = {
    ...credentials,
    accessToken: body.access_token,
    refreshToken: body.refresh_token || credentials.refreshToken,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
    scopes: body.scope?.split(' ').filter(Boolean) || credentials.scopes,
  };
  await saveChatGPTCredentials(refreshed);
  return refreshed;
};

const getUsableCredentials = async () => {
  const stored = await loadChatGPTCredentials();
  if (!stored) throw new Error('Connect with ChatGPT in Settings before starting an AI chat.');
  if (stored.expiresAt > Date.now() + 60_000) return stored;
  return refreshChatGPTCredentials(stored);
};

export const signInWithChatGPT = async (): Promise<ChatGPTConnection> => {
  const previous = await loadChatGPTCredentials();
  const hostId = previous?.hostId || (await getHostId());
  const redirectUri = getRedirectUri();
  const state = Crypto.randomUUID();
  const nonce = Crypto.randomUUID();
  const verifier = encodeBase64Url(`${Crypto.randomUUID()}${Crypto.randomUUID()}`);
  const challenge = encodeBase64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }),
  );
  const clientId = previous?.clientId || INITIAL_CLIENT_ID;
  const parameters: Record<string, string | undefined> = {
    client_id: clientId,
    agent_name_hint: previous ? undefined : AGENT_NAME,
    ext_agent_host_id: hostId,
    id_token_hint: previous?.idToken,
    login_hint: previous?.email,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    resource: RESOURCE,
    state,
    nonce,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  };
  const authorizationUrl = `${AUTHORIZATION_ENDPOINT}?${encodeForm(parameters)}`;
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri, { preferEphemeralSession: false });
  if (result.type !== 'success') throw new Error('ChatGPT sign-in was canceled.');

  const callback = parseQuery(result.url);
  if (callback.state !== state) throw new Error('ChatGPT sign-in could not be verified. Please try again.');
  if (callback.error) throw new Error(callback.error_description || callback.error);
  if (!callback.code) throw new Error('ChatGPT did not return an authorization code.');
  const issuedClientId = callback.client_id || clientId;
  if (issuedClientId === INITIAL_CLIENT_ID) throw new Error('ChatGPT did not finish registering Note App Chat.');

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm({
      grant_type: 'authorization_code',
      client_id: issuedClientId,
      code: callback.code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: RESOURCE,
    }),
  });
  const tokenBody = (await tokenResponse.json()) as TokenResponse;
  if (!tokenResponse.ok || !tokenBody.access_token || !tokenBody.id_token) {
    throw new Error(tokenBody.error_description || tokenBody.error || 'ChatGPT authorization could not be completed.');
  }

  const jwks = createRemoteJWKSet(new URL(JWKS_ENDPOINT));
  const verified = await jwtVerify(tokenBody.id_token, jwks as unknown as Parameters<typeof jwtVerify>[1], {
    issuer: ISSUER,
    audience: issuedClientId,
  });
  const claims = verified.payload;
  if (!claims.sub) throw new Error('ChatGPT did not provide a stable account identity.');
  if (claims.nonce !== nonce) throw new Error('ChatGPT sign-in could not be verified. Please try again.');
  const scopes = (tokenBody.scope || callback.scope || '').split(' ').filter(Boolean);
  const credentials: ChatGPTCredentials = {
    clientId: issuedClientId,
    hostId,
    subject: claims.sub,
    issuer: String(claims.iss || ISSUER),
    email: typeof claims.email === 'string' ? claims.email : undefined,
    displayName: typeof claims.name === 'string' ? claims.name : undefined,
    idToken: tokenBody.id_token,
    accessToken: tokenBody.access_token,
    refreshToken: tokenBody.refresh_token,
    expiresAt: Date.now() + (tokenBody.expires_in || 3600) * 1000,
    scopes,
  };
  await saveChatGPTCredentials(credentials);
  return { account: accountFromCredentials(credentials), credentials };
};

export const listChatGPTModels = async () => {
  const credentials = await getUsableCredentials();
  const response = await fetch(MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${credentials.accessToken}` } });
  if (!response.ok) throw new Error('ChatGPT could not return the models available to this account.');
  const body = (await response.json()) as { models?: Array<{ slug?: string; id?: string; display_name?: string; visibility?: string }> };
  return (body.models || []).filter((model) => model.visibility === undefined || model.visibility === 'list').map((model) => ({
    slug: model.slug || model.id || '',
    name: model.display_name || model.slug || model.id || 'ChatGPT model',
  })).filter((model) => model.slug);
};

const responseTextFromStream = (raw: string) => {
  let text = '';
  let completed = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const event = JSON.parse(payload) as { type?: string; delta?: string; text?: string; response?: { output_text?: string }; error?: { message?: string } };
      if (event.type === 'response.output_text.delta') text += event.delta || '';
      if (event.type === 'response.output_text.done' && !text) text = event.text || '';
      if (event.type === 'response.completed') {
        completed = true;
        if (!text) text = event.response?.output_text || '';
      }
      if (event.type === 'response.failed') throw new Error(`ChatGPT: ${event.error?.message || 'the response failed.'}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ChatGPT')) throw error;
    }
  }
  if (!text) {
    try {
      const json = JSON.parse(raw) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      text = json.output_text || json.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
      completed = Boolean(text);
    } catch {
      // The stream parser below will produce the useful error.
    }
  }
  if (!completed || !text.trim()) throw new Error('ChatGPT returned an incomplete response.');
  return text.trim();
};

const promptContentForMessage = (message: ChatMessage) => {
  const extractedAttachments = (message.attachments || [])
    .filter((attachment) => attachment.extractedText?.trim())
    .map((attachment) => `Attached text from "${attachment.name}":\n${attachment.extractedText}`)
    .join('\n\n');
  return [message.content, extractedAttachments].filter(Boolean).join('\n\n');
};

type ResponsesInput = Array<{ role: 'user' | 'assistant' | 'system'; content: string }> | string;

const requestChatGPT = async ({
  instructions,
  input,
  text,
}: {
  instructions: string;
  input: ResponsesInput;
  text?: { format: Record<string, unknown> };
}) => {
  let credentials = await getUsableCredentials();
  if (!credentials.scopes.includes('chatgpt.tokens.use.direct')) {
    throw new Error('ChatGPT plan usage is not enabled for this connection. Reconnect from Settings and approve plan usage.');
  }
  if (!credentials.model) {
    const [model] = await listChatGPTModels();
    if (!model) throw new Error('No ChatGPT model is available for this account.');
    credentials = { ...credentials, model: model.slug };
    await saveChatGPTCredentials(credentials);
  }
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: credentials.model,
      instructions,
      input,
      store: false,
      stream: true,
      ...(text ? { text } : {}),
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    let message = 'ChatGPT could not answer that request.';
    try {
      const body = JSON.parse(raw) as { error?: { message?: string } };
      message = body.error?.message || message;
    } catch {
      // Keep the generic message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return responseTextFromStream(raw);
};

export const completeChatGPTRequest = async ({
  messages,
  settings,
}: {
  messages: ChatMessage[];
  settings: AppSettings;
}) => {
  const instructions = `You are Note App Chat, a thoughtful study companion. Use an explanation complexity of ${settings.aiComplexity}/10 and a personality of ${settings.aiPersonality}/10. Format responses as ${settings.responseFormat}. Be clear and practical. Do not claim to have access to the user's local files unless they were included in the conversation.`;
  return requestChatGPT({
    instructions,
    input: messages.slice(-24).map((message) => ({ role: message.role, content: promptContentForMessage(message) })),
  });
};

export const completeStructuredChatGPTRequest = async <T>({
  instructions,
  input,
  schema,
  name,
}: {
  instructions: string;
  input: ResponsesInput;
  schema: Record<string, unknown>;
  name: string;
}) => {
  const raw = await requestChatGPT({
    instructions,
    input,
    text: { format: { type: 'json_schema', name, strict: true, schema } },
  });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('ChatGPT returned an invalid organization plan. Please try saving again.');
  }
};

export const openChatGPTUsageSettings = () => WebBrowser.openBrowserAsync('https://chatgpt.com/#settings/usage');

export const chatGPTAuthConfig = {
  provider: 'Sign in with ChatGPT',
  storage: 'iOS Keychain / SecureStore',
  scope: SCOPES,
  redirectUri: NATIVE_REDIRECT_URI,
} as const;
