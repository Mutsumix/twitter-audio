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
import { convertComplexKanji } from "../utils/kanji-utils";

// 出力ディレクトリの確認・作成
if (!fs.existsSync(config.paths.outputDir)) {
  fs.mkdirSync(config.paths.outputDir, { recursive: true });
}

// 一度に処理できるテキストの最大文字数
// ElevenLabsは約5000文字までサポート、安全のため少し小さめに
const MAX_TEXT_LENGTH = 4000;

/**
 * 長いテキストを複数のチャンクに分割
 * @param text 分割する長いテキスト
 * @returns 分割されたテキストの配列
 */
function splitTextIntoChunks(text: string): string[] {
  if (text.length <= MAX_TEXT_LENGTH) {
    return [text];
  }

  // テキストを段落に分割
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // 現在のチャンクに段落を追加しても最大長を超えない場合は追加
    if (currentChunk.length + paragraph.length + 2 <= MAX_TEXT_LENGTH) {
      if (currentChunk) {
        currentChunk += "\n\n" + paragraph;
      } else {
        currentChunk = paragraph;
      }
    } else {
      // 現在の段落だけでも最大長を超える場合は、さらに文単位で分割
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (paragraph.length > MAX_TEXT_LENGTH) {
        // 段落を文に分割
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= MAX_TEXT_LENGTH) {
            if (currentChunk) {
              currentChunk += " " + sentence;
            } else {
              currentChunk = sentence;
            }
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            // 文が長すぎる場合は単語単位で分割
            if (sentence.length > MAX_TEXT_LENGTH) {
              let remainingSentence = sentence;
              while (remainingSentence.length > 0) {
                chunks.push(remainingSentence.substring(0, MAX_TEXT_LENGTH));
                remainingSentence =
                  remainingSentence.substring(MAX_TEXT_LENGTH);
              }
              currentChunk = "";
            } else {
              currentChunk = sentence;
            }
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 複数の音声ファイルを一つに結合
 * @param filePaths 結合する音声ファイルのパス配列
 * @param outputPath 出力先のパス
 * @returns 結合後のファイルパス
 */
async function mergeAudioFiles(
  filePaths: string[],
  outputPath: string
): Promise<string> {
  // 外部コマンドを使って結合（ffmpegなど）
  try {
    // ffmpegコマンドを構築
    const inputFiles = filePaths.map((path) => `-i "${path}"`).join(" ");
    const filterComplex = `concat=n=${filePaths.length}:v=0:a=1[out]`;

    const command = `ffmpeg ${inputFiles} -filter_complex "${filterComplex}" -map "[out]" "${outputPath}"`;

    // コマンド実行
    execSync(command);

    return outputPath;
  } catch (error) {
    logError("音声ファイルの結合に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ElevenLabsのAPIを使用してテキストを音声に変換
 * 長いテキストは自動的に分割して処理
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

    // テキストの長さをログ出力
    const textLength = text.length;
    logInfo(`音声合成するテキストの長さ: ${textLength}文字`);

    // デフォルトの出力パスは日付ベース
    const finalOutputPath =
      outputPath ||
      path.join(
        config.paths.outputDir,
        `podcast-${formatDate(new Date())}.mp3`
      );

    // ディレクトリが存在することを確認
    const dirPath = path.dirname(finalOutputPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logInfo(`ディレクトリを作成しました: ${dirPath}`);
    }

    // テキストの長さが限界を超える場合は分割処理
    if (textLength > MAX_TEXT_LENGTH) {
      logInfo(
        `テキストが${MAX_TEXT_LENGTH}文字を超えるため、複数に分割して処理します`
      );
      const chunks = splitTextIntoChunks(text);
      logInfo(`${chunks.length}個のチャンクに分割しました`);

      // 各チャンクを個別に処理して一時ファイルに保存
      const tempFilePaths: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkPath = path.join(
          dirPath,
          `temp_chunk_${i}_${path.basename(finalOutputPath)}`
        );

        logInfo(
          `チャンク${i + 1}/${chunks.length}を処理中 (${chunk.length}文字)`
        );

        // API呼び出し
        await processChunk(chunk, voiceId, chunkPath);
        tempFilePaths.push(chunkPath);
      }

      // すべての一時ファイルを結合
      logInfo(`${tempFilePaths.length}個の音声ファイルを結合します`);
      await mergeAudioFiles(tempFilePaths, finalOutputPath);

      // 一時ファイルを削除
      for (const tempPath of tempFilePaths) {
        try {
          fs.unlinkSync(tempPath);
        } catch (error) {
          logError(`一時ファイルの削除に失敗: ${tempPath}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logInfo(`音声ファイルを保存しました: ${finalOutputPath}`);
      return finalOutputPath;
    } else {
      // 分割不要の場合は直接処理
      logInfo(`音声合成を開始します: ${finalOutputPath}`);
      await processChunk(text, voiceId, finalOutputPath);
      return finalOutputPath;
    }
  } catch (error) {
    logError("音声合成に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
      textLength: text.length,
    });
    throw error;
  }
};

/**
 * 1つのテキストチャンクをAPIで処理
 * @param text テキスト
 * @param voiceId 音声ID
 * @param outputPath 出力パス
 */
async function processChunk(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<void> {
  return await retryAsync(
    async () => {
      try {
        // APIリクエストの詳細をログ出力（デバッグ用）
        logInfo(
          `APIリクエスト準備: voice=${voiceId}, テキスト長=${text.length}`
        );

        const apiKey = config.tts.apiKey;
        if (!apiKey) {
          throw new Error("APIキーが設定されていません");
        }

        const requestData = {
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            ...TTS_SETTINGS.VOICE_SETTINGS,
            style: 0,
            use_speaker_boost: true,
          },
        };

        // APIリクエスト送信
        const response = await axios({
          method: "post",
          url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          data: requestData,
          responseType: "arraybuffer",
        });

        // レスポンスのステータスコードを確認
        logInfo(
          `APIレスポンス: status=${response.status}, データサイズ=${response.data.length}バイト`
        );

        // 音声ファイル保存
        fs.writeFileSync(outputPath, response.data);
        logInfo(`チャンクの音声ファイルを保存しました: ${outputPath}`);
      } catch (axiosError) {
        // Axiosエラーの詳細情報をログ出力
        if (axios.isAxiosError(axiosError)) {
          if (axiosError.response) {
            // レスポンスがある場合
            const responseData = axiosError.response.data;
            let errorDetail: string;

            // バイナリレスポンスの場合は文字列に変換
            if (responseData instanceof Buffer) {
              try {
                errorDetail = responseData.toString("utf8");
              } catch (e) {
                errorDetail = "バイナリレスポンス（解析不可）";
              }
            } else {
              errorDetail = JSON.stringify(responseData);
            }

            logError("API呼び出しエラーの詳細", {
              status: axiosError.response.status,
              statusText: axiosError.response.statusText,
              headers: JSON.stringify(axiosError.response.headers),
              data: errorDetail,
            });
          } else if (axiosError.request) {
            // リクエストはされたがレスポンスがない場合
            logError("APIからレスポンスがありません", {
              request: axiosError.request,
            });
          } else {
            // その他のエラー
            logError("API呼び出し準備中にエラー", {
              message: axiosError.message,
            });
          }
        }

        // エラーを再スロー
        throw axiosError;
      }
    },
    2, // 最大2回リトライ
    2000, // 2秒間隔
    (error, attempt) => {
      logError(`音声合成のAPI呼び出しに失敗しました (リトライ ${attempt}/2)`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );
}

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
 * 日本語テキストの場合は小学校4年生以上で習う漢字をひらがなに変換する
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

    // 日本語テキストの場合は難しい漢字をひらがなに変換
    const voiceId =
      options?.voiceId || config.tts.voiceId || TTS_SETTINGS.DEFAULT_VOICE_ID;
    const isJapaneseVoice = voiceId === TTS_SETTINGS.DEFAULT_JP_VOICE_ID;

    let processedText = text;

    if (isJapaneseVoice) {
      try {
        logInfo("日本語テキストの漢字変換を実行します");
        // 難しい漢字をひらがなに変換
        processedText = await convertComplexKanji(text);
        logInfo("漢字変換が完了しました");
      } catch (error) {
        logError("漢字変換に失敗しました - 原文のまま処理します", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 変換前後のテキストの違いをログ出力（デバッグ用）
    if (processedText !== text) {
      logInfo("漢字変換が適用されました");
    }

    // 音声合成実行
    const filePath = await synthesizeSpeechWithElevenLabs(
      processedText,
      voiceId,
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
