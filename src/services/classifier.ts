/**
 * テキスト分類モジュール
 * コンテンツを「技術系」と「それ以外」に分類し、さらにサブカテゴリに分類
 */
import OpenAI from "openai";
import {
  ContentCategory,
  TechSubCategory,
  OtherSubCategory,
  SubCategoryNames,
} from "../config/constants";
import {
  ClassificationResult,
  SubCategoryClassificationResult,
  FullClassificationResult,
  TweetData,
  ScrapedContent,
} from "../types";
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
/**
 * コンテンツのサブカテゴリ分類プロンプト
 */
const createSubCategoryPrompt = (
  content: string,
  mainCategory: ContentCategory
): string => {
  const isTech = mainCategory === ContentCategory.TECH;
  const categories = isTech
    ? Object.values(TechSubCategory).join(", ")
    : Object.values(OtherSubCategory).join(", ");

  return `
以下のコンテンツのサブカテゴリを判断してください。
このコンテンツは${isTech ? "技術系" : "一般"}カテゴリに分類されています。

コンテンツ:
"""
${content}
"""

以下のサブカテゴリから最も適切なものを1つ選んでください:
${categories}

${
  isTech
    ? `
PROGRAMMING_LANGUAGE: プログラミング言語に関する内容（JavaScript, Python, Rustなど）
FRAMEWORK: フレームワークに関する内容（React, Vue, Laravel, Djangoなど）
AI_ML: AI・機械学習に関する内容（ChatGPT, 機械学習モデル, LLMなど）
TOOLS: 開発ツールに関する内容（Git, Docker, VSCode, CI/CDなど）
WEB_DEV: Web開発全般に関する内容（HTML, CSS, フロントエンド, バックエンドなど）
OTHER_TECH: その他の技術トピック（上記に当てはまらない技術的な内容）
`
    : `
NEWS: ニュース・時事問題に関する内容
ENTERTAINMENT: エンターテイメント（映画, 音楽, ゲームなど）に関する内容
LIFESTYLE: ライフスタイル（健康, 食事, 仕事など）に関する内容
HOBBY: 趣味（旅行, 読書, スポーツなど）に関する内容
OTHER_GENERAL: その他の一般的な話題
`
}

回答形式: { "subCategory": "選択したサブカテゴリ", "confidence": 0-1の数値, "reasoning": "理由の説明" }
`;
};

/**
 * コンテンツのサブカテゴリを分類する
 * @param content 分類対象のテキスト
 * @param mainCategory メインカテゴリ
 * @returns サブカテゴリ分類結果
 */
export const classifySubCategory = async (
  content: string,
  mainCategory: ContentCategory
): Promise<SubCategoryClassificationResult> => {
  try {
    // コンテンツが空の場合はその他に分類
    if (!content || content.trim().length === 0) {
      return {
        subCategory:
          mainCategory === ContentCategory.TECH
            ? TechSubCategory.OTHER_TECH
            : OtherSubCategory.OTHER_GENERAL,
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
                "あなたはテキスト分類AIです。コンテンツのサブカテゴリを判別します。",
            },
            {
              role: "user",
              content: createSubCategoryPrompt(truncatedContent, mainCategory),
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
          // 応答テキストからJSON部分を抽出
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("JSON形式の応答が見つかりません");
          }

          const result = JSON.parse(jsonMatch[0]);
          return {
            subCategory: result.subCategory,
            confidence: parseFloat(result.confidence) || 0.5,
            reasoning: result.reasoning,
          };
        } catch (parseError) {
          // JSONパースに失敗した場合はデフォルト値を返す
          logError("サブカテゴリ分類結果のパースに失敗しました", {
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
            response,
          });

          return {
            subCategory:
              mainCategory === ContentCategory.TECH
                ? TechSubCategory.OTHER_TECH
                : OtherSubCategory.OTHER_GENERAL,
            confidence: 0.5,
            reasoning: "レスポンスのパースに失敗しました",
          };
        }
      },
      2, // 最大2回リトライ
      1000, // 1秒間隔
      (error, attempt) => {
        logError(
          `サブカテゴリ分類のAPI呼び出しに失敗しました (リトライ ${attempt}/2)`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    );
  } catch (error) {
    logError("サブカテゴリの分類に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // エラー時はデフォルト値を返す
    return {
      subCategory:
        mainCategory === ContentCategory.TECH
          ? TechSubCategory.OTHER_TECH
          : OtherSubCategory.OTHER_GENERAL,
      confidence: 0.5,
      reasoning: "エラーが発生したため、デフォルトのサブカテゴリを使用します",
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

/**
 * ツイートとスクレイピング結果を組み合わせて分類（メインカテゴリとサブカテゴリ）
 * @param tweet ツイートデータ
 * @param scrapedContent スクレイピング結果（任意）
 * @returns 完全な分類結果
 */
export const classifyTweetWithSubCategory = async (
  tweet: TweetData,
  scrapedContent?: ScrapedContent
): Promise<FullClassificationResult> => {
  // メインカテゴリの分類
  const classificationResult = await classifyTweet(tweet, scrapedContent);

  // コンテンツを準備
  let contentToClassify = tweet.content;
  if (scrapedContent && scrapedContent.content) {
    const title = scrapedContent.title
      ? `タイトル: ${scrapedContent.title}\n`
      : "";
    const content =
      scrapedContent.content.length > 1000
        ? scrapedContent.content.substring(0, 1000) + "..."
        : scrapedContent.content;

    contentToClassify = `${tweet.content}\n\n${title}${content}`;
  }

  // サブカテゴリの分類
  const subCategoryResult = await classifySubCategory(
    contentToClassify,
    classificationResult.category
  );

  logInfo(
    `コンテンツを分類しました: ${classificationResult.category}/${subCategoryResult.subCategory}`
  );

  return {
    category: classificationResult.category,
    subCategory: subCategoryResult.subCategory,
  };
};

export default {
  classifyContent,
  classifyTweet,
  classifySubCategory,
  classifyTweetWithSubCategory,
};
