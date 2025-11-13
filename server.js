import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイルの提供
app.use(express.static('public'));

// OAuth2 コールバック
app.get('/callback', async (req, res) => {
  const { code, state: sessionId } = req.query;

  if (!code || !sessionId) {
    return res.status(400).json({ error: 'Authorization code and session are required' });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.REDIRECT_URI || `${req.protocol}://${req.get('host')}/callback`;

  // Debug: 環境変数の確認
  console.log('Environment check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdLength: clientId?.length || 0
  });

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return res.status(500).json({
        error: 'Failed to exchange authorization code',
        details: tokenData,
        redirectUri: redirectUri
      });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Step 2: Get user information
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('User fetch error:', userData);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    const userId = userData.id;

    // Step 3: Decode session data from Base64 to get channelId, guildId, roleId
    let sessionData;
    try {
      const decodedSession = Buffer.from(sessionId, 'base64').toString('utf-8');
      sessionData = JSON.parse(decodedSession);
    } catch (decodeError) {
      console.error('Failed to decode session data:', decodeError);
      return res.status(400).json({ error: 'Invalid session data' });
    }

    const { guildId, roleId, security } = sessionData;

    // Step 4: IP検証 (proxycheck.io API使用)
    if (security && (security.proxyBlock || security.vpnBlock || security.mobileBlock)) {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                       req.headers['x-real-ip'] ||
                       req.ip ||
                       'unknown';

      if (clientIp !== 'unknown') {
        try {
          const proxyCheckResponse = await fetch(`http://proxycheck.io/v2/${clientIp}?vpn=1&asn=1`);
          const proxyCheckData = await proxyCheckResponse.json();

          console.log('IP Check result:', proxyCheckData);

          if (proxyCheckData[clientIp]) {
            const ipInfo = proxyCheckData[clientIp];

            // プロキシチェック
            if (security.proxyBlock && ipInfo.proxy === 'yes') {
              return res.redirect(`/blocked.html?reason=proxy`);
            }

            // VPNチェック
            if (security.vpnBlock && ipInfo.type === 'VPN') {
              return res.redirect(`/blocked.html?reason=vpn`);
            }

            // モバイル通信チェック (isp フィールドに docomo, au, softbank, rakuten等が含まれるか)
            if (security.mobileBlock && ipInfo.isp) {
              const mobileCarriers = ['docomo', 'au', 'softbank', 'rakuten', 'kddi', 'ntt', 'willcom', 'emobile'];
              const isMobile = mobileCarriers.some(carrier =>
                ipInfo.isp.toLowerCase().includes(carrier)
              );

              if (isMobile) {
                return res.redirect(`/blocked.html?reason=mobile`);
              }
            }
          }
        } catch (ipCheckError) {
          console.error('IP check error:', ipCheckError);
          // IP チェックが失敗しても認証は続行
        }
      }
    }

    // Authorized Check: 既に連携済みのユーザーかチェック
    if (security && security.authorizedCheck) {
      // ここでは既存の認証済みユーザーリストをチェックする必要がある
      // 今回はbotに問い合わせる方法がないので、スキップ
      // 実装する場合は、bot側でWebhookやAPIエンドポイントを用意する必要がある
    }

    // Step 5: Send data to fixed Discord channel using Bot Token
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const fixedChannelId = '1435943955928715317'; // 固定のチャンネルID

    if (botToken) {
      try {
        const webhookData = {
          userId: userId,
          sessionId: sessionId,
          guildId: guildId,
          roleId: roleId,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: expires_in,
        };

        await fetch(`https://discord.com/api/v10/channels/${fixedChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: JSON.stringify(webhookData),
          }),
        });
      } catch (channelError) {
        console.error('Discord channel message error:', channelError);
        // Continue even if channel message fails
      }
    } else {
      console.warn('DISCORD_BOT_TOKEN not set, skipping notification');
    }

    // Step 6: Redirect to success page
    res.redirect(`/success.html?user=${encodeURIComponent(userData.username)}`);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
