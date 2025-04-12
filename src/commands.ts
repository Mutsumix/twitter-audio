/**
 * コマンドライン機能の定義
 */
import path from "path";
import fs from "fs";
import { Command } from "./utils/cli";
import { logInfo, logError } from "./utils/logger";
import { formatDateTimeJP, formatDate } from "./utils/date";
import { getOrCreateRadioJingle, mergeAudioFiles } from "./utils/audio-utils";
// 独立したメイン関数をインポート
import { processAll } from "./commands-main";
import { config } from "./config";

// 出力ディレクトリの確認・作成
const AUDIO_OUTPUT_DIR = path.join(process.cwd(), "output", "audio");
if (!fs.existsSync(AUDIO_OUTPUT_DIR)) {
  fs.mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
}

/**
 * 全処理を実行するコマンド
 */
const processAllCommand: Command = {
  name: "process-all",
  description: "ツイート取得から音声ファイル生成までの全処理を実行します",
  options: [
    {
      name: "with-jingle",
      description: "ラジオ風のオープニングとエンディングを追加するかどうか",
      type: "boolean",
      default: true,
    },
    {
      name: "limit",
      alias: "l",
      description: "処理するツイートの最大件数",
      type: "number",
      default: 10,
    },
  ],
  handler: async (args) => {
    try {
      // processAll関数を実行
      const result = await processAll({ maxTweets: args.limit });

      // 処理結果がなければ終了
      if (!result) {
        logInfo("処理対象のツイートがないか、処理に失敗しました");
        return;
      }

      // ジングルを追加する場合
      if (args.withJingle) {
        logInfo("ラジオ風のジングルを追加します");
        await addRadioJingles(result.filePath);
      }

      logInfo(`処理が完了しました: ${result.filePath}`);
    } catch (error) {
      logError("全処理の実行中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * ラジオ風の挨拶と結びを生成するコマンド
 */
const generateJinglesCommand: Command = {
  name: "generate-jingles",
  description: "ラジオ風の挨拶と結びの音声を生成します",
  options: [
    {
      name: "force",
      description: "既存のファイルがあっても強制的に再生成するかどうか",
      type: "boolean",
      default: false,
    },
  ],
  handler: async (args) => {
    try {
      // 挨拶用のテキスト（読み上げやすくひらがな主体に）
      const introText =
        "こんにちは、ツイッター おきにいり ポッドキャストへ ようこそ。こんかいの おきにいり ツイートを ごしょうかいします。";
      const outroText =
        "いじょうで こんかいの ツイッター おきにいり ポッドキャストを おわります。おききいただき ありがとうございました。";

      // 挨拶音声の生成（日本語ボイスIDを使用）
      const introPath = await getOrCreateRadioJingle(
        "radio_intro.mp3",
        introText,
        args.force,
        "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
      );

      // 結び音声の生成（日本語ボイスIDを使用）
      const outroPath = await getOrCreateRadioJingle(
        "radio_outro.mp3",
        outroText,
        args.force,
        "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
      );

      logInfo(`ジングルの生成が完了しました:
- 挨拶: ${introPath}
- 結び: ${outroPath}`);
    } catch (error) {
      logError("ジングル生成中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * 音声ファイルを結合するコマンド
 */
const mergeAudioFilesCommand: Command = {
  name: "merge-audio-files",
  description: "複数の音声ファイルを一つに結合します",
  options: [
    {
      name: "files",
      description: "結合する音声ファイルのパス（カンマ区切り）",
      type: "array",
      required: true,
    },
    {
      name: "output",
      description: "出力ファイル名",
      type: "string",
      default: `merged_${formatDate(new Date())}.mp3`,
    },
    {
      name: "silence",
      description: "ファイル間に挿入する無音の長さ（秒）",
      type: "number",
      default: 2.5,
    },
  ],
  handler: async (args) => {
    try {
      // 結合する音声ファイルのパスを確認
      const filePaths = args.files as string[];
      if (!filePaths || filePaths.length === 0) {
        throw new Error("結合する音声ファイルが指定されていません");
      }

      // 全てのファイルが存在するか確認
      for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`ファイルが見つかりません: ${filePath}`);
        }
      }

      // 出力パスの設定
      const outputPath = path.join(AUDIO_OUTPUT_DIR, args.output);

      // ファイルの結合
      logInfo(`${filePaths.length}個の音声ファイルを結合します`);
      const resultPath = await mergeAudioFiles(
        filePaths,
        outputPath,
        args.silence
      );

      logInfo(`ファイルの結合が完了しました: ${resultPath}`);
    } catch (error) {
      logError("ファイル結合中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * ラジオジングルを音声ファイルに追加するコマンド
 */
const addRadioJinglesCommand: Command = {
  name: "add-jingles",
  description: "音声ファイルにラジオ風の挨拶と結びを追加します",
  options: [
    {
      name: "file",
      description: "対象の音声ファイルのパス",
      type: "string",
      required: true,
    },
    {
      name: "output",
      description:
        "出力ファイル名（指定しない場合は元のファイル名に _with_jingles を追加）",
      type: "string",
    },
  ],
  handler: async (args) => {
    try {
      // 対象ファイルの存在確認
      const filePath = args.file as string;
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }

      // ジングルを追加
      const resultPath = await addRadioJingles(filePath, args.output);

      logInfo(`ジングルの追加が完了しました: ${resultPath}`);
    } catch (error) {
      logError("ジングル追加中にエラーが発生しました", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

/**
 * 音声ファイルにラジオジングルを追加する処理
 * @param filePath 対象の音声ファイルのパス
 * @param outputPath 出力ファイルパス（省略時は自動生成）
 * @returns 生成されたファイルのパス
 */
async function addRadioJingles(
  filePath: string,
  outputPath?: string
): Promise<string> {
  try {
    // ジングルの生成（既に存在すれば再利用）
    // バランスの取れた読み上げテキスト
    const introText =
      "こんにちは、Twitterお気に入りポッドキャストへようこそ。今回のお気に入りツイートをご紹介します。";
    const outroText =
      "以上で今回のTwitterお気に入りポッドキャストを終わります。ご清聴 ありがとうございました。";

    // 挨拶音声の取得または生成（日本語ボイスIDを使用）
    const introPath = await getOrCreateRadioJingle(
      "radio_intro.mp3",
      introText,
      false,
      "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
    );

    // 結び音声の取得または生成（日本語ボイスIDを使用）
    const outroPath = await getOrCreateRadioJingle(
      "radio_outro.mp3",
      outroText,
      false,
      "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
    );

    // 出力パスの設定
    if (!outputPath) {
      const fileExt = path.extname(filePath);
      const fileName = path.basename(filePath, fileExt);
      outputPath = path.join(
        path.dirname(filePath),
        `${fileName}_with_jingles${fileExt}`
      );
    }

    // ファイルの結合（挨拶 + 本編 + 結び）
    logInfo("ジングルを追加して結合します");
    const resultPath = await mergeAudioFiles(
      [introPath, filePath, outroPath],
      outputPath
    );

    return resultPath;
  } catch (error) {
    logError("ジングル追加処理中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * ヘルプコマンド
 */
const helpCommand: Command = {
  name: "help",
  description: "ヘルプを表示します",
  handler: async () => {
    // ヘルプ表示はCLIユーティリティに任せる
    return Promise.resolve();
  },
};

/**
 * 利用可能なコマンド一覧
 */
export const commands: Command[] = [
  processAllCommand,
  generateJinglesCommand,
  mergeAudioFilesCommand,
  addRadioJinglesCommand,
  helpCommand,
];

export default commands;
