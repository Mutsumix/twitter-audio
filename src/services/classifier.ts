/**
 * テキスト分類モジュール
 * コンテンツを「技術系」と「それ以外」に分類
 */
import OpenAI from "openai";
import { ContentCategory } from "../config/constants";
import { ClassificationResult, TweetData, ScrapedContent } from "../types";
import { config } from "../config";
import { logError, logInfo } from "../utils/logger";
import { retryAsync } from "../utils/error-handler";

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * コンテンツの分類プロンプト
 */
const createClassificationPrompt = (content: string): string => {
  return `
以下のコンテンツが技術系かそれ以外かを判断してください。
技術系には、プログラミング、ソフトウェア開発、IT業界、コンピュータサイエンス、
ハードウェア、ネットワーク、セキュリティ、人工知能、データサイエンス、
Webサービス、モバイルアプリ、クラウド技術などが含まれます。

コンテンツ:
"""
${content}
"""

回答形式: { "category": "TECH" or "OTHER", "confidence": 0-1の数値, "reasoning": "理由の説明" }
`;
};

/**
 * テキストコンテンツを分類する
 * @param content 分類対象のテキスト
 * @returns 分類結果
 */
export const classifyContent = async (
  content: string
): Promise<ClassificationResult> => {
  try {
    // コンテンツが空の場合はその他に分類
    if (!content || content.trim().length === 0) {
      return {
        category: ContentCategory.OTHER,
        confidence: 1.0,
        reasoning: "コンテンツが空です",
      };
    }

    // コンテンツを適切な長さに切り詰める（APIの制限を考慮）
    const truncatedContent =
      content.length > 4000 ? content.substring(0, 4000) + "..." : content;

    // API呼び出しを実行（リトライ付き）
    return await retryAsync(
      async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content:
                "あなたはテキスト分類AIです。技術系コンテンツとそれ以外を判別します。",
            },
            {
              role: "user",
              content: createClassificationPrompt(truncatedContent),
            },
          ],
          temperature: 0.2, // 低い温度で一貫性を高める
        });

        const response = completion.choices[0].message.content;
        if (!response) {
          throw new Error("APIからの応答が空です");
        }

        // JSONレスポンスをパース
        try {
          // 応答テキストからJSON部分を抽出（余分なテキストがある場合に備える）
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("JSON形式の応答が見つかりません");
          }

          const result = JSON.parse(jsonMatch[0]);
          return {
            category:
              result.category === "TECH"
                ? ContentCategory.TECH
                : ContentCategory.OTHER,
            confidence: parseFloat(result.confidence) || 0.5,
            reasoning: result.reasoning,
          };
        } catch (parseError) {
          // JSONパースに失敗した場合は、TECHという文字列が含まれているか確認
          const isTech = response.includes("TECH");
          return {
            category: isTech ? ContentCategory.TECH : ContentCategory.OTHER,
            confidence: 0.6,
            reasoning: "レスポンスのパースに失敗しました: " + response,
          };
        }
      },
      2, // 最大2回リトライ
      1000, // 1秒間隔
      (error, attempt) => {
        logError(
          `コンテンツ分類のAPI呼び出しに失敗しました (リトライ ${attempt}/2)`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    );
  } catch (error) {
    logError("コンテンツの分類に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // エラー時はデフォルト値を返す
    return {
      category: ContentCategory.OTHER, // デフォルトはその他
      confidence: 0.5,
      reasoning: "エラーが発生したため、デフォルトのカテゴリを使用します",
    };
  }
};

/**
 * ツイートとスクレイピング結果を組み合わせて分類
 * @param tweet ツイートデータ
 * @param scrapedContent スクレイピング結果（任意）
 * @returns 分類結果
 */
export const classifyTweet = async (
  tweet: TweetData,
  scrapedContent?: ScrapedContent
): Promise<ClassificationResult> => {
  let contentToClassify = tweet.content;

  // スクレイピング結果がある場合は、それも考慮
  if (scrapedContent && scrapedContent.content) {
    // タイトルとコンテンツを組み合わせる（タイトルは重要な情報を含むことが多い）
    const title = scrapedContent.title
      ? `タイトル: ${scrapedContent.title}\n`
      : "";
    // スクレイピングした本文（長すぎる場合は先頭部分のみ）
    const content =
      scrapedContent.content.length > 1000
        ? scrapedContent.content.substring(0, 1000) + "..."
        : scrapedContent.content;

    contentToClassify = `${tweet.content}\n\n${title}${content}`;
  }

  return await classifyContent(contentToClassify);
};

export default {
  classifyContent,
  classifyTweet,
};
