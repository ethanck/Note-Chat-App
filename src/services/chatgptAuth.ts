import * as SecureStore from 'expo-secure-store';
import { ChatGPTAccount } from '../types';

const ACCOUNT_KEY = 'note-app-chat.chatgpt-account';

export const loadChatGPTAccount = async (): Promise<ChatGPTAccount | null> => {
  const raw = await SecureStore.getItemAsync(ACCOUNT_KEY);
  return raw ? (JSON.parse(raw) as ChatGPTAccount) : null;
};

export const saveChatGPTAccount = async (account: ChatGPTAccount) => {
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(account));
};

export const clearChatGPTAccount = async () => {
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
};

// The OAuth exchange will be plugged into this boundary once the app's
// approved Sign in with ChatGPT client and native callback are configured.
export const chatGPTAuthConfig = {
  provider: 'Sign in with ChatGPT',
  storage: 'iOS Keychain / SecureStore',
  scope: 'identity + eligible Responses API plan usage',
} as const;
