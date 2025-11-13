import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let db = null;

// Firebaseクライアントの初期化
export function initFirebase() {
  if (db) return db;

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;

    if (!serviceAccount) {
      console.warn('Firebase credentials not found. Using local storage only.');
      return null;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    db = admin.firestore();
    console.log('Firebase client initialized');
    return db;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

// 認証セッションを保存
export async function saveSession(sessionId, sessionData) {
  const db = initFirebase();
  if (!db) return false;

  try {
    await db.collection('auth_sessions').doc(sessionId).set({
      data: sessionData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Failed to save session to Firebase:', error);
    return false;
  }
}

// 認証セッションを取得
export async function getSession(sessionId) {
  const db = initFirebase();
  if (!db) return null;

  try {
    const doc = await db.collection('auth_sessions').doc(sessionId).get();
    return doc.exists ? doc.data().data : null;
  } catch (error) {
    console.error('Failed to get session from Firebase:', error);
    return null;
  }
}

// 全セッションを取得
export async function getAllSessions() {
  const db = initFirebase();
  if (!db) return [];

  try {
    const snapshot = await db.collection('auth_sessions').get();
    return snapshot.docs.map(doc => [doc.id, doc.data().data]);
  } catch (error) {
    console.error('Failed to get all sessions from Firebase:', error);
    return [];
  }
}

// 認証済みユーザーを保存
export async function saveUser(userId, userData) {
  const db = initFirebase();
  if (!db) return false;

  try {
    await db.collection('authenticated_users').doc(userId).set({
      data: userData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Failed to save user to Firebase:', error);
    return false;
  }
}

// 認証済みユーザーを取得
export async function getUser(userId) {
  const db = initFirebase();
  if (!db) return null;

  try {
    const doc = await db.collection('authenticated_users').doc(userId).get();
    return doc.exists ? doc.data().data : null;
  } catch (error) {
    console.error('Failed to get user from Firebase:', error);
    return null;
  }
}

// 全ユーザーを取得
export async function getAllUsers() {
  const db = initFirebase();
  if (!db) return [];

  try {
    const snapshot = await db.collection('authenticated_users').get();
    return snapshot.docs.map(doc => [doc.id, doc.data().data]);
  } catch (error) {
    console.error('Failed to get all users from Firebase:', error);
    return [];
  }
}

// サーバー設定を保存
export async function saveGuildSettings(guildId, settings) {
  const db = initFirebase();
  if (!db) return false;

  try {
    await db.collection('guild_settings').doc(guildId).set({
      settings: settings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Failed to save guild settings to Firebase:', error);
    return false;
  }
}

// サーバー設定を取得
export async function getGuildSettings(guildId) {
  const db = initFirebase();
  if (!db) return null;

  try {
    const doc = await db.collection('guild_settings').doc(guildId).get();
    return doc.exists ? doc.data().settings : null;
  } catch (error) {
    console.error('Failed to get guild settings from Firebase:', error);
    return null;
  }
}

// 全サーバー設定を取得
export async function getAllGuildSettings() {
  const db = initFirebase();
  if (!db) return [];

  try {
    const snapshot = await db.collection('guild_settings').get();
    return snapshot.docs.map(doc => [doc.id, doc.data().settings]);
  } catch (error) {
    console.error('Failed to get all guild settings from Firebase:', error);
    return [];
  }
}

// 古いセッションを削除（24時間以上経過したもの）
export async function cleanupOldSessions() {
  const db = initFirebase();
  if (!db) return false;

  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapshot = await db.collection('auth_sessions')
      .where('createdAt', '<', cutoffTime)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`Cleaned up ${snapshot.size} old sessions from Firebase`);
    return true;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return false;
  }
}
