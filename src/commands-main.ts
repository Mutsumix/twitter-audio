/**
 * commands.ts用のメイン関数
 * main.tsから切り離された処理
 */
import path from "path";
import fs from "fs";
import { config } from "./config";
import {
  ContentCategory,
  TechSubCategory,
  OtherSubCategory,
} from "./config/constants";
import { TweetData, SummarizedContent, GroupedContents } from "./types";
import prisma from "./db";
import { fetchRecentTweets } from "./services/sheets";
import { scrapeUrl } from "./services/scraper";
import {
  classifyTweet,
  classifyTweetWithSubCategory,
} from "./services/classifier";
import { summarizeTweet } from "./services/summarizer";
import { createPodcastScript } from "./services/converter";
import { textToSpeech } from "./services/tts";
import { saveTweet, savePodcastEpisode, markTweetAsProcessed } from "./db";
import { logInfo, logError } from "./utils/logger";
import { formatDateTimeJP } from "./utils/date";

/**
 * Twitterお気に入りPodcast生成の全処理
 * index.tsのmain関数と同じロジックだが、インポート問題を解決するため別ファイルに分離
 */
export async function processAll(options?: { maxTweets?: number }) {
  try {
    logInfo("Twitterお気に入りPodcast生成を開始します");

    // 1. スプレッドシートからツイートデータを取得（引数は使わず、設定値を使用）
    const tweets = await fetchRecentTweets();
    if (tweets.length === 0) {
      logInfo("処理対象のツイートがありませんでした");
      return;
    }

    logInfo(`${tweets.length}件のツイートを処理します`);

    // 2. ツイートごとに処理
    const processedContents: SummarizedContent[] = [];

    for (const tweet of tweets) {
      try {
        // 2.1 リンク先をスクレイピング
        let scrapedContent = undefined;
        if (tweet.contentLink) {
          logInfo(`リンク先のスクレイピングを行います: ${tweet.contentLink}`);
          scrapedContent = await scrapeUrl(tweet.contentLink);
        }

        // 2.2 コンテンツを分類（メインカテゴリとサブカテゴリ）
        logInfo(`コンテンツの分類を行います: ${tweet.tweetLink}`);
        const { category, subCategory } = await classifyTweetWithSubCategory(
          tweet,
          scrapedContent
        );

        // 分類結果をDBに保存
        await saveTweet({
          tweetDate: tweet.tweetDate,
          account: tweet.account,
          tweetLink: tweet.tweetLink,
          contentLink: tweet.contentLink,
          content: tweet.content,
          category: category,
          // サブカテゴリはDBスキーマに追加されていないため保存しない
        });

        // 2.3 コンテンツを要約
        logInfo(`コンテンツの要約を行います: ${tweet.tweetLink}`);
        const summarizedContent = await summarizeTweet(
          tweet,
          category,
          scrapedContent
        );

        // サブカテゴリを追加
        summarizedContent.subCategory = subCategory;

        processedContents.push(summarizedContent);

        // 処理済みとしてマーク
        if (tweet.id) {
          await markTweetAsProcessed(tweet.id);
        }
      } catch (error) {
        logError(`ツイート処理中にエラーが発生しました: ${tweet.tweetLink}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // コンテンツをグループ化する関数
    function groupContentsByCategory(
      contents: SummarizedContent[]
    ): GroupedContents {
      const result: GroupedContents = {
        tech: {},
        other: {},
      };

      // 技術系とその他に分ける
      const techContents = contents.filter(
        (content) => content.category === ContentCategory.TECH
      );
      const otherContents = contents.filter(
        (content) => content.category === ContentCategory.OTHER
      );

      // 技術系をサブカテゴリでグループ化
      techContents.forEach((content) => {
        const subCat = content.subCategory || TechSubCategory.OTHER_TECH;
        if (!result.tech[subCat]) {
          result.tech[subCat] = [];
        }
        result.tech[subCat].push(content);
      });

      // その他をサブカテゴリでグループ化
      otherContents.forEach((content) => {
        const subCat = content.subCategory || OtherSubCategory.OTHER_GENERAL;
        if (!result.other[subCat]) {
          result.other[subCat] = [];
        }
        result.other[subCat].push(content);
      });

      // 各サブカテゴリのコンテンツ数をログ出力
      Object.entries(result.tech).forEach(([subCat, contents]) => {
        logInfo(`技術系/${subCat}: ${contents.length}件`);
      });

      Object.entries(result.other).forEach(([subCat, contents]) => {
        logInfo(`その他/${subCat}: ${contents.length}件`);
      });

      return result;
    }

    // コンテンツをグループ化
    const groupedContents = groupContentsByCategory(processedContents);

    // 技術系と一般のコンテンツ数を計算
    const techCount = Object.values(groupedContents.tech).reduce(
      (sum, contents) => sum + contents.length,
      0
    );
    const otherCount = Object.values(groupedContents.other).reduce(
      (sum, contents) => sum + contents.length,
      0
    );

    logInfo(`分類結果: 技術系=${techCount}件, その他=${otherCount}件`);

    // 3. 会話形式に変換
    logInfo("会話形式への変換を開始します");
    const script = await createPodcastScript(groupedContents);

    // 4. 原稿をテキストファイルに保存
    const timestampFormatted = formatDateTimeJP().replace(/[\/\s:]/g, "_");
    const outputFileName = `podcast_${timestampFormatted}.mp3`;
    const scriptFileName = `podcast_script_${timestampFormatted}.txt`;

    const outputPath = path.join(config.paths.outputDir, outputFileName);
    const scriptPath = path.join(config.paths.outputDir, scriptFileName);

    // 原稿をファイルに保存
    try {
      fs.writeFileSync(scriptPath, script);
      logInfo(`原稿をファイルに保存しました: ${scriptPath}`);
    } catch (error) {
      logError(
        `原稿の保存に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // 5. 音声合成
    logInfo("テキストの音声合成を開始します");
    const { filePath, duration } = await textToSpeech(script, {
      outputPath,
      voiceId: "8EkOjt4xTPGMclNlh1pk", // Morioki（日本人女性）音声IDを明示的に指定
    });

    // 5. Podcastエピソード情報を保存
    logInfo("Podcastエピソード情報をデータベースに保存します");
    const tweetIds = processedContents
      .map((content) => content.original.id)
      .filter(Boolean);

    await savePodcastEpisode({
      title: `お気に入りPodcast ${formatDateTimeJP()}`,
      fileLocation: filePath,
      duration,
      tweets: JSON.stringify(tweetIds),
    });

    logInfo(
      `Podcast生成が完了しました: ${filePath} (${Math.round(duration)}秒)`
    );
    return { filePath, duration };
  } catch (error) {
    logError("Podcast生成中にエラーが発生しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    // プリズマを切断
    await prisma.$disconnect();
  }
}
