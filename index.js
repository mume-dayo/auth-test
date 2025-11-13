import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as firebaseLib from '../lib/firebase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const authSessions = new Map();

const authenticatedUsers = new Map();

const guildSettings = new Map(); // サーバーごとの設定を保存

async function saveData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const sessionsData = Array.from(authSessions.entries());
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));

    const usersData = Array.from(authenticatedUsers.entries());
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));

    const settingsData = Array.from(guildSettings.entries());
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsData, null, 2));

    // Firebaseにも保存
    for (const [sessionId, sessionData] of authSessions) {
      await firebaseLib.saveSession(sessionId, sessionData);
    }

    for (const [userId, userData] of authenticatedUsers) {
      await firebaseLib.saveUser(userId, userData);
    }

    for (const [guildId, settings] of guildSettings) {
      await firebaseLib.saveGuildSettings(guildId, settings);
    }

    console.log('データを保存しました（ローカル & Firebase）');
  } catch (error) {
    console.error('データ保存エラー:', error);
  }
}
async function loadData() {
  try {
    // まずFirebaseから読み込み
    const supabaseSessions = await firebaseLib.getAllSessions();
    const supabaseUsers = await firebaseLib.getAllUsers();
    const supabaseSettings = await firebaseLib.getAllGuildSettings();

    if (supabaseSessions.length > 0) {
      supabaseSessions.forEach(([key, value]) => authSessions.set(key, value));
      console.log(`Firebaseから${supabaseSessions.length}件のセッションを読み込みました`);
    }

    if (supabaseUsers.length > 0) {
      supabaseUsers.forEach(([key, value]) => authenticatedUsers.set(key, value));
      console.log(`Firebaseから${supabaseUsers.length}人の認証ユーザーを読み込みました`);
    }

    if (supabaseSettings.length > 0) {
      supabaseSettings.forEach(([key, value]) => guildSettings.set(key, value));
      console.log(`Firebaseから${supabaseSettings.length}個のサーバー設定を読み込みました`);
    }

    // ローカルファイルからも読み込み（Firebaseが使えない場合のフォールバック）
    try {
      const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(sessionsData);
      sessions.forEach(([key, value]) => {
        if (!authSessions.has(key)) {
          authSessions.set(key, value);
        }
      });
      console.log(`ローカルから${sessions.length}件のセッションを読み込みました`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('セッション読み込みエラー:', error);
      }
    }

    try {
      const usersData = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(usersData);
      users.forEach(([key, value]) => {
        if (!authenticatedUsers.has(key)) {
          authenticatedUsers.set(key, value);
        }
      });
      console.log(`ローカルから${users.length}人の認証ユーザーを読み込みました`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('ユーザー読み込みエラー:', error);
      }
    }

    try {
      const settingsData = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(settingsData);
      settings.forEach(([key, value]) => {
        if (!guildSettings.has(key)) {
          guildSettings.set(key, value);
        }
      });
      console.log(`ローカルから${settings.length}個のサーバー設定を読み込みました`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('設定読み込みエラー:', error);
      }
    }
  } catch (error) {
    console.error('データ読み込みエラー:', error);
  }
}

async function refreshAccessToken(userId) {
  const userData = authenticatedUsers.get(userId);
  if (!userData || !userData.refreshToken) {
    console.error(`ユーザー${userId}のリフレッシュトークンが見つかりません`);
    return null;
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: userData.refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`トークンリフレッシュエラー (${userId}):`, data);
      return null;
    }

    authenticatedUsers.set(userId, {
      ...userData,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      refreshedAt: Date.now(),
    });

    await saveData();
    console.log(`ユーザー${userId}のアクセストークンを更新しました`);
    return data.access_token;
  } catch (error) {
    console.error(`トークンリフレッシュエラー (${userId}):`, error);
    return null;
  }
}

setInterval(saveData, 5 * 60 * 1000);

// 1時間ごとに古いセッションをクリーンアップ
setInterval(async () => {
  await firebaseLib.cleanupOldSessions();
}, 60 * 60 * 1000);

const commands = [
  {
    name: 'button',
    description: 'OAuth認証パネルを作成してロールを付与',
    options: [
      {
        name: 'role',
        type: 8,
        description: '付与するロール',
        required: true,
      },
    ],
  },
  {
    name: 'call',
    description: '認証済みユーザーをこのサーバーに参加させる',
  },
  {
    name: 'setting',
    description: '認証パネルのセキュリティ設定',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

async function registerCommands() {
  try {
    console.log('スラッシュコマンドを登録中...');

    // Botが参加している全てのサーバーにコマンドを登録
    const guilds = client.guilds.cache;
    console.log(`${guilds.size}個のサーバーにコマンドを登録します`);

    for (const [guildId, guild] of guilds) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
          { body: commands }
        );
        console.log(`サーバー ${guild.name} (${guildId}) にコマンドを登録しました`);
      } catch (error) {
        console.error(`サーバー ${guildId} へのコマンド登録エラー:`, error);
      }
    }

    console.log('スラッシュコマンドの登録完了');
  } catch (error) {
    console.error('コマンド登録エラー:', error);
  }
}

client.once('ready', async () => {
  console.log(`${client.user.tag}でログインしました`);

  await loadData();

  registerCommands();
});

// 新しいサーバーに参加したときにコマンドを登録
client.on('guildCreate', async (guild) => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guild.id),
      { body: commands }
    );
    console.log(`サーバー ${guild.name} (${guild.id}) にコマンドを登録しました`);
  } catch (error) {
    console.error(`サーバー ${guild.id} へのコマンド登録エラー:`, error);
  }
});

client.on('messageCreate', async (message) => {
  // Bot自身のメッセージのみ処理
  if (message.author.id !== client.user.id) return;

  try {
    let data;
    try {
      data = JSON.parse(message.content);
    } catch (error) {
      // JSONでない通常メッセージは無視
      return;
    }

    const { userId, sessionId, guildId, roleId, accessToken, refreshToken, expiresIn } = data;

    // 必須フィールドのチェック
    if (!userId || !sessionId || !guildId || !roleId) {
      return; // 認証データでなければスキップ
    }

    console.log(`認証データを受信: ユーザー${userId}, サーバー${guildId}, ロール${roleId}`);

    const session = authSessions.get(sessionId);

    if (!session) {
      console.error(`Session not found: ${sessionId}`);
      return;
    }

    // アクセストークンを保存
    if (accessToken) {
      authenticatedUsers.set(userId, {
        accessToken,
        refreshToken: refreshToken || null,
        sessionId,
        authenticatedAt: Date.now(),
        expiresAt: expiresIn ? Date.now() + (expiresIn * 1000) : null,
      });
      console.log(`ユーザー${userId}の認証情報を保存しました`);

      await saveData();
    }

    // サーバーにユーザーを追加
    try {
      const addResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
          }),
        }
      );

      if (addResponse.ok || addResponse.status === 204) {
        console.log(`ユーザー${userId}をサーバー${guildId}に追加しました`);
      } else {
        const errorData = await addResponse.json();
        console.error(`ユーザー${userId}の追加に失敗:`, errorData);
        return;
      }
    } catch (error) {
      console.error(`ユーザー${userId}の追加エラー:`, error);
      return;
    }

    // ロールを付与
    const guild = await client.guilds.fetch(guildId);
    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch (error) {
      console.error(`ユーザー${userId}がサーバーに見つかりません`);
      return;
    }

    if (roleId) {
      try {
        await member.roles.add(roleId);
        console.log(`ユーザー${userId}にロール${roleId}を付与しました`);
      } catch (error) {
        console.error('ロール付与エラー:', error);
        return;
      }
    }

    await message.delete().catch(() => {});
  } catch (error) {
    console.error('Webhook処理エラー:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'button') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    // サーバーの設定を取得（デフォルトは全てfalse）
    const settings = guildSettings.get(interaction.guildId) || {
      proxyBlock: false,
      vpnBlock: false,
      mobileBlock: false,
      authorizedCheck: false,
    };

    const { proxyBlock, vpnBlock, mobileBlock, authorizedCheck } = settings;

    // セッション情報をBase64エンコードして、NetlifyがデコードできるようにOAuth state パラメータに含める
    const sessionData = {
      guildId: interaction.guildId,
      roleId: role.id,
      channelId: interaction.channelId,
      timestamp: Date.now(),
      security: {
        proxyBlock,
        vpnBlock,
        mobileBlock,
        authorizedCheck,
      }
    };
    const sessionId = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    authSessions.set(sessionId, {
      guildId: interaction.guildId,
      roleId: role.id,
      channelId: interaction.channelId,
      messageId: null,
      createdAt: Date.now(),
      security: {
        proxyBlock,
        vpnBlock,
        mobileBlock,
        authorizedCheck,
      }
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('にんしょーだよ！')
      .setDescription('以下のリンクから認証。');

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const redirectUri = encodeURIComponent(`${webUrl}/callback`);
    const clientId = process.env.DISCORD_CLIENT_ID;
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds.join&state=${sessionId}`;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('認証する')
          .setStyle(ButtonStyle.Link)
          .setURL(oauthUrl)
      );

    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    const session = authSessions.get(sessionId);
    session.messageId = message.id;
    authSessions.set(sessionId, session);

    setTimeout(() => {
      authSessions.delete(sessionId);
    }, 24 * 60 * 60 * 1000);
  }

  if (interaction.commandName === 'call') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    }

    await interaction.deferReply();

    const targetServerId = interaction.guildId;

    if (authenticatedUsers.size === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ エラー')
        .setDescription('認証済みのユーザーが見つかりませんでした。');
      return interaction.editReply({ embeds: [embed] });
    }

    const targetGuild = interaction.guild;

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const [userId, userData] of authenticatedUsers.entries()) {
      try {
        let accessToken = userData.accessToken;
        if (userData.expiresAt && Date.now() >= userData.expiresAt) {
          console.log(`ユーザー${userId}のトークンが期限切れです。リフレッシュします...`);
          const newToken = await refreshAccessToken(userId);
          if (!newToken) {
            failCount++;
            results.push(`<@${userId}> - トークンの更新に失敗`);
            continue;
          }
          accessToken = newToken;
        }

        const response = await fetch(
          `https://discord.com/api/v10/guilds/${targetServerId}/members/${userId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: accessToken,
            }),
          }
        );

        if (response.ok || response.status === 204) {
          successCount++;
          results.push(`✅ <@${userId}>`);
          console.log(`ユーザー${userId}をサーバー${targetServerId}に追加しました`);
        } else {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          failCount++;
          let errorMsg = errorData.message || errorData.code || 'エラー';

          if (response.status === 403 && errorMsg.includes('verified')) {
            errorMsg = 'メール未認証アカウント';
          }

          results.push(`❌ <@${userId}> - ${errorMsg}`);
          console.error(`ユーザー${userId}の追加に失敗 (${response.status}):`, errorData);
        }
      } catch (error) {
        failCount++;
        results.push(`❌ <@${userId}> - ネットワークエラー`);
        console.error(`ユーザー${userId}の追加に失敗:`, error);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(successCount > 0 ? 0x43B581 : 0xFF0000)
      .setTitle('処理成功！')
      .setDescription(`**対象サーバー:** ${targetGuild.name}\n\n**結果:**\n成功: ${successCount}人\n失敗: ${failCount}人`)
      .addFields({
        name: '詳細',
        value: results.length > 0 ? results.slice(0, 20).join('\n') : 'なし',
      })
      .setTimestamp();

    if (results.length > 20) {
      embed.setFooter({ text: `他 ${results.length - 20} 件の結果があります` });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  if (interaction.commandName === 'setting') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    }

    // 現在の設定を取得
    const currentSettings = guildSettings.get(interaction.guildId) || {
      proxyBlock: false,
      vpnBlock: false,
      mobileBlock: false,
      authorizedCheck: false,
    };

    // セレクトメニューを作成
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('security_settings')
      .setPlaceholder('設定を選択してください')
      .setMinValues(0)
      .setMaxValues(4)
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Proxy Block')
          .setDescription('プロキシサーバー経由での接続をブロック')
          .setValue('proxy_block')
          .setDefault(currentSettings.proxyBlock),
        new StringSelectMenuOptionBuilder()
          .setLabel('VPN Block')
          .setDescription('VPN経由での接続をブロック')
          .setValue('vpn_block')
          .setDefault(currentSettings.vpnBlock),
        new StringSelectMenuOptionBuilder()
          .setLabel('Mobile Block')
          .setDescription('モバイル通信での接続をブロック')
          .setValue('mobile_block')
          .setDefault(currentSettings.mobileBlock),
        new StringSelectMenuOptionBuilder()
          .setLabel('Authorized Check')
          .setDescription('アプリケーション連携済みユーザーのみ許可')
          .setValue('authorized_check')
          .setDefault(currentSettings.authorizedCheck),
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('認証パネルのセキュリティ設定')
      .setDescription('以下の設定を適用する認証パネルを選択してください')
      .addFields(
        { name: 'Proxy Block', value: currentSettings.proxyBlock ? '✅ 有効' : '❌ 無効', inline: true },
        { name: 'VPN Block', value: currentSettings.vpnBlock ? '✅ 有効' : '❌ 無効', inline: true },
        { name: 'Mobile Block', value: currentSettings.mobileBlock ? '✅ 有効' : '❌ 無効', inline: true },
        { name: 'Authorized Check', value: currentSettings.authorizedCheck ? '✅ 有効' : '❌ 無効', inline: true }
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  }
});

// セレクトメニューのインタラクション処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'security_settings') {
    const selectedValues = interaction.values;

    // 新しい設定を作成
    const newSettings = {
      proxyBlock: selectedValues.includes('proxy_block'),
      vpnBlock: selectedValues.includes('vpn_block'),
      mobileBlock: selectedValues.includes('mobile_block'),
      authorizedCheck: selectedValues.includes('authorized_check'),
    };

    // 設定を保存
    guildSettings.set(interaction.guildId, newSettings);
    await saveData();

    const embed = new EmbedBuilder()
      .setColor(0x43B581)
      .setTitle('✅ 設定を保存しました')
      .setDescription('次回の `/button` コマンドからこの設定が適用されます')
      .addFields(
        { name: 'Proxy Block', value: newSettings.proxyBlock ? '✅ 有効' : '❌ 無効', inline: true },
        { name: 'VPN Block', value: newSettings.vpnBlock ? '✅ 有効' : '❌ 無効', inline: true },
        { name: 'Mobile Block', value: newSettings.mobileBlock ? '✅ 有効' : '❌ 無効', inline: true },
        { name: 'Authorized Check', value: newSettings.authorizedCheck ? '✅ 有効' : '❌ 無効', inline: true }
      );

    await interaction.update({
      embeds: [embed],
      components: [],
    });
  }
});

client.on('error', console.error);
process.on('unhandledRejection', console.error);

client.login(process.env.DISCORD_BOT_TOKEN);
