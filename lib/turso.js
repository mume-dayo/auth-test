import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

let client = null;

// Tursoクライアントの初期化
export async function initTurso() {
  if (client) return client;

  try {
    const tursoUrl = process.env.TURSO_URL;
    const tursoToken = process.env.TURSO_TOKEN;

    if (!tursoUrl || !tursoToken) {
      console.warn('Turso credentials not found. Using local storage only.');
      return null;
    }

    client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });

    // テーブルを作成
    await client.execute(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS authenticated_users (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        id TEXT PRIMARY KEY,
        settings TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    console.log('Turso client initialized');
    return client;
  } catch (error) {
    console.error('Failed to initialize Turso:', error);
    return null;
  }
}

// 認証セッションを保存
export async function saveSession(sessionId, sessionData) {
  const db = await initTurso();
  if (!db) return false;

  try {
    await db.execute({
      sql: 'INSERT OR REPLACE INTO auth_sessions (id, data, created_at) VALUES (?, ?, ?)',
      args: [sessionId, JSON.stringify(sessionData), Date.now()],
    });
    return true;
  } catch (error) {
    console.error('Failed to save session to Turso:', error);
    return false;
  }
}

// 認証セッションを取得
export async function getSession(sessionId) {
  const db = await initTurso();
  if (!db) return null;

  try {
    const result = await db.execute({
      sql: 'SELECT data FROM auth_sessions WHERE id = ?',
      args: [sessionId],
    });
    return result.rows.length > 0 ? JSON.parse(result.rows[0].data) : null;
  } catch (error) {
    console.error('Failed to get session from Turso:', error);
    return null;
  }
}

// 全セッションを取得
export async function getAllSessions() {
  const db = await initTurso();
  if (!db) return [];

  try {
    const result = await db.execute('SELECT id, data FROM auth_sessions');
    return result.rows.map(row => [row.id, JSON.parse(row.data)]);
  } catch (error) {
    console.error('Failed to get all sessions from Turso:', error);
    return [];
  }
}

// 認証済みユーザーを保存
export async function saveUser(userId, userData) {
  const db = await initTurso();
  if (!db) return false;

  try {
    await db.execute({
      sql: 'INSERT OR REPLACE INTO authenticated_users (id, data, updated_at) VALUES (?, ?, ?)',
      args: [userId, JSON.stringify(userData), Date.now()],
    });
    return true;
  } catch (error) {
    console.error('Failed to save user to Turso:', error);
    return false;
  }
}

// 認証済みユーザーを取得
export async function getUser(userId) {
  const db = await initTurso();
  if (!db) return null;

  try {
    const result = await db.execute({
      sql: 'SELECT data FROM authenticated_users WHERE id = ?',
      args: [userId],
    });
    return result.rows.length > 0 ? JSON.parse(result.rows[0].data) : null;
  } catch (error) {
    console.error('Failed to get user from Turso:', error);
    return null;
  }
}

// 全ユーザーを取得
export async function getAllUsers() {
  const db = await initTurso();
  if (!db) return [];

  try {
    const result = await db.execute('SELECT id, data FROM authenticated_users');
    return result.rows.map(row => [row.id, JSON.parse(row.data)]);
  } catch (error) {
    console.error('Failed to get all users from Turso:', error);
    return [];
  }
}

// サーバー設定を保存
export async function saveGuildSettings(guildId, settings) {
  const db = await initTurso();
  if (!db) return false;

  try {
    await db.execute({
      sql: 'INSERT OR REPLACE INTO guild_settings (id, settings, updated_at) VALUES (?, ?, ?)',
      args: [guildId, JSON.stringify(settings), Date.now()],
    });
    return true;
  } catch (error) {
    console.error('Failed to save guild settings to Turso:', error);
    return false;
  }
}

// サーバー設定を取得
export async function getGuildSettings(guildId) {
  const db = await initTurso();
  if (!db) return null;

  try {
    const result = await db.execute({
      sql: 'SELECT settings FROM guild_settings WHERE id = ?',
      args: [guildId],
    });
    return result.rows.length > 0 ? JSON.parse(result.rows[0].settings) : null;
  } catch (error) {
    console.error('Failed to get guild settings from Turso:', error);
    return null;
  }
}

// 全サーバー設定を取得
export async function getAllGuildSettings() {
  const db = await initTurso();
  if (!db) return [];

  try {
    const result = await db.execute('SELECT id, settings FROM guild_settings');
    return result.rows.map(row => [row.id, JSON.parse(row.settings)]);
  } catch (error) {
    console.error('Failed to get all guild settings from Turso:', error);
    return [];
  }
}

// 古いセッションを削除（24時間以上経過したもの）
export async function cleanupOldSessions() {
  const db = await initTurso();
  if (!db) return false;

  try {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    const result = await db.execute({
      sql: 'DELETE FROM auth_sessions WHERE created_at < ?',
      args: [cutoffTime],
    });

    console.log(`Cleaned up ${result.rowsAffected} old sessions from Turso`);
    return true;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return false;
  }
}
