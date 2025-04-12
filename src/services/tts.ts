/**
 * 音声合成モジュール
 * テキストを音声ファイルに変換
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { execSync } from "child_process";
import { logError, logInfo } from "../utils/logger";
import { config } from "../config";
import { retryAsync } from "../utils/error-handler";
import { formatDate } from "../utils/date";
import { TTS_SETTINGS } from "../config/constants";

// 出力ディレクトリの確認・作成
if (!fs.existsSync(config.paths.outputDir)) {
  fs.mkdirSync(config.paths.outputDir, { recursive: true });
}

/**
 * ElevenLabsのAPIを使用してテキストを音声に変換
 * @param text 音声に変換するテキスト
 * @param voiceId 使用する音声ID
 * @param outputPath 出力ファイルパス
 * @returns 音声ファイルのパス
 */
export const synthesizeSpeechWithElevenLabs = async (
  text: string,
  voiceId: string = TTS_SETTINGS.DEFAULT_VOICE_ID,
  outputPath?: string
): Promise<string> => {
  try {
    // テキストが空の場合はエラー
    if (!text || text.trim().length === 0) {
      throw new Error("音声合成するテキストが空です");
    }

    // デフォルトの出力パスは日付ベース
    const finalOutputPath =
      outputPath ||
      path.join(
        config.paths.outputDir,
        `podcast-${formatDate(new Date())}.mp3`
      );

    // ElevenLabs APIを呼び出し
    logInfo(`音声合成を開始します: ${finalOutputPath}`);

    return await retryAsync(
      async () => {
        const response = await axios({
          method: "post",
          url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": config.tts.apiKey,
          },
          data: {
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: TTS_SETTINGS.VOICE_SETTINGS,
          },
          responseType: "arraybuffer",
        });

        // ディレクトリが存在することを確認
        const dirPath = path.dirname(finalOutputPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          logInfo(`ディレクトリを作成しました: ${dirPath}`);
        }

        fs.writeFileSync(finalOutputPath, response.data);
        logInfo(`音声ファイルを保存しました: ${finalOutputPath}`);
        return finalOutputPath;
      },
      2, // 最大2回リトライ
      2000, // 2秒間隔
      (error, attempt) => {
        logError(
          `音声合成のAPI呼び出しに失敗しました (リトライ ${attempt}/2)`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    );
  } catch (error) {
    logError("音声合成に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * 音声ファイルの長さ（秒）を取得する
 * @param filePath 音声ファイルのパス
 * @returns 音声の長さ（秒）
 */
export const getAudioDuration = (filePath: string): number => {
  try {
    // ffprobe がインストールされている必要があります
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    )
      .toString()
      .trim();

    return parseFloat(output);
  } catch (error) {
    logError("音声の長さの取得に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
      filePath,
    });
    return 0; // エラー時は0秒とする
  }
};

/**
 * テキストを音声ファイルに変換
 * @param text 音声に変換するテキスト
 * @param options オプション
 * @returns 音声ファイルのパスと長さ
 */
export const textToSpeech = async (
  text: string,
  options?: {
    outputPath?: string;
    voiceId?: string;
  }
): Promise<{ filePath: string; duration: number }> => {
  try {
    // テキストがなければエラー
    if (!text) {
      throw new Error("テキストが空です");
    }

    // 音声合成実行
    const filePath = await synthesizeSpeechWithElevenLabs(
      text,
      options?.voiceId || TTS_SETTINGS.DEFAULT_VOICE_ID,
      options?.outputPath
    );

    // 音声の長さを取得
    const duration = getAudioDuration(filePath);

    return { filePath, duration };
  } catch (error) {
    logError("テキストの音声変換に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export default {
  textToSpeech,
  synthesizeSpeechWithElevenLabs,
  getAudioDuration,
};
