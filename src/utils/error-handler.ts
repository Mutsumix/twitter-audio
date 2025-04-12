/**
 * エラーハンドリングユーティリティ
 */
import { logError } from "./logger";

/**
 * 非同期関数の実行とエラーハンドリングを行うユーティリティ
 * @param fn 実行する非同期関数
 * @param errorMessage エラー時のメッセージ
 * @param defaultValue エラー時のデフォルト値
 * @returns 関数の実行結果またはデフォルト値
 */
export const tryCatchAsync = async <T>(
  fn: () => Promise<T>,
  errorMessage: string,
  defaultValue?: T
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    await logError(errorMessage, {
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultValue;
  }
};

/**
 * 同期関数の実行とエラーハンドリングを行うユーティリティ
 * @param fn 実行する同期関数
 * @param errorMessage エラー時のメッセージ
 * @param defaultValue エラー時のデフォルト値
 * @returns 関数の実行結果またはデフォルト値
 */
export const tryCatch = <T>(
  fn: () => T,
  errorMessage: string,
  defaultValue?: T
): T | undefined => {
  try {
    return fn();
  } catch (error) {
    logError(errorMessage, {
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultValue;
  }
};

/**
 * 指定回数リトライする非同期関数
 * @param fn 実行する非同期関数
 * @param retries リトライ回数
 * @param delay リトライ間の待機時間（ミリ秒）
 * @param onError エラー発生時のコールバック
 * @returns 関数の実行結果
 */
export const retryAsync = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  onError?: (error: unknown, attempt: number) => void
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    if (onError) {
      onError(error, retries);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryAsync(fn, retries - 1, delay, onError);
  }
};

export default {
  tryCatch,
  tryCatchAsync,
  retryAsync,
};
