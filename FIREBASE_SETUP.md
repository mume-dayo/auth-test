# Firebaseセットアップガイド

Renderでデータが消えないように、Firebase Firestoreでデータを永続化します。

## 1. Firebaseプロジェクトの作成

1. https://console.firebase.google.com/ にアクセス
2. "プロジェクトを追加"をクリック
3. プロジェクト名を入力し、次へ
4. Google Analyticsは任意で設定

## 2. Firestoreの有効化

1. 左メニューから **Firestore Database** を選択
2. "データベースの作成"をクリック
3. **本番環境モード**を選択
4. ロケーションを選択（asia-northeast1推奨 - 東京）
5. "有効にする"をクリック

## 3. サービスアカウントキーの取得

1. プロジェクト設定（⚙️）→ **サービスアカウント** タブ
2. "新しい秘密鍵の生成"をクリック
3. JSONファイルがダウンロードされます

## 4. 環境変数の設定

ダウンロードしたJSONファイルの内容をコピーして、**1行**にします:

```json
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

### Renderでの設定

**Bot (Background Worker):**
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...} ← 上記のJSONを1行で
```

**重要:** 改行を含まないように注意してください。

## 5. Firestoreセキュリティルール

Firebase Console → **Firestore Database** → **ルール**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 全てのアクセスを許可（サーバーサイドのみ使用）
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**注意:** サービスアカウントを使用する場合、セキュリティルールは影響しません。

## 6. コレクション構造

Firestoreには以下のコレクションが自動作成されます:

### auth_sessions
```
{
  documentId: "session_id",
  data: { guildId, roleId, channelId, ... },
  createdAt: Timestamp
}
```

### authenticated_users
```
{
  documentId: "user_id",
  data: { accessToken, refreshToken, ... },
  updatedAt: Timestamp
}
```

### guild_settings
```
{
  documentId: "guild_id",
  settings: { proxyBlock, vpnBlock, ... },
  updatedAt: Timestamp
}
```

## 7. 動作確認

Botを起動すると、以下のログが表示されます:

```
Firebase client initialized
Firebaseから0件のセッションを読み込みました
Firebaseから0人の認証ユーザーを読み込みました
Firebaseから0個のサーバー設定を読み込みました
```

データが保存されると:

```
データを保存しました（ローカル & Firebase）
```

## 8. データの確認

Firebase Console → **Firestore Database** で、各コレクションのデータを確認できます。

## トラブルシューティング

### Firebaseに接続できない場合

ログに以下のようなメッセージが表示されます:
```
Firebase credentials not found. Using local storage only.
```

**解決方法:**
1. 環境変数 `FIREBASE_SERVICE_ACCOUNT` が設定されているか確認
2. JSONが正しい形式か確認（1行で、エスケープされている）
3. JSONの内容が有効か確認

### JSONのフォーマットエラー

環境変数に設定する際、以下に注意:
- 改行を削除
- ダブルクォートをエスケープ不要（Renderが自動処理）
- private_keyの改行（\n）はそのまま

### 権限エラー

サービスアカウントに Firestore の権限があるか確認:
1. IAM と管理 → サービスアカウント
2. 該当のサービスアカウントを選択
3. "Cloud Datastore ユーザー" ロールが付与されているか確認

## クリーンアップ

古いセッション（24時間以上）は自動的に削除されます。
手動で削除する場合は、Firebase Consoleから直接削除できます。
