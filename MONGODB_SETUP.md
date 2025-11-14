# MongoDB Atlasセットアップガイド（超簡単・3分）

Renderでデータが消えないように、MongoDB Atlasでデータを永続化します。

## 1. MongoDB Atlasアカウント作成

1. https://www.mongodb.com/cloud/atlas/register にアクセス
2. Googleアカウントでサインアップ（一番簡単）

## 2. 無料クラスターの作成

1. **Create a deployment** をクリック
2. **M0 FREE** を選択（無料プラン）
3. プロバイダーとリージョン:
   - **AWS**
   - **Tokyo (ap-northeast-1)** 推奨
4. Cluster Name: そのまま（Cluster0でOK）
5. **Create Deployment** をクリック

## 3. データベースユーザーの作成

**Security Quickstart** 画面が表示されます:

1. **Username**: 好きな名前（例: `admin`）
2. **Password**: 自動生成されたパスワードをコピー（後で使う）
3. **Create Database User** をクリック

## 4. IPアドレスの許可

同じ画面で:

1. **Add My Current IP Address** をクリック
2. さらに **Allow Access from Anywhere** も追加（Renderから接続するため）
   - IP: `0.0.0.0/0`
3. **Finish and Close** をクリック

## 5. 接続文字列の取得

1. **Connect** ボタンをクリック
2. **Drivers** を選択
3. **Connection string** をコピー:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

4. `<username>` と `<password>` を実際の値に置き換える
5. 最後に `/` の後ろにデータベース名を追加（例: `/discord_auth`）

**最終的な接続文字列の例:**
```
mongodb+srv://admin:yourpassword123@cluster0.xxxxx.mongodb.net/discord_auth?retryWrites=true&w=majority
```

## 6. Renderで環境変数を設定

**Bot (Background Worker):**

```
MONGODB_URI=mongodb+srv://admin:yourpassword123@cluster0.xxxxx.mongodb.net/discord_auth?retryWrites=true&w=majority
```

上記の接続文字列をそのまま貼り付けるだけ！

## 7. 動作確認

Botを起動すると:

```
MongoDB client initialized
MongoDBから0件のセッションを読み込みました
MongoDBから0人の認証ユーザーを読み込みました
MongoDBから0個のサーバー設定を読み込みました
```

データが保存されると:

```
データを保存しました（ローカル & MongoDB）
```

## 8. データの確認

MongoDB Atlas画面で:

1. **Browse Collections** をクリック
2. 以下の3つのコレクションが表示されます:
   - `auth_sessions`
   - `authenticated_users`
   - `guild_settings`

## トラブルシューティング

### 接続エラーが出る場合

1. **パスワードに特殊文字が含まれている場合**:
   - URLエンコードが必要です
   - 例: `@` → `%40`, `#` → `%23`
   - または、新しいユーザーを作成して簡単なパスワードに変更

2. **IPアドレスが許可されていない**:
   - MongoDB Atlas → Network Access
   - `0.0.0.0/0` が追加されているか確認

3. **接続文字列が間違っている**:
   - `<username>` と `<password>` を置き換えたか確認
   - データベース名（例: `/discord_auth`）を追加したか確認

## 完了！

これでRenderが再起動してもデータが消えなくなりました。
