# Supabaseセットアップガイド

Renderでデータが消えないように、Supabaseでデータを永続化します。

## 1. Supabaseプロジェクトの作成

1. https://supabase.com にアクセス
2. "New Project"をクリック
3. プロジェクト名、データベースパスワード、リージョン（Tokyo推奨）を設定

## 2. テーブルの作成

SQL Editorで以下のSQLを実行:

```sql
-- 認証セッションテーブル
CREATE TABLE auth_sessions (
  session_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 認証済みユーザーテーブル
CREATE TABLE authenticated_users (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- サーバー設定テーブル
CREATE TABLE guild_settings (
  guild_id TEXT PRIMARY KEY,
  settings JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成（パフォーマンス向上）
CREATE INDEX idx_auth_sessions_created_at ON auth_sessions(created_at);
CREATE INDEX idx_authenticated_users_updated_at ON authenticated_users(updated_at);
CREATE INDEX idx_guild_settings_updated_at ON guild_settings(updated_at);
```

## 3. 環境変数の設定

Supabase Dashboardから以下の情報を取得:

1. **Project Settings** → **API** に移動
2. **Project URL**をコピー → `SUPABASE_URL`
3. **anon public key**をコピー → `SUPABASE_KEY`

### Renderでの設定

**Bot (Background Worker):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
```

**Web Server (Web Service):**
同じ環境変数を設定（必要に応じて）

## 4. 動作確認

Botを起動すると、以下のログが表示されます:

```
Supabase client initialized
Supabaseから0件のセッションを読み込みました
Supabaseから0人の認証ユーザーを読み込みました
Supabaseから0個のサーバー設定を読み込みました
```

データが保存されると:

```
データを保存しました（ローカル & Supabase）
```

## 5. データの確認

Supabase Dashboard → **Table Editor**で、各テーブルのデータを確認できます。

## トラブルシューティング

### Supabaseに接続できない場合

ログに以下のようなメッセージが表示されます:
```
Supabase credentials not found. Using local storage only.
```

→ 環境変数が正しく設定されているか確認してください。

### データが保存されない場合

1. Supabase Dashboardでテーブルが正しく作成されているか確認
2. API Keyが正しいか確認（anon keyを使用）
3. ログでエラーメッセージを確認

## Row Level Security (RLS)

現在はRLSを無効にしていますが、セキュリティを強化する場合は以下を実行:

```sql
-- RLSを有効化
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authenticated_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_settings ENABLE ROW LEVEL SECURITY;

-- サービスロールからのアクセスを許可するポリシー
CREATE POLICY "Allow service role access" ON auth_sessions
  FOR ALL USING (true);

CREATE POLICY "Allow service role access" ON authenticated_users
  FOR ALL USING (true);

CREATE POLICY "Allow service role access" ON guild_settings
  FOR ALL USING (true);
```

その後、anon keyではなくservice_role keyを使用してください（より安全）。
