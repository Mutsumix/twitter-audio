/**
 * ツイート処理の効率化テストスクリプト
 * ツイートデータを読み込み、効率的に分析、まとめ、音声化する過程をテスト
 */
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { synthesizeSpeechWithElevenLabs } from "../src/services/tts";
import { TTS_SETTINGS } from "../src/config/constants";
import { logInfo, logError } from "../src/utils/logger";
import { ContentCategory } from "../src/config/constants";
import { config } from "../src/config";

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// 出力ディレクトリの確認
const OUTPUT_DIR = path.join(process.cwd(), "output");
const TEST_DIR = path.join(OUTPUT_DIR, "test-tweet-process");

// テストディレクトリの作成とクリーンアップ
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
} else {
  // 古いテストファイルをクリーンアップ（ディスク容量確保のため）
  try {
    const files = fs.readdirSync(TEST_DIR);
    for (const file of files) {
      const filePath = path.join(TEST_DIR, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        console.log(`古いテストファイルを削除しました: ${filePath}`);
      }
    }
  } catch (error) {
    console.error("ファイルのクリーンアップ中にエラーが発生しました:", error);
  }
}

/**
 * サンプルツイートデータ
 */
const sampleTweets = [
  {
    id: "tweet1",
    account: "user1",
    tweetDate: new Date("2025-04-10T10:00:00"),
    tweetLink: "https://twitter.com/user1/status/123456789",
    content:
      "MCPサーバーについて学んでいます。自社サービスに組み込む方法が素晴らしいです。",
    category: ContentCategory.TECH,
    summary:
      "MCPサーバーについて学習中。自社サービスへの組み込み方法に感銘を受けている。",
  },
  {
    id: "tweet2",
    account: "user2",
    tweetDate: new Date("2025-04-10T11:30:00"),
    tweetLink: "https://twitter.com/user2/status/123456790",
    content:
      "MCPの入門資料を公開しました。初心者にもわかりやすく解説しています。",
    category: ContentCategory.TECH,
    summary: "MCP入門資料を公開。初心者向けにわかりやすく解説している。",
  },
  {
    id: "tweet3",
    account: "user3",
    tweetDate: new Date("2025-04-11T09:15:00"),
    tweetLink: "https://twitter.com/user3/status/123456791",
    content:
      "MCPサーバーのセキュリティリスクについて解説しました。注意点をまとめています。",
    category: ContentCategory.TECH,
    summary:
      "MCPサーバーのセキュリティリスクについて解説。重要な注意点をまとめている。",
  },
  {
    id: "tweet4",
    account: "user4",
    tweetDate: new Date("2025-04-11T14:20:00"),
    tweetLink: "https://twitter.com/user4/status/123456792",
    content:
      "YouTube APIとMCPを組み合わせた動画推薦システムを作りました。GPT-4oとの連携が素晴らしい！",
    category: ContentCategory.TECH,
    summary:
      "YouTube APIとMCPを組み合わせた動画推薦システムを開発。GPT-4oとの連携に感動している。",
  },
  {
    id: "tweet5",
    account: "user5",
    tweetDate: new Date("2025-04-12T08:30:00"),
    tweetLink: "https://twitter.com/user5/status/123456793",
    content:
      "キャベツの芯を水耕栽培したら予想外の成長を見せました。驚きの結果です！",
    category: ContentCategory.OTHER,
    summary: "キャベツの芯の水耕栽培が予想外の成長を見せた実験結果を報告。",
  },
  {
    id: "tweet6",
    account: "user6",
    tweetDate: new Date("2025-04-12T10:45:00"),
    tweetLink: "https://twitter.com/user6/status/123456794",
    content:
      "今日のラジオ番組「Watta! Itta!」が面白かったです。沖縄の最新情報が満載でした。",
    category: ContentCategory.OTHER,
    summary:
      "ラジオ番組「Watta! Itta!」を視聴。沖縄の最新情報が充実していた感想。",
  },
];

/**
 * 効率的なツイート分析とコンテンツ生成プロセス
 * 1. カテゴリごとにツイートをグループ化
 * 2. 一括でコンテキストを分析
 * 3. 会話形式のスクリプトを生成
 * 4. 音声合成
 */
const processAndGenerateAudio = async () => {
  try {
    logInfo("ツイート処理とオーディオ生成テストを開始します");

    // 1. カテゴリごとにツイートをグループ化
    const techTweets = sampleTweets.filter(
      (tweet) => tweet.category === ContentCategory.TECH
    );
    const otherTweets = sampleTweets.filter(
      (tweet) => tweet.category === ContentCategory.OTHER
    );

    logInfo(
      `ツイートを分類しました: 技術系=${techTweets.length}件, その他=${otherTweets.length}件`
    );

    // 2. カテゴリごとに一括分析用のコンテキストを生成
    logInfo("技術系ツイートの一括分析を開始");
    const techContext = await analyzeTweets(techTweets, "技術系");

    logInfo("一般ツイートの一括分析を開始");
    const otherContext = await analyzeTweets(otherTweets, "一般");

    // 3. 全体の会話スクリプトを生成
    logInfo("会話形式のスクリプトを生成");
    const script = await generateConversationScript(techContext, otherContext);

    // スクリプトをファイルに保存（確認用）
    const scriptPath = path.join(TEST_DIR, "podcast_script.txt");
    fs.writeFileSync(scriptPath, script);
    logInfo(`スクリプトをファイルに保存しました: ${scriptPath}`);

    // 4. 音声合成（女性音声を使用）
    logInfo("スクリプトの音声合成を開始");
    const outputPath = path.join(TEST_DIR, "podcast_output.mp3");

    // 音声IDを設定（日本人女性音声 - Morioki）
    const voiceId = "8EkOjt4xTPGMclNlh1pk";

    await synthesizeSpeechWithElevenLabs(script, voiceId, outputPath);
    logInfo(`音声ファイルを生成しました: ${outputPath}`);

    console.log(`\n処理が完了しました！
スクリプト: ${scriptPath}
音声ファイル: ${outputPath}

音声ファイルを再生するには:
open ${outputPath}
`);
  } catch (error) {
    logError("処理中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

/**
 * ツイートグループを一括分析
 * @param tweets ツイートの配列
 * @param category カテゴリ名
 * @returns 分析結果のコンテキスト情報
 */
async function analyzeTweets(tweets: any[], category: string): Promise<string> {
  // ツイート情報をまとめる
  const tweetInfos = tweets
    .map((tweet, index) => {
      const dateStr = tweet.tweetDate.toISOString().split("T")[0];
      return `【${index + 1}】@${tweet.account}さんが${dateStr}に投稿:
要約: ${tweet.summary}
URL: ${tweet.tweetLink}`;
    })
    .join("\n\n");

  // APIプロンプト
  const prompt = `
以下は${category}に関する${tweets.length}件のツイートです。
これらのツイートを全体的に分析し、共通するテーマ、トレンド、重要なポイントを見つけてください。
個別のツイートを一つずつ説明するのではなく、全体を俯瞰した分析と洞察を提供してください。

${tweetInfos}

分析にはこれらの要素を含めてください:
1. 主要なテーマや話題
2. トレンドや動向
3. 重要なポイントや洞察
4. 全体的なコンテキスト

フォーマット: Markdown形式で見出しや箇条書きを使用して、整理された分析結果を提供してください。
`;

  // APIコール実行
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "あなたはソーシャルメディアアナリストです。ツイートの集合を分析し、洞察に富んだコンテキスト情報を提供します。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || "";
}

/**
 * 分析結果から会話形式のスクリプトを生成
 * @param techContext 技術系コンテンツの分析結果
 * @param otherContext その他コンテンツの分析結果
 * @returns 会話形式のスクリプト
 */
async function generateConversationScript(
  techContext: string,
  otherContext: string
): Promise<string> {
  const date = new Date().toISOString().split("T")[0];

  // スクリプト生成プロンプト
  const prompt = `
あなたはポッドキャストのホストです。以下の分析内容をもとに、一人で話す会話形式のポッドキャストスクリプトを作成してください。
聴きやすく、自然な語り口で、技術系の話題とその他の話題をバランスよく取り上げてください。

## 技術系トピックの分析
${techContext}

## その他のトピックの分析
${otherContext}

ポッドキャストの構成:
1. 簡潔な挨拶と今回のエピソードの概要（30秒程度）
2. 技術系の話題（メインコンテンツ）
3. その他の話題（軽めの内容）
4. まとめと締めくくり（30秒程度）

重要なガイドライン:
- 一人のホストが話すスタイルで、自然な会話のように展開してください
- 「さて」「では」「今日は」などの接続詞を適切に使い、話の流れを作ってください
- 専門用語が出てきたら簡単な説明を加えてください
- 特定のツイートを一つずつ説明するのではなく、テーマごとにまとめてください
- 会話の中に適度な間や呼吸を入れるために、短い段落に分けてください
- リスナーに話しかけるような親しみやすい口調を使ってください

日付: ${date}
ポッドキャスト名: Twitter Weekly Digest
エピソード形式: 10〜15分の短いエピソード
`;

  // APIコール実行
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "あなたはプロのポッドキャストスクリプトライターです。自然でエンゲージメントの高い会話形式のスクリプトを作成します。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
  });

  return response.choices[0].message.content || "";
}

// スクリプトを実行
processAndGenerateAudio().catch((err) => {
  console.error("スクリプト実行中にエラーが発生しました:", err);
  process.exit(1);
});
