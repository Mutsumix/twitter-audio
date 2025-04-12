/**
 * 音声ファイル操作ユーティリティ
 * FFmpegを使用して音声ファイルの結合や加工を行う
 */
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { logError, logInfo } from "./logger";
import { config } from "../config";
import { textToSpeech } from "../services/tts";

// 出力ディレクトリの準備
const AUDIO_OUTPUT_DIR = path.join(process.cwd(), "output", "audio");

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(AUDIO_OUTPUT_DIR)) {
  fs.mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
}

/**
 * 音声ファイルを結合する
 * @param audioFilePaths 結合する音声ファイルのパスの配列
 * @param outputFilePath 出力先のファイルパス
 * @param silenceDuration ファイル間に挿入する無音の長さ（秒）
 * @returns 結合後のファイルパス
 */
export const mergeAudioFiles = async (
  audioFilePaths: string[],
  outputFilePath: string,
  silenceDuration: number = 2.5
): Promise<string> => {
  try {
    // ファイルが1つ以下なら結合不要
    if (audioFilePaths.length <= 1) {
      if (audioFilePaths.length === 1) {
        fs.copyFileSync(audioFilePaths[0], outputFilePath);
        return outputFilePath;
      }
      throw new Error("結合する音声ファイルがありません");
    }

    logInfo(`${audioFilePaths.length}個の音声ファイルを結合します`);

    // 出力ディレクトリの確認
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // FFmpegによる結合（無音なしでフィルターを使う）
    return new Promise((resolve, reject) => {
      // フィルターコンプレックスで無音を挿入
      const inputs = audioFilePaths.map((_, i) => `[${i}:a]`).join("");
      const silenceFilter =
        audioFilePaths.length > 1
          ? `${inputs}concat=n=${audioFilePaths.length}:v=0:a=1[out]`
          : "";

      const command = ffmpeg();

      // 各ファイルを入力として追加
      audioFilePaths.forEach((file) => {
        command.input(file);
      });

      if (audioFilePaths.length > 1) {
        command.complexFilter(silenceFilter);
      }

      command
        .on("start", (commandLine) => {
          logInfo(`FFmpeg処理開始: ${commandLine}`);
        })
        .on("progress", (progress) => {
          // プログレス情報があれば表示
          if (progress.percent) {
            logInfo(`処理進捗: ${Math.round(progress.percent)}%`);
          }
        })
        .on("error", (err) => {
          logError("音声ファイル結合中にエラーが発生しました", {
            error: err.message,
          });
          reject(err);
        })
        .on("end", () => {
          logInfo(`音声ファイルの結合が完了しました: ${outputFilePath}`);
          resolve(outputFilePath);
        });

      if (audioFilePaths.length > 1) {
        command.map("[out]");
      }

      command
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .save(outputFilePath);
    });
  } catch (error) {
    logError("音声ファイル結合中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

// 無音ファイル生成は使用しない

/**
 * ラジオ風の挨拶音声を生成またはキャッシュから取得
 * @param outputFileName 出力ファイル名
 * @param text 挨拶のテキスト
 * @param forceRegenerate 既存ファイルがあっても強制的に再生成するかどうか
 * @param voiceId 使用する音声ID（省略時はデフォルトの音声）
 * @returns 生成された音声ファイルのパス
 */
export const getOrCreateRadioJingle = async (
  outputFileName: string,
  text: string,
  forceRegenerate: boolean = false,
  voiceId?: string
): Promise<string> => {
  // 挨拶・結び用のディレクトリ
  const jinglesDir = path.join(AUDIO_OUTPUT_DIR, "jingles");
  if (!fs.existsSync(jinglesDir)) {
    fs.mkdirSync(jinglesDir, { recursive: true });
  }

  const outputPath = path.join(jinglesDir, outputFileName);

  // ファイルが既に存在し、強制再生成でなければそのまま返す
  if (fs.existsSync(outputPath) && !forceRegenerate) {
    logInfo(`既存のジングルファイルを使用します: ${outputPath}`);
    return outputPath;
  }

  try {
    // TTSサービスを使用して音声ファイルを生成
    logInfo(`ジングル用の音声ファイルを生成します: ${outputPath}`);

    // 音声ファイルを生成
    const { filePath } = await textToSpeech(text, {
      outputPath,
      voiceId: voiceId, // voiceIdが指定されていれば使用
    });

    return filePath;
  } catch (error) {
    logError("ジングル音声の生成に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * 音声ファイルの長さを取得する
 * @param filePath 音声ファイルのパス
 * @returns 音声の長さ（秒）
 */
export const getAudioDuration = async (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logError("音声ファイルの長さ取得に失敗しました", {
          error: err.message,
          filePath,
        });
        reject(err);
        return;
      }

      if (metadata && metadata.format && metadata.format.duration) {
        resolve(metadata.format.duration);
      } else {
        reject(new Error("音声ファイルのメタデータが取得できませんでした"));
      }
    });
  });
};

export default {
  mergeAudioFiles,
  getOrCreateRadioJingle,
  getAudioDuration,
};
