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

    const introText =
      "こんにちは、Twitter音声化デモへようこそ。簡単な機能テストを行います。";

    // TTS_SETTINGS.DEFAULT_JP_VOICE_IDを使用
    const introPath = await getOrCreateRadioJingle(
      path.join("demo", "demo_intro.mp3"),
      introText,
      true, // 強制再生成
      "pNInz6obpgDQGcFmaJgB" // 日本語ボイスID（Bella）
    );

    const outroText =
      "以上でテストを終了します。ご清聴ありがとうございました。";
    const outroPath = await getOrCreateRadioJingle(
      path.join("demo", "demo_outro.mp3"),
      outroText,
      true, // 強制再生成
      "pNInz6obpgDQGcFmaJgB" // 日本語ボイスID（Bella）
    );

    logInfo("コンテンツを生成します");
    const contentText =
      "これはテスト用の音声コンテンツです。このシステムでは、Twitterのお気に入りツイートを音声化してポッドキャストのように楽しむことができます。";
    const contentPath = await getOrCreateRadioJingle(
      path.join("demo", "demo_content.mp3"),
      contentText,
      true, // 強制再生成
      "pNInz6obpgDQGcFmaJgB" // 日本語ボイスID（Bella）
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
