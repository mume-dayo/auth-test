# Tursoセットアップガイド（超簡単・30秒）

Renderでデータが消えないように、Turso (SQLite) でデータを永続化します。

## なぜTurso？

- ✅ **無料枠が大きい** (500データベース、9GB転送/月)
- ✅ **セットアップ30秒** (アカウント作成→DB作成→完了)
- ✅ **接続文字列2つだけ** (URL + Token)
- ✅ **高速** (SQLiteベース)

## 1. Tursoアカウント作成（10秒）

```bash
# Turso CLIをインストール（オプション）
curl -sSfL https://get.tur.so/install.sh | bash
```

または、https://turso.tech/ でGitHubアカウントでサインアップ

## 2. データベース作成（10秒）

Turso CLIを使う場合:

```bash
# ログイン
turso auth login

# データベース作成
turso db create discord-auth

# 接続情報を取得
turso db show discord-auth
```

**Webコンソールを使う場合:**

1. https://turso.tech/app にアクセス
2. **Create Database** をクリック
3. Database name: `discord-auth`
4. Location: 好きな場所（Tokyo推奨）
5. **Create** をクリック

## 3. 接続情報の取得（10秒）

**CLI:**
```bash
# Database URL取得
turso db show discord-auth --url

# Auth Token取得
turso db tokens create discord-auth
```

**Webコンソール:**
1. 作成したデータベースをクリック
2. **Connection** タブ
3. **Database URL** と **Auth Token** が表示される

## 4. 環境変数の設定

コピーした情報を使って設定:

```bash
TURSO_URL=libsql://discord-auth-your-org.turso.io
TURSO_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### Renderでの設定

**Bot (Background Worker):**

```
TURSO_URL=libsql://discord-auth-your-org.turso.io
TURSO_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

この2つを追加するだけ！

## 5. 動作確認

Botを起動すると:

```
Turso client initialized
Tursoから0件のセッションを読み込みました
Tursoから0人の認証ユーザーを読み込みました
Tursoから0個のサーバー設定を読み込みました
```

データが保存されると:

```
データを保存しました（ローカル & Turso）
```

## 6. データの確認

**CLI:**
```bash
turso db shell discord-auth

# SQLiteコマンドでデータ確認
SELECT * FROM auth_sessions;
SELECT * FROM authenticated_users;
SELECT * FROM guild_settings;
```

**Webコンソール:**
1. Database → **Data** タブ
2. テーブルを選択して確認

## テーブル構造

自動的に以下のテーブルが作成されます:

### auth_sessions
```sql
id TEXT PRIMARY KEY,
data TEXT NOT NULL,
created_at INTEGER NOT NULL
```

### authenticated_users
```sql
id TEXT PRIMARY KEY,
data TEXT NOT NULL,
updated_at INTEGER NOT NULL
```

### guild_settings
```sql
id TEXT PRIMARY KEY,
settings TEXT NOT NULL,
updated_at INTEGER NOT NULL
```

## トラブルシューティング

### 接続エラーが出る場合

1. **TURSO_URLが間違っている**:
   - `libsql://` で始まっているか確認
   - データベース名とorg名が正しいか確認

2. **TURSO_TOKENが期限切れ**:
   - 新しいトークンを作成: `turso db tokens create discord-auth`

3. **データベースが存在しない**:
   - `turso db list` でデータベース一覧を確認

### トークンの有効期限

デフォルトでトークンに期限はありません。必要に応じて新しいトークンを作成してください。

## 完了！

これでRenderが再起動してもデータが消えなくなりました。

MongoDBよりも簡単で、接続も安定しています。
