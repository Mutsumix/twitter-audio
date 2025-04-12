/**
 * 音声操作機能のデモスクリプト
 */
import path from "path";
import fs from "fs";
import {
  getOrCreateRadioJingle,
  mergeAudioFiles,
} from "../src/utils/audio-utils";
import { logInfo, logError } from "../src/utils/logger";

// 出力ディレクトリの確認
const AUDIO_OUTPUT_DIR = path.join(process.cwd(), "output", "audio");
const DEMO_DIR = path.join(AUDIO_OUTPUT_DIR, "demo");

// デモディレクトリの作成
if (!fs.existsSync(DEMO_DIR)) {
  fs.mkdirSync(DEMO_DIR, { recursive: true });
}

// ジングル用のディレクトリも作成
const JINGLES_DEMO_DIR = path.join(AUDIO_OUTPUT_DIR, "jingles", "demo");
if (!fs.existsSync(JINGLES_DEMO_DIR)) {
  fs.mkdirSync(JINGLES_DEMO_DIR, { recursive: true });
}

/**
 * ラジオジングルと無音を生成してテストする
 */
const testAudioFeatures = async () => {
  try {
    logInfo("音声操作機能のデモを開始します");

    // 1. ラジオジングルの生成
    logInfo("ラジオジングルを生成します");

    // 読み上げやすくするため、ひらがなを多めに使用
    const introText =
      "こんにちは、ツイッター おんせいか デモへようこそ。かんたんな きのう テストを おこないます。";

    // TTS_SETTINGS.DEFAULT_JP_VOICE_IDを使用
    const introPath = await getOrCreateRadioJingle(
      path.join("demo", "demo_intro.mp3"),
      introText,
      true, // 強制再生成
      "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
    );

    // 読み上げやすくするため、ひらがなを多めに使用
    const outroText =
      "いじょうで テストを しゅうりょうします。ごせいちょう ありがとうございました。";
    const outroPath = await getOrCreateRadioJingle(
      path.join("demo", "demo_outro.mp3"),
      outroText,
      true, // 強制再生成
      "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
    );

    logInfo("コンテンツを生成します");
    // 読み上げやすくするため、ひらがなを多めに使用し、文を短くシンプルに
    const contentText =
      "これは テストよう の おんせい コンテンツです。この システムでは、ツイッター の おきにいり ツイートを おんせいかして ポッドキャスト のように たのしむことが できます。";
    const contentPath = await getOrCreateRadioJingle(
      path.join("demo", "demo_content.mp3"),
      contentText,
      true, // 強制再生成
      "GKDaBI8TKSBJVhsCLD6n" // 日本語ボイスID（asahi - 日本人男性）
    );

    // 2. ファイルの結合
    logInfo("音声ファイルを結合します");
    const outputPath = path.join(DEMO_DIR, "demo_podcast.mp3");

    // ジングル + コンテンツ + ジングルの形で結合
    await mergeAudioFiles(
      [introPath, contentPath, outroPath],
      outputPath,
      2.0 // セクション間に2秒の無音を挿入
    );

    logInfo(`デモが完了しました。出力ファイル: ${outputPath}`);
    logInfo("以下のコマンドでファイルを再生できます:");
    console.log(`\n  open ${outputPath}\n`);
  } catch (error) {
    logError("デモの実行中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// スクリプトを実行
testAudioFeatures().catch((error) => {
  console.error("エラーが発生しました:", error);
  process.exit(1);
});
