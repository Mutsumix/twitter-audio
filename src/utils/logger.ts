/**
 * ロギングユーティリティ
 * ログメッセージの記録とファイルへの出力
 */
import fs from "fs";
import path from "path";
import { saveLogEntry } from "../db";
import { config } from "../config";
import { LogLevel } from "../config/constants";

// ログディレクトリの確認・作成
if (!fs.existsSync(config.paths.logsDir)) {
  fs.mkdirSync(config.paths.logsDir, { recursive: true });
}

// ログファイルのパス
const logFilePath = path.join(
  config.paths.logsDir,
  `log-${new Date().toISOString().slice(0, 10)}.log`
);

/**
 * ログメッセージの記録
 * コンソール出力、ファイル出力、データベース保存を行う
 */
export const logMessage = async (
  level: LogLevel,
  message: string,
  details?: any
): Promise<void> => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  const logEntry = `[${timestamp}] [${level}] ${message}${detailsStr}\n`;

  // コンソール出力
  console.log(logEntry);

  // ファイル出力
  fs.appendFileSync(logFilePath, logEntry);

  // データベースに保存
  try {
    await saveLogEntry({
      level,
      message,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (error) {
    // データベース保存に失敗した場合は、コンソールとファイルのみに出力
    const errorMsg = `[${new Date().toISOString()}] [ERROR] Failed to save log to database: ${
      error instanceof Error ? error.message : String(error)
    }\n`;
    console.error(errorMsg);
    fs.appendFileSync(logFilePath, errorMsg);
  }
};

// 各ログレベルのショートカット関数
export const logInfo = (message: string, details?: any): Promise<void> =>
  logMessage(LogLevel.INFO, message, details);

export const logWarn = (message: string, details?: any): Promise<void> =>
  logMessage(LogLevel.WARN, message, details);

export const logError = (message: string, details?: any): Promise<void> =>
  logMessage(LogLevel.ERROR, message, details);

export default {
  logInfo,
  logWarn,
  logError,
};
