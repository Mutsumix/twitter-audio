# Twitter Audio Podcast Generator

Twitter のお気に入りツイートとリンク記事を要約し、Podcast 形式の音声ファイルに変換するシステムよい。

## 概要

このプロジェクトは Google スプレッドシートに連携された Twitter のお気に入りツイートを取得し、関連するリンク記事を収集・要約した上で、会話形式の Podcast として音声ファイルに変換するシステムです。技術的な内容とそれ以外の内容を分類し、技術系コンテンツにフォーカスした音声コンテンツを生成します。

## 主な機能

- Google スプレッドシートからツイートデータを取得（IFTTT 連携済み）
- リンク記事のスクレイピングと内容取得
- テキストの分類（技術系/それ以外）
- コンテンツの要約生成
- 会話形式への変換
- 高品質な音声ファイル（MP3）の生成
- ラジオ風の挨拶と結びの自動生成と追加
- 複数音声ファイルの効率的な結合
- 対話型コマンドラインインターフェース
- SQLite によるデータ管理

## 最近の改善点

- **音声合成品質の向上**：多言語対応モデル（eleven_multilingual_v2）に変更
- **日本語音声の最適化**：女性ナレーター音声（Morioki）に切り替え
- **スクリプト構成の改善**：チャンク間接続の最適化と重複挨拶の排除
- **固定フレーズ対応**：オープニングとエンディングに固定フレーズを実装
- **原稿保存機能の追加**：生成されたスクリプトをテキストファイルとして保存
- **音声結合の効率化**：FFmpeg の complexFilter を使用した効率的な音声結合
- **テキスト読み上げの改善**：漢字とひらがなのバランス最適化で自然な発音
- **デバッグ機能の強化**：読み上げテキストのログ出力機能

## 技術スタック

- **言語**: TypeScript
- **実行環境**: Node.js
- **データベース**: SQLite（Prisma ORM）
- **API**:
  - Google Sheets API
  - OpenAI API（テキスト分類、要約、会話形式変換）
  - テキスト音声変換 API
- **主要ライブラリ**:
  - googleapis: Google Sheets API 連携
  - puppeteer/cheerio: Web スクレイピング
  - openai: OpenAI API 連携
  - elevenlabs: 音声合成
  - fluent-ffmpeg: 音声ファイル操作
  - prisma: SQLite の ORM

## 前提条件

- Node.js v16 以上
- Google スプレッドシートへのアクセス権限
- 各種 API キー（OpenAI、Google Sheets、音声合成サービスなど）

## インストール方法

```bash
# リポジトリのクローン
git clone <repository-url>
cd twitter-audio

# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集し、必要なAPIキーを設定してください
```

## 使い方

### 通常実行

```bash
# 音声Podcastの生成（基本機能）
npm run generate-podcast

# 生成された音声ファイルは output/ ディレクトリに保存されます
```

### 対話型モード

引数なしで実行すると対話型モードが起動し、実行したい機能を選択できます：

```bash
npm run dev
```

### コマンドライン実行

特定の機能を直接実行することも可能です：

```bash
# すべての処理を実行し、ラジオ風のジングルを追加
npm run dev -- process-all --with-jingle

# ラジオ風の挨拶と結びを生成
npm run audio:generate-jingles

# 既存の音声ファイルにジングルを追加
npm run audio:add-jingles -- --file=output/your-file.mp3

# 複数の音声ファイルを結合
npm run audio:merge -- --files=file1.mp3,file2.mp3 --output=combined.mp3 --silence=2.5

# ヘルプの表示
npm run dev -- help
```

### デモの実行

基本的な音声操作機能をテストするデモを実行できます：

```bash
# 音声操作機能のデモを実行
npm run demo:audio
```

## 環境変数

以下の環境変数を `.env` ファイルに設定する必要があります：

```
# Google Sheets API
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SHEETS_API_KEY=your_api_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# 音声合成サービス（例: ElevenLabs）
TTS_API_KEY=your_tts_api_key

# データベース設定
DATABASE_URL="file:./dev.db"

# Cloudflare設定（Webサイト公開機能用・オプション）
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_R2_BUCKET_NAME=your_r2_bucket_name
CLOUDFLARE_R2_PUBLIC_URL=your_r2_public_url
CLOUDFLARE_PAGES_PROJECT_NAME=your_pages_project_name
```

## システムの流れ

### 基本プロセス

1. Google スプレッドシートから過去 1 週間分のツイートデータを取得
2. リンク記事の内容をスクレイピング
3. コンテンツを「技術系」と「それ以外」に分類
4. 各カテゴリのコンテンツを要約
5. 会話形式に変換
6. 音声ファイルに合成
7. ラジオ風のオープニングとエンディングを追加（オプション）
8. 処理済みデータを SQLite に記録

### 音声加工プロセス

1. ラジオ風のジングル生成（挨拶と結び）
2. 音声ファイル間に無音を挿入
3. 複数の音声ファイルを結合して一つのポッドキャストとして出力

## ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。

## 設計詳細

システムの詳細な設計については [DESIGN.md](DESIGN.md) を参照してください。
