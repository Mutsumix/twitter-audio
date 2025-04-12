/**
 * 定数定義ファイル
 */

// 日付関連
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// カテゴリ
export enum ContentCategory {
  TECH = "TECH",
  OTHER = "OTHER",
}

// ログレベル
export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

// 要約長
export const SUMMARY_LENGTH = {
  TECH: 500,
  OTHER: 300,
};

// 音声設定
export const TTS_SETTINGS = {
  DEFAULT_VOICE_ID: "default",
  OUTPUT_FORMAT: "mp3",
  VOICE_SETTINGS: {
    stability: 0.5,
    similarity_boost: 0.75,
  },
};

// ファイルパス
export const PATHS = {
  OUTPUT_DIR: "output",
  LOGS_DIR: "logs",
};

// Googleスプレッドシート関連
export const SHEET_SETTINGS = {
  RANGE: "A:F", // スプレッドシートの取得範囲
  DATE_COL_INDEX: 0,
  ACCOUNT_COL_INDEX: 1,
  CONTENT_LINK_COL_INDEX: 2,
  TWEET_LINK_COL_INDEX: 3,
  CONTENT_COL_INDEX: 4,
};
