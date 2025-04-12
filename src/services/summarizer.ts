/**
 * 要約生成モジュール
 * 取得したコンテンツを適切な長さで要約
 */
import OpenAI from "openai";
import { ContentCategory, SUMMARY_LENGTH } from "../config/constants";
import { SummarizedContent, TweetData, ScrapedContent } from "../types";
import { config } from "../config";
import { logError, logInfo } from "../utils/logger";
import { retryAsync } from "../utils/error-handler";

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * 要約生成のプロンプト
 */
const createSummarizationPrompt = (
  content: string,
  category: ContentCategory
): string => {
  const isTech = category === ContentCategory.TECH;
  const length = SUMMARY_LENGTH[category];

  return `
以下のコンテンツを要約してください。このコンテンツは${
    isTech ? "技術系" : "その他の分野"
  }に関するものです。
${
  isTech ? "技術的な詳細を保持しつつ、" : ""
}重要なポイントを抽出して要約してください。

コンテンツ:
"""
${content}
"""

${
  isTech
    ? "技術的な概念、プログラミング言語、フレームワーク、ツール、手法などの専門的な情報を保持してください。"
    : "一般的な内容を簡潔に伝えてください。"
}

要約の長さ: 約${length}文字
`;
};

/**
 * テキストコンテンツを要約する
 * @param content 要約対象のテキスト
 * @param category コンテンツのカテゴリ
 * @returns 要約結果
 */
export const summarizeContent = async (
  content: string,
  category: ContentCategory
): Promise<string> => {
  try {
    // コンテンツが空の場合は空の要約を返す
    if (!content || content.trim().length === 0) {
      return "コンテンツがありません。";
    }

    // コンテンツを適切な長さに切り詰める（APIの制限を考慮）
    const truncatedContent =
      content.length > 8000 ? content.substring(0, 8000) + "..." : content;

    // API呼び出しを実行（リトライ付き）
    return await retryAsync(
      async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content:
                "あなたは高品質な要約AIです。与えられたコンテンツの重要なポイントを抽出して要約します。",
            },
            {
              role: "user",
              content: createSummarizationPrompt(truncatedContent, category),
            },
          ],
          temperature: 0.3, // 低めの温度で一貫性を高める
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
          `コンテンツ要約のAPI呼び出しに失敗しました (リトライ ${attempt}/2)`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    );
  } catch (error) {
    logError("コンテンツの要約に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // エラー時は元のコンテンツの先頭部分を返す
    const fallbackSummary =
      content.length > 200
        ? content.substring(0, 200) + "... (要約生成に失敗しました)"
        : content;
    return fallbackSummary;
  }
};

/**
 * ツイートデータとスクレイピング結果を要約
 * @param tweet ツイートデータ
 * @param category コンテンツのカテゴリ
 * @param scrapedContent スクレイピング結果（任意）
 * @returns 要約されたコンテンツ
 */
export const summarizeTweet = async (
  tweet: TweetData,
  category: ContentCategory,
  scrapedContent?: ScrapedContent
): Promise<SummarizedContent> => {
  let contentToSummarize = tweet.content;

  // スクレイピング結果がある場合は、それも考慮
  if (scrapedContent && scrapedContent.content) {
    // タイトルとコンテンツを組み合わせる
    const title = scrapedContent.title
      ? `タイトル: ${scrapedContent.title}\n\n`
      : "";
    // サイト名があれば追加
    const siteName = scrapedContent.siteName
      ? `サイト: ${scrapedContent.siteName}\n`
      : "";

    contentToSummarize = `${tweet.content}\n\n${title}${siteName}${scrapedContent.content}`;

    logInfo(
      `ツイートとスクレイピング結果を組み合わせて要約します: ${tweet.tweetLink}`
    );
  } else {
    logInfo(`ツイート本文のみを要約します: ${tweet.tweetLink}`);
  }

  const summary = await summarizeContent(contentToSummarize, category);

  return {
    original: tweet,
    summary,
    category,
  };
};

export default {
  summarizeContent,
  summarizeTweet,
};
