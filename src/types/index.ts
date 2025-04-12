/**
 * アプリケーション全体で使用する型定義
 */
import { ContentCategory, LogLevel } from "../config/constants";

/**
 * ツイートデータの型
 */
export interface TweetData {
  id?: number;
  tweetDate: Date;
  account: string;
  tweetLink: string;
  contentLink?: string | null;
  content: string;
  category?: ContentCategory;
  processed?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 要約されたコンテンツの型
 */
export interface SummarizedContent {
  original: TweetData;
  summary: string;
  category: ContentCategory;
}

/**
 * 会話形式に変換されたコンテンツの型
 */
export interface ConversationalContent {
  original: SummarizedContent;
  conversation: string;
}

/**
 * Podcastエピソードの型
 */
export interface PodcastEpisode {
  id?: number;
  title: string;
  fileLocation: string;
  duration: number;
  generatedAt?: Date;
  tweets: string; // JSON配列文字列
}

/**
 * システムログの型
 */
export interface SystemLogEntry {
  id?: number;
  level: LogLevel;
  message: string;
  timestamp?: Date;
  details?: string | null;
}

/**
 * Googleスプレッドシートから取得したデータの行
 */
export interface SpreadsheetRow {
  date: string;
  account: string;
  contentLink: string | null;
  tweetLink: string;
  content: string;
}

/**
 * スクレイピング結果の型
 */
export interface ScrapedContent {
  url: string;
  title?: string;
  content: string;
  siteName?: string;
  publishDate?: string;
  error?: string;
}

/**
 * 分類結果の型
 */
export interface ClassificationResult {
  category: ContentCategory;
  confidence: number;
  reasoning?: string;
}

/**
 * 音声合成の設定
 */
export interface TTSSettings {
  voiceId: string;
  settings: {
    stability: number;
    similarity_boost: number;
  };
}
