import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client = null;
let db = null;

// MongoDBクライアントの初期化
export async function initMongoDB() {
  if (db) return db;

  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.warn('MongoDB URI not found. Using local storage only.');
      return null;
    }

    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db();
    console.log('MongoDB client initialized');
    return db;
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error);
    return null;
  }
}

// 認証セッションを保存
export async function saveSession(sessionId, sessionData) {
  const db = await initMongoDB();
  if (!db) return false;

  try {
    await db.collection('auth_sessions').updateOne(
      { _id: sessionId },
      {
        $set: {
          data: sessionData,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Failed to save session to MongoDB:', error);
    return false;
  }
}

// 認証セッションを取得
export async function getSession(sessionId) {
  const db = await initMongoDB();
  if (!db) return null;

  try {
    const doc = await db.collection('auth_sessions').findOne({ _id: sessionId });
    return doc ? doc.data : null;
  } catch (error) {
    console.error('Failed to get session from MongoDB:', error);
    return null;
  }
}

// 全セッションを取得
export async function getAllSessions() {
  const db = await initMongoDB();
  if (!db) return [];

  try {
    const docs = await db.collection('auth_sessions').find().toArray();
    return docs.map(doc => [doc._id, doc.data]);
  } catch (error) {
    console.error('Failed to get all sessions from MongoDB:', error);
    return [];
  }
}

// 認証済みユーザーを保存
export async function saveUser(userId, userData) {
  const db = await initMongoDB();
  if (!db) return false;

  try {
    await db.collection('authenticated_users').updateOne(
      { _id: userId },
      {
        $set: {
          data: userData,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Failed to save user to MongoDB:', error);
    return false;
  }
}

// 認証済みユーザーを取得
export async function getUser(userId) {
  const db = await initMongoDB();
  if (!db) return null;

  try {
    const doc = await db.collection('authenticated_users').findOne({ _id: userId });
    return doc ? doc.data : null;
  } catch (error) {
    console.error('Failed to get user from MongoDB:', error);
    return null;
  }
}

// 全ユーザーを取得
export async function getAllUsers() {
  const db = await initMongoDB();
  if (!db) return [];

  try {
    const docs = await db.collection('authenticated_users').find().toArray();
    return docs.map(doc => [doc._id, doc.data]);
  } catch (error) {
    console.error('Failed to get all users from MongoDB:', error);
    return [];
  }
}

// サーバー設定を保存
export async function saveGuildSettings(guildId, settings) {
  const db = await initMongoDB();
  if (!db) return false;

  try {
    await db.collection('guild_settings').updateOne(
      { _id: guildId },
      {
        $set: {
          settings: settings,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Failed to save guild settings to MongoDB:', error);
    return false;
  }
}

// サーバー設定を取得
export async function getGuildSettings(guildId) {
  const db = await initMongoDB();
  if (!db) return null;

  try {
    const doc = await db.collection('guild_settings').findOne({ _id: guildId });
    return doc ? doc.settings : null;
  } catch (error) {
    console.error('Failed to get guild settings from MongoDB:', error);
    return null;
  }
}

// 全サーバー設定を取得
export async function getAllGuildSettings() {
  const db = await initMongoDB();
  if (!db) return [];

  try {
    const docs = await db.collection('guild_settings').find().toArray();
    return docs.map(doc => [doc._id, doc.settings]);
  } catch (error) {
    console.error('Failed to get all guild settings from MongoDB:', error);
    return [];
  }
}

// 古いセッションを削除（24時間以上経過したもの）
export async function cleanupOldSessions() {
  const db = await initMongoDB();
  if (!db) return false;

  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db.collection('auth_sessions').deleteMany({
      createdAt: { $lt: cutoffTime },
    });

    console.log(`Cleaned up ${result.deletedCount} old sessions from MongoDB`);
    return true;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return false;
  }
}
