# salon-inventory — CLAUDE.md

このファイルを読んだClaudeは、以下の内容を前提に作業してください。

---

## プロジェクト概要

**美容室向け薬剤在庫管理 Webアプリ（プロトタイプ）**

美容室スタッフがスマホ1台で薬剤の在庫管理ができるアプリ。
LINEのようなチャット型UIを採用し、会話の流れで操作できる設計。

---

## 技術構成

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite |
| データベース | Supabase（PostgreSQL） |
| AI | Claude API（`claude-opus-4-6` / `claude-haiku-4-5-20251001`） |
| 音声認識 | Web Speech API（ブラウザ標準、日本語対応） |
| バーコード | html5-qrcode |
| 通知 | Supabase Edge Function → LINE Messaging API（未デプロイ） |

### 環境変数（.env）
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...   # AIの全機能に必要
```

### 起動
```bash
npm install
npm run dev   # http://localhost:5173
```

---

## ディレクトリ構成

```
salon-inventory/
├── src/
│   ├── App.tsx                      # メイン画面（チャットUI・状態管理）
│   ├── claude.ts                    # Claude API呼び出し（音声解析・OCR・在庫カウント）
│   ├── supabase.ts                  # Supabase クライアント
│   ├── types.ts                     # 型定義（Product / UsageLog / Recipe / RecipeItem）
│   └── components/
│       ├── ProductModal.tsx         # 薬剤登録・編集（OCR・バーコードスキャン付き）
│       ├── UsageModal.tsx           # 使用記録
│       ├── RestockModal.tsx         # 入荷記録
│       ├── HistoryModal.tsx         # 使用・入荷履歴
│       ├── StockCountModal.tsx      # 写真から在庫カウント（Claude Vision）
│       ├── VoiceInputButton.tsx     # 音声入力（Claude AI解析）
│       ├── BarcodeScanner.tsx       # バーコード・QRスキャン
│       ├── RecipeModal.tsx          # カラーレシピ登録・編集
│       └── RecipeListModal.tsx      # レシピ一覧・施術適用
├── supabase/
│   └── functions/line-notify/       # LINE通知 Edge Function（未デプロイ）
├── supabase_schema.sql              # DB作成SQL（Supabaseで実行する）
└── .env.example                     # 環境変数テンプレート
```

---

## DBテーブル構成

### 既存テーブル（Supabaseで作成済み想定）
| テーブル | 主なカラム |
|---|---|
| `products` | id, name, stock, threshold, barcode, created_at |
| `usage_logs` | id, product_id, quantity, note, type('use'\|'restock'), used_at |

### 追加が必要なテーブル（未実行の場合は supabase_schema.sql を参照）
| テーブル | 主なカラム |
|---|---|
| `recipes` | id, name, memo, created_at |
| `recipe_items` | id, recipe_id, product_id, quantity, unit, note |

### barcodeカラムの追加
既存DBには `barcode` カラムが存在しないため、以下を Supabase SQL Editor で実行する：
```sql
alter table products add column if not exists barcode text;
```

---

## 実装済み機能

### 基本機能
- 薬剤の登録・編集・削除
- 使用記録（在庫減算） / 入荷記録（在庫加算）
- 在庫が閾値を下回るとアラート表示
- 使用・入荷の履歴閲覧（最新100件）

### AI機能（Claude API）
- **音声入力**：「カラー剤Aを2本使った」→ Claude Haiku が薬剤・本数を特定 → 使用記録モーダルを自動オープン
- **カメラOCR**：薬剤パッケージを撮影 → Claude Opus が商品名・容量を読み取り → 登録フォームに自動入力
- **写真で在庫カウント**：棚の写真 → Claude Opus が本数を数えて提案 → 確認後一括反映

### スキャン・レシピ
- **バーコードスキャン**：薬剤登録時にバーコードを読み取りDBに保存。既存商品との照合も可能
- **カラーレシピ管理**：薬剤の組み合わせ・量を登録。「施術に使う」で一括在庫減算＋ログ記録

### UI
- LINEライクなチャット型UI（操作結果が会話の流れで表示される）
- ボトムシート型モーダル（スマホ操作に最適化）
- クイックアクションボタン（下部に常時表示）
- ヘッダーは 44px 以上のタップ領域を確保

---

## 現在の状況（2026-03-30時点）

- フロントエンドのコードはすべて実装済み
- Supabaseの `products` / `usage_logs` テーブルは作成済み（想定）
- **未対応の作業：**
  - `barcode` カラムの追加（SQL 1行）
  - `recipes` / `recipe_items` テーブルの作成
  - LINE通知 Edge Function のデプロイ（オーナー判断でステイ中）
- `npm install` は実行済み（html5-qrcode 含む）

---

## 次にやること

### 優先度：高
1. **Supabaseでテーブル追加** — `supabase_schema.sql` の recipes / recipe_items 部分と `alter table products add column` を実行
2. **動作確認** — バーコードスキャン・レシピ機能・音声入力をスマホ実機でテスト

### 優先度：中
3. **LINE通知のデプロイ** — LINE Developers でチャンネル作成 → Edge Function をデプロイ → シークレット設定
4. **本番デプロイ** — Vercel または Netlify にホスティング（スマホからURLアクセスで使えるようにする）

### 優先度：低（将来的に）
5. **ログイン機能** — Supabase Auth + RLS でマルチユーザー対応
6. **施術メニューとの連動** — メニューを選ぶだけでレシピ材料が自動使用される
7. **発注管理** — 要発注リストからそのまま発注メール・FAXを送信する機能

---

## 注意事項・ハマりポイント

- `VITE_ANTHROPIC_API_KEY` がないとAI機能（音声解析・OCR・在庫カウント）がすべて動かない
- `dangerouslyAllowBrowser: true` を使用中 → **本番公開時は必ずバックエンドAPI経由に変更すること**
- Web Speech API は **Chrome / Safari のみ**対応。Firefoxは非対応
- html5-qrcode はカメラ権限を要求する。iOSはSafariのみカメラアクセス可能
- RLSを無効化したままのプロトタイプ構成 → 外部公開前にRLS + Supabase Authを設定すること
- インラインスタイルの三項演算子でプロパティごとに完結させること（`background: x ? a : b` の形式。複数プロパティをまとめると TS エラー）
# salon-inventory

## プロジェクト概要
美容室の薬剤在庫管理アプリ。お母さんの美容室（ONE）をPoCとして開発中。

## 技術構成
- React + TypeScript + Vite
- Supabase（データベース・Project ID: yahnethjabtrmwkahhre）
- Vercel（本番公開）
- GitHub（コード管理）

## 本番URL
https://salon-inventory-q3t3.vercel.app

## ローカル起動方法
ターミナルで以下を実行：
cd "/Users/harusakuriki/Library/Mobile Documents/com~apple~CloudDocs/TMJ サッカー事業/salon-inventory"
npm run dev
→ http://localhost:5173 で確認

## 機能追加・デザイン変更からデプロイまでの流れ

### Step 1：Cursorで編集
Claude Codeに日本語で指示する。
例：「〇〇の機能を追加して」「このデザインを変えて」

### Step 2：ローカルで確認
ターミナルで npm run dev を実行して
http://localhost:5173 で動作確認する。

### Step 3：GitHubにプッシュ
以下の3行をターミナルで1行ずつ実行する。
git add .
git commit -m "変更内容のメモ"
git push origin main

### Step 4：Vercelに自動反映
git pushするとVercelが自動で検知して
数分以内に本番URLに反映される。
https://salon-inventory-q3t3.vercel.app

## 現在の実装状況
- 薬剤登録・編集・削除
- 使用量記録
- 入荷記録
- 履歴一覧
- 在庫アラート表示
- レシピ管理（DBテーブルのみ）

## 次にやること
- 音声入力機能（Web Speech API・無料）
- バーコードスキャン機能（ZXing・無料）
- LINE通知連携
- Vercelデプロイ済み

## 注意事項
- .envファイルはGitHubにアップしない（.gitignoreに設定済み）
- Supabaseの環境変数はVercelのEnvironment Variablesに設定済み
- コードのプッシュはMacのターミナル.appから行う