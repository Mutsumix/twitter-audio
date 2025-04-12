/**
 * Twitter音声ポッドキャスト生成
 * 実際のTwitterデータに基づいたコンテンツ生成
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

    // 難しい漢字と読み方のマッピング
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
      予測: "よそく",
      解析: "かいせき",
      処理: "しょり",
      機械: "きかい",
      学習: "がくしゅう",
      効率: "こうりつ",
      抽出: "ちゅうしゅつ",
      分類: "ぶんるい",
      自動化: "じどうか",
      画像: "がぞう",
      認識: "にんしき",
      高度: "こうど",
      活用: "かつよう",
      管理: "かんり",
      生成: "せいせい",
      特定: "とくてい",
      設計: "せっけい",
      連携: "れんけい",
      急速: "きゅうそく",
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

// 実際のツイートデータを模したサンプルデータ
const sampleTweets = [
  {
    id: 1,
    date: "2025-04-05",
    content:
      "最近のAI技術の進化は驚くべきものがある。特に音声合成の分野では、人間そっくりの声を生成可能になった。#AI #音声合成",
    url: "https://twitter.com/tech_expert/status/123456789",
    category: "TECH",
  },
  {
    id: 2,
    date: "2025-04-06",
    content:
      "機械学習を活用したデータ解析手法について調査中。予測モデルの精度向上に役立つテクニックが多数見つかった。#ML #データサイエンス",
    url: "https://twitter.com/data_scientist/status/234567890",
    category: "TECH",
  },
  {
    id: 3,
    date: "2025-04-07",
    content:
      "自然言語処理の最新論文を読んだ。言語モデルの効率的な学習方法について興味深い発見があった。#NLP #研究",
    url: "https://twitter.com/nlp_researcher/status/345678901",
    category: "TECH",
  },
  {
    id: 4,
    date: "2025-04-08",
    content:
      "今日の公園では桜が満開だった。散歩しながら写真を撮るのが楽しかった。#春 #桜 #写真",
    url: "https://twitter.com/nature_lover/status/456789012",
    category: "OTHER",
  },
  {
    id: 5,
    date: "2025-04-09",
    content:
      "新しいカフェで美味しいコーヒーを見つけた。エチオピア産の豆を使ったスペシャルティコーヒーだった。#コーヒー #カフェ巡り",
    url: "https://twitter.com/coffee_fan/status/567890123",
    category: "OTHER",
  },
];

/**
 * ツイートデータからポッドキャスト原稿を生成
 */
function generatePodcastScript(tweets) {
  // カテゴリー別に分類
  const techTweets = tweets.filter((tweet) => tweet.category === "TECH");
  const otherTweets = tweets.filter((tweet) => tweet.category !== "TECH");

  // オープニングフレーズ
  const opening = `はい！ムツミックスの最初はグッドトゥーミー

この番組は池袋に生息するエンジニア、ムツミックスがツイッター、かっこ現エックス で今週お気に入りをつけたツイートを、AIが勝手にまとめて分析して紹介するというポッドキャスト番組です。
これを読み上げている私もAIです。
こんな時代ですが、最後までお聞きいただけるとハッピーです。まあ私AIなんで感情ありませんけど。
それでは早速紹介していきます。`;

  // 技術系ツイートの要約
  const techSummary = `今週の技術系の話題は${techTweets.length}件ありました。

${
  techTweets.length > 0
    ? "テクノロジーの急速な進化についての話題が目立ちました。"
    : ""
}
${
  techTweets.some((t) => t.content.includes("AI"))
    ? "人工知能技術の躍進により、特に音声合成やデータ処理の分野で著しい進歩が見られます。"
    : ""
}
${
  techTweets.some((t) => t.content.includes("音声"))
    ? "音声合成技術では、より自然な話し方や感情表現が可能になり、AI音声と人間の声の区別が難しくなっています。"
    : ""
}
${
  techTweets.some((t) => t.content.includes("機械学習"))
    ? "機械学習技術を活用したデータ解析手法が発展し、より高度な予測モデルの構築が可能になっています。"
    : ""
}
${
  techTweets.some((t) => t.content.includes("自然言語処理"))
    ? "自然言語処理の研究も進んでおり、言語モデルの効率的な学習方法や応用範囲が広がっています。"
    : ""
}`;

  // その他ツイートの要約
  const otherSummary = `続いて、その他の話題を${
    otherTweets.length
  }件紹介します。

${
  otherTweets.some((t) => t.content.includes("桜"))
    ? "春の訪れとともに、公園や庭先では桜が満開を迎えています。美しい景色を楽しむ人々の様子が伝えられました。"
    : ""
}
${
  otherTweets.some((t) => t.content.includes("コーヒー"))
    ? "また、カフェ文化にも注目が集まっており、特に産地にこだわったスペシャルティコーヒーの魅力が紹介されています。"
    : ""
}`;

  // 全体のまとめ
  const summary = `今週は技術系のツイートを${
    techTweets.length
  }件、それ以外の分野では${
    otherTweets.length
  }件のツイートをお気に入りしました。全部で${
    tweets.length
  }つのツイートから、テクノロジーの進化と日常の小さな喜びが見えてきます。

${
  techTweets.length > 0
    ? "技術系のツイートでは特にAIと音声合成技術への関心が高く、これらの技術がどのように私たちの生活を変えていくかが注目されています。"
    : ""
}
${
  otherTweets.length > 0
    ? "一方で、季節の移り変わりやグルメなど、日常の楽しみを大切にする視点も忘れていないことが伺えます。"
    : ""
}`;

  // エンディングフレーズ
  const ending = `ムツミックスの最初はグッドトゥーミー、今週は以上です。
いかがでしたでしょうか。まあ、私AIなんであなたがどう思おうとどうだっていいんですけど。
それではまた来週お耳にかかりましょう。さいならっきょ`;

  // 最終的な原稿を組み立て
  return [opening, techSummary, otherSummary, summary, ending].join("\n\n");
}

/**
 * メイン処理
 */
async function main() {
  try {
    const now = new Date();
    const formattedDate = formatDate(now);

    console.log("ツイートデータからポッドキャスト原稿を生成します...");
    const podcastScript = generatePodcastScript(sampleTweets);

    console.log("生成された原稿の長さ:", podcastScript.length, "文字");

    // ファイル名に日時を含める
    const outputPath = path.join(
      OUTPUT_DIR,
      `twitter_podcast_${formattedDate}.mp3`
    );
    const result = await textToSpeech(podcastScript, outputPath);

    console.log("ポッドキャスト音声生成完了");
    console.log(`ファイル: ${result.filePath}`);
    console.log(`音声の長さ: ${Math.round(result.duration)}秒`);

    return result;
  } catch (error) {
    console.error("エラーが発生しました:", error);
    throw error;
  }
}

// 実行
main().catch(console.error);
