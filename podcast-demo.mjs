/**
 * ポッドキャストデモ音声生成
 * 改良版のスクリプトで漢字変換機能をテスト
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { execSync } from "child_process";

// 環境変数の読み込み
dotenv.config();

// __dirnameの代替（ESModuleでは直接使えないため）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 出力ディレクトリ
const OUTPUT_DIR = path.join(__dirname, "output");

// 現在の日時をフォーマット
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}年${month}月${day}日${hours}時${minutes}分`;
}

// 出力ディレクトリの確認・作成
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Morioki（日本人女性）音声ID
const VOICE_ID = "8EkOjt4xTPGMclNlh1pk";

/**
 * テキストを音声に変換
 * Elevenlabsを使った高品質な合成音声の生成
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

    // 難しい漢字は読み仮名を付ける簡易実装
    // （本来は実装済みのkanji-utilsを使いますが、依存関係の問題を避けるため簡易版を使用）
    // 読みがな付きの難しい漢字のマップ
    const kanji = {
      躍進: "やくしん",
      著しく: "いちじるしく",
      複雑: "ふくざつ",
      駆使: "くし",
      実現: "じつげん",
      技術: "ぎじゅつ",
      開発: "かいはつ",
      環境: "かんきょう",
      変化: "へんか",
      適応: "てきおう",
      促進: "そくしん",
      構築: "こうちく",
    };

    // 簡易的な漢字処理（実際のプロジェクトではより洗練された処理を実装）
    let processedText = text;
    Object.keys(kanji).forEach((word) => {
      const reading = kanji[word];
      // 漢字に読み仮名を付ける（括弧付き）
      const pattern = new RegExp(word, "g");
      processedText = processedText.replace(pattern, `${word}（${reading}）`);
    });

    // リクエストデータ
    const requestData = {
      text: processedText,
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

    // 原稿も保存
    const scriptPath = outputPath.replace(".mp3", "_script.txt");
    fs.writeFileSync(scriptPath, text);
    console.log(`原稿ファイルを保存しました: ${scriptPath}`);

    return {
      filePath: outputPath,
      scriptPath: scriptPath,
      duration: getAudioDuration(outputPath),
    };
  } catch (error) {
    console.error("音声合成に失敗しました", error);
    throw error;
  }
}

/**
 * 音声ファイルの長さ（秒）を取得
 */
function getAudioDuration(filePath) {
  try {
    // ffprobeを使って音声ファイルの長さを取得
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    )
      .toString()
      .trim();

    return parseFloat(output);
  } catch (error) {
    console.error("音声の長さの取得に失敗しました:", error);
    return 0; // エラー時は0秒とする
  }
}

/**
 * メイン処理
 */
async function main() {
  const now = new Date();
  const formattedDate = formatDate(now);

  const podcastScript = `はい！ムツミックスの最初はグッドトゥーミー

この番組は池袋に生息するエンジニア、ムツミックスがツイッター、かっこ現エックス で今週お気に入りをつけたツイートを、AIが勝手にまとめて分析して紹介するというポッドキャスト番組です。
これを読み上げている私もAIです。
こんな時代ですが、最後までお聞きいただけるとハッピーです。まあ私AIなんで感情ありませんけど。
それでは早速紹介していきます。

今週の技術系の話題は3件ありました。

人工知能技術の躍進により、ソフトウェア開発環境が著しく変化しています。特に自然言語処理の分野では、複雑な日本語の読み方や表記揺れにも対応できる技術が普及してきました。

最新の音声変換技術を駆使して、より自然な発話を実現するシステムが構築されています。これにより、AIによる読み上げの品質が向上し、人間の声に近い自然さを実現しています。

またオープンソースコミュニティでは、これらの技術を誰もが利用できるようにするための取り組みが促進されています。ライブラリやツールの充実により、個人開発者でも高品質な音声コンテンツを作成できる環境が整いつつあります。

続いて、その他の話題を2件紹介します。

春の訪れとともに、公園や庭先では桜が満開を迎えています。今年は例年より少し早めの開花となりましたが、その分長く花見を楽しめそうです。

また、最近のカフェではコーヒー豆の産地にこだわったメニューが増えています。特に単一農園産のスペシャルティコーヒーは、その複雑な風味と香りで人気を集めています。

今週は技術系のツイートを3件、それ以外の分野では2件のツイートをお気に入りしました。全部で5つのツイートから、技術の進化と日常の小さな喜びが見えてきます。

技術系のツイートでは特に音声合成技術に注目が集まっており、AIが人間のような自然な話し方をするための研究が進んでいることが分かります。一方で、季節の移り変わりやグルメなど、日常の楽しみを大切にする視点も忘れていないことが伺えます。

ムツミックスの最初はグッドトゥーミー、今週は以上です。
いかがでしたでしょうか。まあ、私AIなんであなたがどう思おうとどうだっていいんですけど。
それではまた来週お耳にかかりましょう。さいならっきょ`;

  try {
    // ファイル名に日時を含める
    const outputPath = path.join(OUTPUT_DIR, `podcast_${formattedDate}.mp3`);
    const result = await textToSpeech(podcastScript, outputPath);

    console.log("ポッドキャスト音声生成完了");
    console.log(`ファイル: ${result.filePath}`);
    console.log(`音声の長さ: ${Math.round(result.duration)}秒`);
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

// 実行
main().catch(console.error);
