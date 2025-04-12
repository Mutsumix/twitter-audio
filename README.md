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
- 音声ファイル（MP3）の生成
- SQLite によるデータ管理

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
  - node-gtts/elevenlabs: 音声合成
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

```bash
# 音声Podcastの生成
npm run generate-podcast

# 生成された音声ファイルは output/ ディレクトリに保存されます
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
```

## システムの流れ

1. Google スプレッドシートから過去 1 週間分のツイートデータを取得
2. リンク記事の内容をスクレイピング
3. コンテンツを「技術系」と「それ以外」に分類
4. 各カテゴリのコンテンツを要約
5. 会話形式に変換
6. 音声ファイルに合成
7. 処理済みデータを SQLite に記録

## ライセンス

本プロジェクトは [MIT License](LICENSE) の下で公開されています。

## 設計詳細

システムの詳細な設計については [DESIGN.md](DESIGN.md) を参照してください。
