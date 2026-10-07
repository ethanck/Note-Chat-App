import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import { AppData } from '../types';

let database: SQLiteDatabase | null = null;

const getDatabase = async () => {
  if (!database) {
    database = await openDatabaseAsync('note-app-chat.db');
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, payload TEXT NOT NULL);',
    );
  }
  return database;
};

export const loadAppData = async (): Promise<AppData | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM app_state WHERE id = 1');
  return row ? (JSON.parse(row.payload) as AppData) : null;
};

export const saveAppData = async (data: AppData) => {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_state (id, payload) VALUES (1, ?)',
    JSON.stringify(data),
  );
};

export const exportAppData = async (data: AppData) => JSON.stringify(data, null, 2);
