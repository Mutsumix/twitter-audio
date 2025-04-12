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

    // 無音ファイルの生成
    const silenceFilePath = path.join(
      AUDIO_OUTPUT_DIR,
      `_silence_${silenceDuration}s.mp3`
    );
    if (!fs.existsSync(silenceFilePath)) {
      logInfo(
        `${silenceDuration}秒の無音ファイルを生成します: ${silenceFilePath}`
      );
      await generateSilence(silenceFilePath, silenceDuration);
    }

    // 結合用の一時リスト
    const mergeList: string[] = [];

    // 無音を挟んで結合するためのリスト作成
    audioFilePaths.forEach((filePath, index) => {
      mergeList.push(filePath);
      // 最後のファイル以外の後ろに無音を追加
      if (index < audioFilePaths.length - 1) {
        mergeList.push(silenceFilePath);
      }
    });

    // FFmpegによる結合
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // 全てのファイルを入力に追加
      mergeList.forEach((file) => {
        command.input(file);
      });

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
        })
        .mergeToFile(outputFilePath, AUDIO_OUTPUT_DIR);
    });
  } catch (error) {
    logError("音声ファイル結合中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * 指定された長さの無音ファイルを生成する
 * @param outputPath 出力先ファイルパス
 * @param durationSeconds 無音の長さ（秒）
 * @returns 生成したファイルのパス
 */
export const generateSilence = async (
  outputPath: string,
  durationSeconds: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("anullsrc=r=44100:cl=stereo")
      .inputFormat("lavfi")
      .audioCodec("libmp3lame")
      .duration(durationSeconds)
      .on("error", (err) => {
        logError("無音ファイル生成中にエラーが発生しました", {
          error: err.message,
        });
        reject(err);
      })
      .on("end", () => {
        logInfo(
          `${durationSeconds}秒の無音ファイルを生成しました: ${outputPath}`
        );
        resolve(outputPath);
      })
      .save(outputPath);
  });
};

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
  generateSilence,
  getOrCreateRadioJingle,
  getAudioDuration,
};
