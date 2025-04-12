/**
 * 会話形式変換モジュール
 * 要約したコンテンツを自然な会話形式に変換
 */
import OpenAI from "openai";
import { ContentCategory } from "../config/constants";
import { SummarizedContent, ConversationalContent } from "../types";
import { config } from "../config";
import { logError, logInfo } from "../utils/logger";
import { retryAsync } from "../utils/error-handler";
import { formatDateTimeJP } from "../utils/date";

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * 会話形式変換のプロンプト
 */
const createConversationPrompt = (
  content: SummarizedContent,
  includeTweetInfo: boolean = true
): string => {
  const isTech = content.category === ContentCategory.TECH;
  const tweetInfo = includeTweetInfo
    ? `元ツイート: @${content.original.account}さんが ${formatDateTimeJP(
        content.original.tweetDate
      )} に投稿\nリンク: ${content.original.tweetLink}`
    : "";

  return `
以下の要約コンテンツを、一人のキャラクターが語るラジオ番組風の形式に変換してください。
キャラクターは知的で親しみやすく、時折ユーモアを交えながら話します。

要約コンテンツ:
"""
${content.summary}
"""

${
  isTech
    ? "これは技術系の内容です。専門用語があれば簡単な説明を加え、技術的な内容をわかりやすく解説してください。"
    : "一般向けの内容です。簡潔でわかりやすい説明を心がけてください。"
}

${tweetInfo}

自然な話し言葉で、一人のパーソナリティが解説するような会話の流れを作ってください。
「というわけで」「さて」「今日は」などの接続詞を適切に使って、ラジオ番組のようなトーンにしてください。
ただし、「このツイートは」や「このリンクは」などの表現は避け、コンテンツの内容自体について直接解説するスタイルにしてください。
`;
};

/**
 * 要約コンテンツを会話形式に変換する
 * @param content 要約されたコンテンツ
 * @returns 会話形式に変換されたコンテンツ
 */
export const convertToConversation = async (
  content: SummarizedContent
): Promise<string> => {
  try {
    if (!content.summary || content.summary.trim().length === 0) {
      return "この記事については特に内容がないようです。次の話題に移りましょう。";
    }

    // API呼び出しを実行（リトライ付き）
    return await retryAsync(
      async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content:
                "あなたはポッドキャストのパーソナリティです。与えられた情報を自然な会話形式で解説します。",
            },
            {
              role: "user",
              content: createConversationPrompt(content),
            },
          ],
          temperature: 0.7, // 少し創造性を持たせる
        });

        const response = completion.choices[0].message.content;
        if (!response) {
          throw new Error("APIからの応答が空です");
        }

        return response.trim();
      },
      2, // 最大2回リトライ
      1000, // 1秒間隔
      (error, attempt) => {
        logError(
          `会話形式変換のAPI呼び出しに失敗しました (リトライ ${attempt}/2)`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    );
  } catch (error) {
    logError("会話形式への変換に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // エラー時はフォールバックとして元の要約をそのまま返す
    return `次の話題です。${content.summary}`;
  }
};

/**
 * 複数の要約コンテンツを一つの会話形式に変換
 * @param techContents 技術系コンテンツの配列
 * @param otherContents その他コンテンツの配列
 * @returns 会話形式に変換されたコンテンツ
 */
export const createPodcastScript = async (
  techContents: SummarizedContent[],
  otherContents: SummarizedContent[]
): Promise<string> => {
  // テーマごとにコンバート
  const techConversations: string[] = [];
  for (const content of techContents) {
    try {
      logInfo(
        `技術系コンテンツを会話形式に変換: ${content.original.tweetLink}`
      );
      const conversation = await convertToConversation(content);
      techConversations.push(conversation);
    } catch (error) {
      logError("技術系コンテンツの会話形式変換に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
        tweet: content.original.tweetLink,
      });
    }
  }

  const otherConversations: string[] = [];
  for (const content of otherContents) {
    try {
      logInfo(`一般コンテンツを会話形式に変換: ${content.original.tweetLink}`);
      const conversation = await convertToConversation(content);
      otherConversations.push(conversation);
    } catch (error) {
      logError("一般コンテンツの会話形式変換に失敗しました", {
        error: error instanceof Error ? error.message : String(error),
        tweet: content.original.tweetLink,
      });
    }
  }

  // 導入部分
  const now = new Date();
  const introduction = `こんにちは、今回は${formatDateTimeJP(
    now
  )}に録音した週間お気に入りポッドキャストをお届けします。\n今週は技術系の話題が${
    techConversations.length
  }件、その他の話題が${
    otherConversations.length
  }件あります。それでは早速はじめていきましょう。\n\n`;

  // 技術系コンテンツ
  const techSection =
    techConversations.length > 0
      ? `まずは技術系の話題からです。\n\n${techConversations.join("\n\n")}\n\n`
      : "";

  // その他コンテンツ
  const otherSection =
    otherConversations.length > 0
      ? `続いて、その他の話題です。\n\n${otherConversations.join("\n\n")}\n\n`
      : "";

  // 終了部分
  const conclusion = `以上で今週のお気に入りポッドキャストを終わります。次回もお楽しみに！`;

  // 全体を組み合わせる
  return introduction + techSection + otherSection + conclusion;
};

/**
 * 要約コンテンツを会話形式コンテンツに変換
 */
export const convertContent = async (
  content: SummarizedContent
): Promise<ConversationalContent> => {
  const conversation = await convertToConversation(content);

  return {
    original: content,
    conversation,
  };
};

export default {
  convertToConversation,
  createPodcastScript,
  convertContent,
};
