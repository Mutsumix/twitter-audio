/**
 * 設定ファイル
 * 環境変数と定数の読み込みと管理
 */
import dotenv from "dotenv";
import path from "path";
import { PATHS } from "./constants";

// 環境変数の読み込み
dotenv.config();

// 必須環境変数の確認関数
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `環境変数 ${key} が設定されていません。.envファイルを確認してください。`
    );
  }
  return value;
};

// 設定オブジェクト
export const config = {
  // Google Sheets API
  googleSheets: {
    spreadsheetId: requireEnv("GOOGLE_SHEETS_ID"),
    apiKey: requireEnv("GOOGLE_SHEETS_API_KEY"),
  },

  // OpenAI API
  openai: {
    apiKey: requireEnv("OPENAI_API_KEY"),
  },

  // 音声合成
  tts: {
    apiKey: requireEnv("TTS_API_KEY"),
  },

  // データベース
  database: {
    url: requireEnv("DATABASE_URL"),
  },

  // パス設定
  paths: {
    outputDir: path.resolve(process.cwd(), PATHS.OUTPUT_DIR),
    logsDir: path.resolve(process.cwd(), PATHS.LOGS_DIR),
  },

  // 日付設定
  date: {
    oneWeekMs: 7 * 24 * 60 * 60 * 1000,
    // 処理対象とする日付の範囲（現在時刻から1週間前まで）
    getDateRange: (): { startDate: Date; endDate: Date } => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate, endDate };
    },
  },
};

export default config;
