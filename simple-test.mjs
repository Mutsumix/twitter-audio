/**
 * 単純な音声合成テスト
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// __dirnameの代替（ESModuleでは直接使えないため）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 出力ディレクトリ
const OUTPUT_DIR = path.join(__dirname, "output");

// 出力ディレクトリの確認・作成
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Morioki（日本人女性）音声ID
const VOICE_ID = "8EkOjt4xTPGMclNlh1pk";

/**
 * テキストを音声に変換
 */
async function textToSpeech(text, outputPath) {
  try {
    console.log(`音声合成を開始します: ${outputPath}`);
    console.log(`テキスト長: ${text.length}文字`);
    console.log(`使用する声: Morioki (女性)`);

    // APIキー
    const apiKey = process.env.TTS_API_KEY;
    if (!apiKey) {
      throw new Error("TTS_API_KEYが設定されていません");
    }

    // リクエストデータ
    const requestData = {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
      },
    };

    // APIリクエスト
    const response = await axios({
      method: "post",
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      data: requestData,
      responseType: "arraybuffer",
    });

    // 音声ファイル保存
    fs.writeFileSync(outputPath, response.data);
    console.log(`音声ファイルを保存しました: ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error("音声合成に失敗しました", error);
    throw error;
  }
}

async function main() {
  const scriptContent = `こんにちは、テスト音声です。

簡単な文章のテストを行います。
人工知能技術により、音声合成の品質が向上しました。
日本語の読み方にも対応できるようになりました。

それではまた次回お会いしましょう。`;

  try {
    const outputPath = path.join(OUTPUT_DIR, "simple_test.mp3");
    await textToSpeech(scriptContent, outputPath);
    console.log("テスト完了");
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

main().catch(console.error);
