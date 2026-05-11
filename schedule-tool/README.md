# Schedia

広告なしの業務向け日程調整ツールのMVPです。

## できること

- 管理者が件名、説明、候補条件を入力
- 「来週の平日、14時から18時の間で30分刻み」のような自然文から候補日時を生成
- 手入力で候補日時を追加
- 参加者用URLを発行
- 参加者がログインなしで `○ / △ / ×` または `参加可 / 不可` で回答
- 管理者が回答結果とおすすめ日時を確認
- CSV出力

## 試し方

```bash
cd schedule-tool
python3 -m http.server 4173
```

ブラウザで `http://127.0.0.1:4173` を開きます。

## 現在の仕様

このMVPはブラウザだけで動く静的アプリです。Supabaseを設定していない場合、イベント情報は共有URLに入り、回答は同じブラウザの保存領域に保存されます。

Supabaseを設定すると、イベント、候補日時、回答がデータベースに保存され、別端末からも回答結果を確認できます。

## Supabase設定

1. Supabaseで新規プロジェクトを作成
2. SQL Editorで `supabase-schema.sql` の内容を実行
3. Project Settings > API から Project URL と anon public key を確認
4. `config.js` に以下のように設定

```js
window.SCHEDIA_SUPABASE = {
  url: "https://YOUR-PROJECT-ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

設定後は、共有URLが `#answer?id=...` の短い形式になり、回答がSupabaseに保存されます。

## GitHub中心で使う場合

GitHubには `schedule-tool` フォルダのアプリ本体と `supabase-schema.sql` を置きます。

`config.js` は接続情報を入れるローカル設定ファイルなので、GitHubには載せません。設定例は `config.example.js` に残しています。Netlifyでは環境変数から `config.js` を自動生成します。

おすすめの流れは以下です。

1. GitHubにこのツール用のリポジトリを作成
2. `schedule-tool` の中身をコミット
3. NetlifyでGitHubリポジトリを接続
4. Netlifyの環境変数に `SCHEDIA_SUPABASE_URL` と `SCHEDIA_SUPABASE_ANON_KEY` を設定
5. SupabaseのSQL変更は `supabase-schema.sql` に追記してGitHubで管理
