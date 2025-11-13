import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

// Supabaseクライアントの初期化
export function initSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not found. Using local storage only.');
    return null;
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');
  }

  return supabase;
}

// 認証セッションを保存
export async function saveSession(sessionId, sessionData) {
  const client = initSupabase();
  if (!client) return false;

  try {
    const { error } = await client
      .from('auth_sessions')
      .upsert({
        session_id: sessionId,
        data: sessionData,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save session to Supabase:', error);
    return false;
  }
}

// 認証セッションを取得
export async function getSession(sessionId) {
  const client = initSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('auth_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) throw error;
    return data?.data || null;
  } catch (error) {
    console.error('Failed to get session from Supabase:', error);
    return null;
  }
}

// 全セッションを取得
export async function getAllSessions() {
  const client = initSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('auth_sessions')
      .select('*');

    if (error) throw error;
    return data.map(row => [row.session_id, row.data]);
  } catch (error) {
    console.error('Failed to get all sessions from Supabase:', error);
    return [];
  }
}

// 認証済みユーザーを保存
export async function saveUser(userId, userData) {
  const client = initSupabase();
  if (!client) return false;

  try {
    const { error } = await client
      .from('authenticated_users')
      .upsert({
        user_id: userId,
        data: userData,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save user to Supabase:', error);
    return false;
  }
}

// 認証済みユーザーを取得
export async function getUser(userId) {
  const client = initSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('authenticated_users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.data || null;
  } catch (error) {
    console.error('Failed to get user from Supabase:', error);
    return null;
  }
}

// 全ユーザーを取得
export async function getAllUsers() {
  const client = initSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('authenticated_users')
      .select('*');

    if (error) throw error;
    return data.map(row => [row.user_id, row.data]);
  } catch (error) {
    console.error('Failed to get all users from Supabase:', error);
    return [];
  }
}

// サーバー設定を保存
export async function saveGuildSettings(guildId, settings) {
  const client = initSupabase();
  if (!client) return false;

  try {
    const { error } = await client
      .from('guild_settings')
      .upsert({
        guild_id: guildId,
        settings: settings,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to save guild settings to Supabase:', error);
    return false;
  }
}

// サーバー設定を取得
export async function getGuildSettings(guildId) {
  const client = initSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('guild_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error) throw error;
    return data?.settings || null;
  } catch (error) {
    console.error('Failed to get guild settings from Supabase:', error);
    return null;
  }
}

// 全サーバー設定を取得
export async function getAllGuildSettings() {
  const client = initSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('guild_settings')
      .select('*');

    if (error) throw error;
    return data.map(row => [row.guild_id, row.settings]);
  } catch (error) {
    console.error('Failed to get all guild settings from Supabase:', error);
    return [];
  }
}

// 古いセッションを削除（24時間以上経過したもの）
export async function cleanupOldSessions() {
  const client = initSupabase();
  if (!client) return false;

  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await client
      .from('auth_sessions')
      .delete()
      .lt('created_at', cutoffTime);

    if (error) throw error;
    console.log('Cleaned up old sessions from Supabase');
    return true;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return false;
  }
}
