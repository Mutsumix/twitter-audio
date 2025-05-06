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

// 技術系サブカテゴリ
export enum TechSubCategory {
  PROGRAMMING_LANGUAGE = "PROGRAMMING_LANGUAGE", // プログラミング言語
  FRAMEWORK = "FRAMEWORK", // フレームワーク
  AI_ML = "AI_ML", // AI/機械学習
  TOOLS = "TOOLS", // 開発ツール
  WEB_DEV = "WEB_DEV", // Web開発
  OTHER_TECH = "OTHER_TECH", // その他技術
}

// 一般サブカテゴリ
export enum OtherSubCategory {
  NEWS = "NEWS", // ニュース
  ENTERTAINMENT = "ENTERTAINMENT", // エンターテイメント
  LIFESTYLE = "LIFESTYLE", // ライフスタイル
  HOBBY = "HOBBY", // 趣味
  OTHER_GENERAL = "OTHER_GENERAL", // その他一般
}

// サブカテゴリの表示名
export const SubCategoryNames = {
  [TechSubCategory.PROGRAMMING_LANGUAGE]: "プログラミング言語",
  [TechSubCategory.FRAMEWORK]: "フレームワーク",
  [TechSubCategory.AI_ML]: "AI・機械学習",
  [TechSubCategory.TOOLS]: "開発ツール",
  [TechSubCategory.WEB_DEV]: "Web開発",
  [TechSubCategory.OTHER_TECH]: "その他技術トピック",

  [OtherSubCategory.NEWS]: "ニュース",
  [OtherSubCategory.ENTERTAINMENT]: "エンターテイメント",
  [OtherSubCategory.LIFESTYLE]: "ライフスタイル",
  [OtherSubCategory.HOBBY]: "趣味",
  [OtherSubCategory.OTHER_GENERAL]: "その他の話題",
};

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
  DEFAULT_VOICE_ID: "8EkOjt4xTPGMclNlh1pk", // Morioki (日本語)
  DEFAULT_JP_VOICE_ID: "8EkOjt4xTPGMclNlh1pk", // 日本語対応の音声ID（Morioki - 日本人女性）
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
