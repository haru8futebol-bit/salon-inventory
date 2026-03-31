# salon-inventory — CLAUDE.md

このファイルを読んだ Claude は、以下の内容を前提に作業してください。

---

## プロジェクト概要

**美容室向け薬剤在庫管理 Web アプリ**

美容室スタッフがスマホ1台で薬剤の在庫管理ができるアプリ。
お母さんの美容室（ONE）を PoC（試作）として開発。
カルテくん風のカード型 UI を採用。

---

## 技術構成

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite |
| データベース | Supabase（PostgreSQL） |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage（product-images バケット） |
| AI | Claude API（`claude-opus-4-6` / `claude-haiku-4-5-20251001`） |
| 音声認識 | Web Speech API（ブラウザ標準、日本語対応） |
| バーコード | html5-qrcode |
| ホスティング | Vercel（GitHub 連携・自動デプロイ） |
| 通知 | Supabase Edge Function → LINE Messaging API（未デプロイ） |

### 環境変数（.env）
```
VITE_SUPABASE_URL=https://yahnethjabtrmwkahhre.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
```

Vercel にも3つの環境変数すべてを設定済み（Production / Preview / Development）。

### ローカル起動
```bash
cd "/Users/harusakuriki/Library/Mobile Documents/com~apple~CloudDocs/TMJ サッカー事業/salon-inventory"
npm run dev   # http://localhost:5173
```

### 本番 URL
https://salon-inventory-q3t3.vercel.app

### GitHub リポジトリ
https://github.com/haru8futebol-bit/salon-inventory（main ブランチのみ）

---

## デプロイフロー

```
コード修正 → git add . → git commit → git push origin main
→ Vercel が自動検知 → 数分で本番反映
```

---

## ディレクトリ構成

```
salon-inventory/
├── src/
│   ├── App.tsx                        # メイン画面・状態管理・ルーティング
│   ├── claude.ts                      # Claude API 呼び出し（OCR・音声解析・在庫カウント）
│   ├── supabase.ts                    # Supabase クライアント
│   ├── types.ts                       # 型定義（Product / UsageLog / Recipe / RecipeItem / Order）
│   └── components/
│       ├── AuthScreen.tsx             # ログイン・新規登録・パスワードリセットメール送信
│       ├── ResetPasswordScreen.tsx    # パスワードリセット後の新パスワード設定画面
│       ├── ProfileModal.tsx           # プロフィール設定（サロン名・写真・パスワード変更）
│       ├── ProductModal.tsx           # 薬剤登録・編集（OCR・バーコード・写真）
│       ├── UsageModal.tsx             # 使用記録
│       ├── RestockModal.tsx           # 入荷記録
│       ├── HistoryModal.tsx           # 使用・入荷履歴
│       ├── StockCountModal.tsx        # 写真から在庫カウント（Claude Vision）
│       ├── VoiceInputButton.tsx       # 音声入力（Claude AI 解析）
│       ├── BarcodeScanner.tsx         # バーコード・QR スキャン
│       ├── RecipeModal.tsx            # カラーレシピ登録・編集
│       ├── RecipeListModal.tsx        # レシピ一覧・施術適用
│       └── OrderCreateModal.tsx       # 発注作成
├── supabase_rls.sql                   # RLS 設定 SQL
├── supabase_schema.sql                # DB スキーマ SQL
└── .env                               # 環境変数（Git 管理外）
```

---

## DB テーブル構成

| テーブル | 主なカラム | 備考 |
|---|---|---|
| `products` | id, name, stock, threshold, barcode, image_url, user_id | RLS 設定済み |
| `usage_logs` | id, product_id, quantity, note, type, used_at, user_id | RLS 設定済み |
| `recipes` | id, name, memo, created_at, user_id | RLS 設定済み |
| `recipe_items` | id, recipe_id, product_id, quantity, unit, note | 親レシピの user_id で制御 |
| `orders` | id, product_id, quantity, status, ordered_at, received_at, user_id | RLS 設定済み |
| `profiles` | id, salon_name, avatar_url, updated_at | auth.users(id) に紐付け・RLS 設定済み |

---

## 実装済み機能一覧

### 認証
- メール・パスワードでのログイン / 新規登録
- 自動ログイン（Supabase が localStorage にセッションをキャッシュ）
- パスワードリセット（メール送信 → リンクをタップ → 新パスワード設定画面）
- ログイン中のパスワード変更（プロフィール設定内）

### プロフィール
- サロン名の設定・変更
- プロフィール写真のアップロード（Supabase Storage）
- ヘッダーにアバター写真 + サロン名を表示
- タップでプロフィール設定モーダルを開く

### 薬剤管理
- 薬剤の登録・編集・削除
- 商品写真のアップロード
- **AIで読み取り**：薬剤パッケージを撮影 → Claude が商品名・容量を読み取り自動入力
  - 撮影した写真が商品写真にも自動反映される
- **バーコードスキャン**：背面カメラで自動起動（iOS Safari 対応）
- 使用記録（在庫減算）/ 入荷記録（在庫加算）
- 在庫が閾値を下回るとアラート表示

### AI 機能（Claude API）
- **音声入力**：「カラー剤Aを2本使った」→ Claude Haiku が薬剤・本数を特定 → 使用記録モーダルを自動オープン
- **カメラ OCR**：薬剤パッケージを撮影 → Claude Opus が商品名・容量を読み取り → 登録フォームに自動入力 → 写真も同時反映
- **写真で在庫カウント**：棚の写真 → Claude Opus が本数を数えて提案 → 確認後一括反映

### レシピ管理
- カラーレシピの登録・編集・削除
- レシピに複数の薬剤と量を設定
- 「施術に使う」で一括在庫減算 + ログ記録

### 発注管理
- 発注中 / 受け取り済みのステータス管理
- 在庫アラートから直接発注作成

### セキュリティ
- RLS（行レベルセキュリティ）で各サロンのデータを完全分離
- 全テーブルに `user_id` カラム、`auth.uid() = user_id` で制御
- 各サロンは自分のデータのみ参照・操作可能

---

## 開発の経緯・プロセス

### Phase 1：プロトタイプ（認証なし）
- 薬剤の登録・編集・削除
- 使用記録・入荷記録・履歴閲覧
- 在庫アラート
- Supabase に `products` / `usage_logs` テーブルを作成

### Phase 2：AI・スキャン機能の追加
- Claude API による音声入力（Web Speech API + Claude Haiku で解析）
- カメラ OCR（Claude Opus でパッケージ読み取り）
- 写真で在庫カウント（Claude Opus で棚の本数を数える）
- html5-qrcode によるバーコードスキャン
- iOS Safari でカメラが起動しない問題 → `opacity: 0` の絶対配置 input で解決

### Phase 3：UI リデザイン
- LINEライクなチャット型 → カルテくん風カード型 UI に全面リデザイン
- スマホ最適化（ボトムシート型モーダル、44px 以上のタップ領域）
- Vercel にデプロイ、スタッフへの ABテスト実施 → B案（カード型）が好評

### Phase 4：機能拡張
- 発注管理機能の追加
- 商品写真のアップロード機能
- 用語変更（商品 → 薬剤）
- バーコードスキャン時に背面カメラを自動選択

### Phase 5：マルチユーザー対応（認証・RLS）
- Supabase Auth でログイン機能を実装
- 全テーブルに `user_id` カラムを追加
- RLS ポリシーを設定してサロン間のデータ分離を実現
- `profiles` テーブルを作成（サロン名・アバター写真）

### Phase 6：プロフィール・パスワード管理
- プロフィール設定画面（サロン名・写真変更）
- パスワードリセット（メール送信 → `PASSWORD_RECOVERY` イベント検知 → 新パスワード設定）
- ログイン中のパスワード変更
- Supabase のメールテンプレートを日本語化

### Phase 7：バグ修正・改善
- プロフィール写真が反映されないバグ → ファイル名にタイムスタンプを付けてキャッシュを回避
- `VITE_ANTHROPIC_API_KEY` が Vercel に未設定 → 追加してデプロイし直す
- GitHub の branch-b を main にマージして一本化
- Vercel プロジェクトを3つ → 1つ（`salon-inventory-q3t3`）に統合

---

## ハマりポイント・解決策

| 問題 | 原因 | 解決策 |
|---|---|---|
| iOS でカメラが起動しない | `display: none` の input | `opacity: 0` + 絶対配置に変更 |
| バーコードスキャンで前面カメラが起動 | デフォルト設定 | `facingMode: { exact: 'environment' }` で背面カメラを強制指定 |
| プロフィール写真が反映されない | ブラウザが同じ URL の画像をキャッシュ | ファイル名に `Date.now()` のタイムスタンプを付与 |
| AI機能が「エラー」になる | Vercel に `VITE_ANTHROPIC_API_KEY` が未設定 | Vercel の環境変数に追加して再デプロイ |
| パスワードリセットメールのリンクが「サーバーが見つからない」 | Supabase の Site URL が localhost のまま | Supabase → Authentication → URL Configuration で本番 URL に変更 |
| 古いコードがスマホに表示される | branch-b を main にマージしていなかった | `git merge branch-b && git push origin main` |
| npm / node が見つからない | PATH に `/opt/homebrew/bin` がない | コマンド実行時に `PATH="/opt/homebrew/bin:$PATH"` を付ける |

---

## 注意事項

- `VITE_ANTHROPIC_API_KEY` がないと AI 機能（音声・OCR・在庫カウント）がすべて動かない
- `dangerouslyAllowBrowser: true` を使用中 → **将来的にはバックエンド API 経由に変更すること**
- Web Speech API は Chrome / Safari のみ対応（Firefox 非対応）
- RLS を有効化しているため、INSERT 時に必ず `user_id: user?.id` を含めること
- インラインスタイルの三項演算子はプロパティごとに完結させること（`background: x ? a : b` の形式）

---

## 次にやること（候補）

- LINE 通知のデプロイ（発注アラートを LINE に送信）
- 施術メニューとレシピの連動
- データのエクスポート（CSV など）
- 複数スタッフのロール管理（オーナー / スタッフ）
