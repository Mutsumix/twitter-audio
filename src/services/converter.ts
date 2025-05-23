/**
 * 会話形式変換モジュール
 * 要約したコンテンツを自然な会話形式に変換
 */
import OpenAI from "openai";
import {
  ContentCategory,
  TechSubCategory,
  OtherSubCategory,
  SubCategoryNames,
} from "../config/constants";
import {
  SummarizedContent,
  ConversationalContent,
  GroupedContents,
} from "../types";
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
個人名や企業名、サービス名を明確に言及し、具体的な情報を提供してください。

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
挨拶は最初と最後のみにし、途中での不自然な挨拶を避けてください。
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
 * 生成されたテキストから不要な表現を削除する後処理
 * @param text 処理するテキスト
 * @returns 処理後のテキスト
 */
function postProcessText(text: string): string {
  // 「こんにちは」などの挨拶表現を削除
  let processed = text.replace(/こんにちは[、。].+?(?=\n|$)/g, "");

  // 「今日は」で始まる文を修正
  processed = processed.replace(/今日は([^。]+)(?=\n|$)/g, "$1");

  // 「最後に」などの結びの表現を削除または修正
  processed = processed.replace(/最後に、?/g, "また、");
  processed = processed.replace(/以上が.+?(?=\n|$)/g, "");
  processed = processed.replace(/今回(は|の).+?(?=\n|$)/g, "");
  processed = processed.replace(/まとめると.+?(?=\n|$)/g, "");

  // 段落の先頭の「さて、」「では、」などの接続詞を削除
  processed = processed.replace(/^(さて、|では、|それでは、)/gm, "");

  // 連続する改行を最大2つに制限
  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed;
}

/**
 * 複数の要約コンテンツをまとめて会話形式に変換
 * サブカテゴリごとにグループ化されたコンテンツを処理
 * @param groupedContents グループ化されたコンテンツ
 * @returns 会話形式に変換されたコンテンツ
 */
export const createPodcastScript = async (
  groupedContents: GroupedContents
): Promise<string> => {
  logInfo("会話形式への変換を開始します - グループ処理方式");

  // 技術系コンテンツの処理
  let techScript = "";
  let techCount = 0;

  // サブカテゴリごとのコンテンツ数を計算
  const techSubCategoryCounts: Record<string, number> = {};
  Object.entries(groupedContents.tech).forEach(([subCat, contents]) => {
    techSubCategoryCounts[subCat] = contents.length;
    techCount += contents.length;
  });

  // コンテンツ数順にソート
  const sortedTechSubCategories = Object.entries(techSubCategoryCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([subCat]) => subCat);

  // 各サブカテゴリを処理
  for (const subCat of sortedTechSubCategories) {
    const contents = groupedContents.tech[subCat];

    // コンテンツが少ない場合（例：2件以下）はスキップして後でまとめる
    if (contents.length <= 2 && sortedTechSubCategories.length > 1) {
      continue;
    }

    try {
      const subCatName =
        SubCategoryNames[subCat as keyof typeof SubCategoryNames] ||
        "その他技術トピック";
      const sectionIntro = `\n## ${subCatName}に関する話題\n\n`;
      const sectionContent = await generateCombinedSection(
        contents,
        subCatName
      );

      // 後処理を適用
      const processedContent = postProcessText(sectionContent);
      techScript += sectionIntro + processedContent + "\n\n";
    } catch (error) {
      logError(`${subCat}カテゴリの処理に失敗しました`, {
        error: error instanceof Error ? error.message : String(error),
        count: contents.length,
      });
    }
  }

  // コンテンツが少ないサブカテゴリをまとめて処理
  const smallTechCategories = sortedTechSubCategories.filter(
    (subCat) =>
      groupedContents.tech[subCat].length <= 2 &&
      sortedTechSubCategories.length > 1
  );

  if (smallTechCategories.length > 0) {
    const combinedContents: SummarizedContent[] = [];
    smallTechCategories.forEach((subCat) => {
      combinedContents.push(...groupedContents.tech[subCat]);
    });

    if (combinedContents.length > 0) {
      try {
        const sectionIntro = "\n## その他の技術トピック\n\n";
        const sectionContent = await generateCombinedSection(
          combinedContents,
          "その他技術トピック"
        );

        // 後処理を適用
        const processedContent = postProcessText(sectionContent);
        techScript += sectionIntro + processedContent + "\n\n";
      } catch (error) {
        logError("その他技術トピックの処理に失敗しました", {
          error: error instanceof Error ? error.message : String(error),
          count: combinedContents.length,
        });
      }
    }
  }

  // 一般コンテンツの処理（技術系と同様の処理）
  let otherScript = "";
  let otherCount = 0;

  // サブカテゴリごとのコンテンツ数を計算
  const otherSubCategoryCounts: Record<string, number> = {};
  Object.entries(groupedContents.other).forEach(([subCat, contents]) => {
    otherSubCategoryCounts[subCat] = contents.length;
    otherCount += contents.length;
  });

  // コンテンツ数順にソート
  const sortedOtherSubCategories = Object.entries(otherSubCategoryCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([subCat]) => subCat);

  // 各サブカテゴリを処理
  for (const subCat of sortedOtherSubCategories) {
    const contents = groupedContents.other[subCat];

    // コンテンツが少ない場合（例：2件以下）はスキップして後でまとめる
    if (contents.length <= 2 && sortedOtherSubCategories.length > 1) {
      continue;
    }

    try {
      const subCatName =
        SubCategoryNames[subCat as keyof typeof SubCategoryNames] ||
        "その他の話題";
      const sectionIntro = `\n## ${subCatName}\n\n`;
      const sectionContent = await generateCombinedSection(
        contents,
        subCatName
      );

      // 後処理を適用
      const processedContent = postProcessText(sectionContent);
      otherScript += sectionIntro + processedContent + "\n\n";
    } catch (error) {
      logError(`${subCat}カテゴリの処理に失敗しました`, {
        error: error instanceof Error ? error.message : String(error),
        count: contents.length,
      });
    }
  }

  // コンテンツが少ないサブカテゴリをまとめて処理
  const smallOtherCategories = sortedOtherSubCategories.filter(
    (subCat) =>
      groupedContents.other[subCat].length <= 2 &&
      sortedOtherSubCategories.length > 1
  );

  if (smallOtherCategories.length > 0) {
    const combinedContents: SummarizedContent[] = [];
    smallOtherCategories.forEach((subCat) => {
      combinedContents.push(...groupedContents.other[subCat]);
    });

    if (combinedContents.length > 0) {
      try {
        const sectionIntro = "\n## その他の話題\n\n";
        const sectionContent = await generateCombinedSection(
          combinedContents,
          "その他の話題"
        );

        // 後処理を適用
        const processedContent = postProcessText(sectionContent);
        otherScript += sectionIntro + processedContent + "\n\n";
      } catch (error) {
        logError("その他の話題の処理に失敗しました", {
          error: error instanceof Error ? error.message : String(error),
          count: combinedContents.length,
        });
      }
    }
  }

  try {
    // 固定オープニング
    const openingScript = `はい！ムツミックスの最初はグッド トゥー ミイ！

この番組はいけぶくろにせいそくするエンジニア、ムツミックスがツイッターで今週お気に入りをつけたツイートを、AIがかってにまとめて分析して紹介するというポッドキャスト番組です。
これを読み上げている私もAIです。
こんな時代ですが、最後までお聞きいただけるとハッピーです。まあ私AIなんで感情ありませんけど。
それでは早速紹介していきます。\n\n`;

    // 技術系コンテンツ
    const techSection =
      techCount > 0
        ? `今週の技術系の話題は${techCount}件ありました。\n\n${techScript}\n\n`
        : "";

    // その他コンテンツ
    const otherSection =
      otherCount > 0
        ? `続いて、その他の話題を${otherCount}件紹介します。\n\n${otherScript}\n\n`
        : "";

    // 統計情報と傾向のまとめを生成
    // 全てのコンテンツを配列に変換
    const allTechContents = Object.values(groupedContents.tech).flat();
    const allOtherContents = Object.values(groupedContents.other).flat();

    const summarySection = await generateStatisticalSummary(
      allTechContents,
      allOtherContents
    );

    // 固定エンディング
    const conclusion = `ムツミックスの最初はグッド トゥウ ミイ！、今週は以上です。
いかがでしたでしょうか。まあ、私AIなんであなたがどう思おうとどうだっていいんですけど。
それではまた来週お耳にかかりましょう。バイちゃ！`;

    // 全体を組み合わせる
    return (
      openingScript + techSection + otherSection + summarySection + conclusion
    );
  } catch (error) {
    logError("ポッドキャストスクリプト生成中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // 最低限のフォールバックスクリプトを返す
    return `こんにちは、今回は${formatDateTimeJP(
      new Date()
    )}に録音した週間お気に入りポッドキャストをお届けします。
    今週は技術系の話題が${techCount}件、その他の話題が${otherCount}件ありました。
    処理中にエラーが発生したため、詳細な内容をお届けできません。申し訳ありません。`;
  }
};

/**
 * 同じカテゴリの複数コンテンツをまとめて効率的に処理
 * @param contents 同じカテゴリのコンテンツ配列
 * @param categoryName カテゴリの名前（ログ用）
 * @returns 生成された会話スクリプト
 */
async function generateCombinedSection(
  contents: SummarizedContent[],
  categoryName: string
): Promise<string> {
  logInfo(`${categoryName}コンテンツ(${contents.length}件)の一括処理を開始`);

  // 長さによってグループ分け
  const chunks = splitContentsIntoChunks(contents);
  logInfo(`${chunks.length}個のチャンクに分割しました`);

  const results: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    logInfo(
      `チャンク${i + 1}/${chunks.length}を処理中 (${
        chunk.length
      }件のコンテンツ)`
    );

    try {
      // OpenAI APIを呼び出してコンテンツをまとめる
      const result = await processContentChunk(chunk, categoryName, i === 0);
      results.push(result);
    } catch (error) {
      logError(`チャンク${i + 1}の処理に失敗`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // 失敗時は簡単なフォールバックメッセージを追加
      results.push(`このセクションのコンテンツは処理できませんでした。`);
    }
  }

  return results.join("\n\n");
}

/**
 * コンテンツを適切なサイズのチャンクに分割
 * APIのコンテキスト制限に収まるようにする
 */
function splitContentsIntoChunks(
  contents: SummarizedContent[]
): SummarizedContent[][] {
  // 単純に5つずつくらいのチャンクに分ける
  // 実際の実装ではコンテンツの長さに基づいて調整すべき
  const chunkSize = 5;
  const chunks: SummarizedContent[][] = [];

  for (let i = 0; i < contents.length; i += chunkSize) {
    chunks.push(contents.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * コンテンツのチャンクをOpenAI APIで処理
 * @param contents 処理するコンテンツのチャンク
 * @param categoryName カテゴリ名
 * @param isFirstChunk 最初のチャンクかどうか（挨拶を含めるかの判断に使用）
 * @returns 生成されたテキスト
 */
async function processContentChunk(
  contents: SummarizedContent[],
  categoryName: string,
  isFirstChunk: boolean = false
): Promise<string> {
  // サマリーの配列を作成
  const summaries = contents
    .map((content, index) => {
      const account = content.original.account;
      const date = formatDateTimeJP(content.original.tweetDate);
      return `【${index + 1}】@${account}さんが${date}に投稿したコンテンツ:
${content.summary}
リンク: ${content.original.tweetLink}
${
  content.original.contentLink
    ? `内容リンク: ${content.original.contentLink}`
    : ""
}`;
    })
    .join("\n\n");

  // ナレーション形式のプロンプト - 会話形式ではなくシンプルなナレーションに変更
  const prompt = `
以下は${categoryName}カテゴリに分類された${contents.length}件のコンテンツです。
これらを全体的に分析し、共通するテーマ、トレンド、重要なポイントを見つけてください。
個別のコンテンツを一つずつ紹介するのではなく、全体を俯瞰した分析をもとに、
シンプルなナレーション形式のスクリプトを作成してください。

コンテンツ:
${summaries}

スクリプト作成の重要なガイドライン:
1. 「ホスト：」や「[BGM]」などの読み上げるべきでない表記は使わないでください
2. シンプルな文章形式で、読み上げるテキストだけを出力してください
3. 専門用語が出てきたら簡単な説明を加えてください
4. 特定のツイートを一つずつ説明するのではなく、テーマごとにまとめてください
5. 適度に段落に分けて、読みやすくしてください
6. 「次のツイート」「別のツイート」といった表現は避けてください
7. 「最後に」「以上の」「今日は」「今回はここまで」などの、チャンクの中で最初と最後を意識させるような言葉は絶対に使わないでください
8. 個人名や企業名、サービス名を明確に言及し、具体的な情報を提供してください

返答はシンプルなナレーション形式で、まとまりのある内容にしてください。
「ホスト：」などの表記や、読み上げない指示などは一切含めないでください。
実際に音声読み上げされるテキストのみを出力してください。
`;

  // APIリクエスト実行
  return await retryAsync(
    async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "あなたはポッドキャストのパーソナリティです。分析力があり、複数のコンテンツから重要なポイントを抽出して、まとまりのある内容にできます。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error("APIからの応答が空です");
      }

      return response.trim();
    },
    2,
    1000,
    (error, attempt) => {
      logError(
        `コンテンツチャンク処理のAPI呼び出しに失敗 (リトライ ${attempt}/2)`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  );
}

/**
 * 要約コンテンツを会話形式コンテンツに変換（互換性維持用）
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

/**
 * 統計情報と傾向のまとめを生成する
 * @param techContents 技術系コンテンツの配列
 * @param otherContents その他コンテンツの配列
 * @returns 統計情報と傾向のまとめ
 */
async function generateStatisticalSummary(
  techContents: SummarizedContent[],
  otherContents: SummarizedContent[]
): Promise<string> {
  // コンテンツがない場合は空文字列を返す
  if (techContents.length === 0 && otherContents.length === 0) {
    return "";
  }

  try {
    // アカウント情報の収集
    const allAccounts = [
      ...techContents.map((c) => c.original.account),
      ...otherContents.map((c) => c.original.account),
    ];

    // 重複を除いたユニークなアカウント数
    const uniqueAccounts = new Set(allAccounts).size;

    // その他カテゴリのキーワード分析用データ作成
    const otherContentsText = otherContents.map((c) => c.summary).join("\n");

    // プロンプトの作成
    const prompt = `
以下は週間お気に入りポッドキャストのコンテンツ統計情報です：

技術系コンテンツ数: ${techContents.length}件
その他のコンテンツ数: ${otherContents.length}件
お気に入りしたアカウント数: ${uniqueAccounts}アカウント

その他カテゴリのコンテンツ要約:
${otherContentsText}

これらの情報から、統計情報のまとめと傾向分析を作成してください。
例えば「今週は技術系のツイートをXX件お気に入りし、それ以外の分野ではXX件のお気に入りをしました」といった情報と、
内容の傾向を一言でまとめた文（例：「猫や植物に関するお気に入りが多かったので、ひょっとすると癒しが必要だったのかもしれませんね」）を含めてください。

返答形式:
- 単純なテキスト形式で出力してください
- 「統計まとめ：」などのラベルや指示は含めないでください
- 2〜3段落程度の簡潔な内容にしてください
- ナレーションとして読み上げる文章のみを出力してください
    `;

    // APIリクエスト実行
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "あなたはデータ分析の専門家です。与えられた統計情報から傾向を見出し、簡潔にまとめることができます。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("APIからの応答が空です");
    }

    return `\n\n${response.trim()}\n\n`;
  } catch (error) {
    logError("統計情報のまとめ生成に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });

    // 失敗時のフォールバック
    return `\n\n今週は技術系のツイートを${techContents.length}件お気に入りし、それ以外の分野では${otherContents.length}件のお気に入りをしました。\n\n`;
  }
}

export default {
  convertToConversation,
  createPodcastScript,
  convertContent,
};
