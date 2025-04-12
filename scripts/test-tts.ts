/**
 * 音声合成機能のテストスクリプト
 * 直接TTSサービスをテストするための簡易スクリプト
 */
import path from "path";
import fs from "fs";
import { synthesizeSpeechWithElevenLabs } from "../src/services/tts";
import { TTS_SETTINGS } from "../src/config/constants";
import { logInfo, logError } from "../src/utils/logger";

// 出力ディレクトリの確認
const AUDIO_OUTPUT_DIR = path.join(process.cwd(), "output", "audio");
const TEST_DIR = path.join(AUDIO_OUTPUT_DIR, "test");

// テストディレクトリの作成とクリーンアップ
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
} else {
  // 古いテストファイルをクリーンアップ（ディスク容量確保のため）
  try {
    const files = fs.readdirSync(TEST_DIR);
    for (const file of files) {
      if (file.endsWith(".mp3")) {
        const filePath = path.join(TEST_DIR, file);
        fs.unlinkSync(filePath);
        console.log(`古いテストファイルを削除しました: ${filePath}`);
      }
    }
  } catch (error) {
    console.error("ファイルのクリーンアップ中にエラーが発生しました:", error);
  }
}

/**
 * 音声合成機能をテストする
 */
const testTTS = async () => {
  try {
    logInfo("音声合成機能のテストを開始します");

    // テスト用の短いテキスト
    const shortText =
      "これは短いテキストの音声合成テストです。問題なく変換できるはずです。";

    // テスト用の中程度の長さのテキスト
    const mediumText = `
    これは適度な長さのテキストです。ディスク容量の問題があるため、短めのテキストでテストします。

    音声合成システムはテキストを受け取り、自然な音声に変換します。テキストが長すぎる場合は分割処理されます。

    このテストでは、異なる音声（男性・女性）で正しく変換できることを確認します。
    `;

    // 音声ID定義
    const MALE_VOICE_ID = TTS_SETTINGS.DEFAULT_JP_VOICE_ID; // 男性音声 (asahi)
    const FEMALE_VOICE_ID = "8EkOjt4xTPGMclNlh1pk"; // 女性音声 (Morioki)

    // 短いテキストの音声合成テスト（男性音声）
    logInfo("短いテキストの音声合成テスト（男性音声）を実行します");
    const shortOutputPathMale = path.join(TEST_DIR, "short_test_male.mp3");
    await synthesizeSpeechWithElevenLabs(
      shortText,
      MALE_VOICE_ID,
      shortOutputPathMale
    );

    // 短いテキストの音声合成テスト（女性音声）
    logInfo("短いテキストの音声合成テスト（女性音声）を実行します");
    const shortOutputPathFemale = path.join(TEST_DIR, "short_test_female.mp3");
    await synthesizeSpeechWithElevenLabs(
      shortText,
      FEMALE_VOICE_ID,
      shortOutputPathFemale
    );

    // 中程度の長さのテキストの音声合成テスト（男性音声）
    logInfo("中程度の長さのテキスト音声合成テスト（男性音声）を実行します");
    const mediumOutputPathMale = path.join(TEST_DIR, "medium_test_male.mp3");
    await synthesizeSpeechWithElevenLabs(
      mediumText,
      MALE_VOICE_ID,
      mediumOutputPathMale
    );

    // 中程度の長さのテキストの音声合成テスト（女性音声）
    logInfo("中程度の長さのテキスト音声合成テスト（女性音声）を実行します");
    const mediumOutputPathFemale = path.join(
      TEST_DIR,
      "medium_test_female.mp3"
    );
    await synthesizeSpeechWithElevenLabs(
      mediumText,
      FEMALE_VOICE_ID,
      mediumOutputPathFemale
    );

    logInfo(`テストが完了しました。
短いテキスト出力（男性）: ${shortOutputPathMale}
短いテキスト出力（女性）: ${shortOutputPathFemale}
中程度テキスト出力（男性）: ${mediumOutputPathMale}
中程度テキスト出力（女性）: ${mediumOutputPathFemale}
`);

    console.log(`\n以下のコマンドでファイルを再生できます:
  open ${shortOutputPathMale}   # 男性音声（短）
  open ${shortOutputPathFemale} # 女性音声（短）
  open ${mediumOutputPathMale}   # 男性音声（中）
  open ${mediumOutputPathFemale} # 女性音声（中）\n`);
  } catch (error) {
    logError("音声合成テストの実行中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

// スクリプトを実行
testTTS().catch((error) => {
  console.error("エラーが発生しました:", error);
  process.exit(1);
});
