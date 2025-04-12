/**
 * Twitterお気に入りPodcast生成アプリケーション
 * メインエントリーポイント
 */
import path from "path";
import { config } from "./config";
import { ContentCategory } from "./config/constants";
import { TweetData, SummarizedContent, PodcastEpisode } from "./types";
import prisma from "./db";
import { fetchRecentTweets } from "./services/sheets";
import { scrapeUrl } from "./services/scraper";
import { classifyTweet } from "./services/classifier";
import { summarizeTweet } from "./services/summarizer";
import { createPodcastScript } from "./services/converter";
import { textToSpeech } from "./services/tts";
import { saveTweet, savePodcastEpisode, markTweetAsProcessed } from "./db";
import { logInfo, logError } from "./utils/logger";
import { formatDateTimeJP } from "./utils/date";

// メインの処理フロー
const main = async () => {
  try {
    logInfo("Twitterお気に入りPodcast生成を開始します");

    // 1. スプレッドシートからツイートデータを取得
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

        // 2.2 コンテンツを分類（技術系かそれ以外か）
        logInfo(`コンテンツの分類を行います: ${tweet.tweetLink}`);
        const classificationResult = await classifyTweet(tweet, scrapedContent);

        // 分類結果をDBに保存
        await saveTweet({
          tweetDate: tweet.tweetDate,
          account: tweet.account,
          tweetLink: tweet.tweetLink,
          contentLink: tweet.contentLink,
          content: tweet.content,
          category: classificationResult.category,
        });

        // 2.3 コンテンツを要約
        logInfo(`コンテンツの要約を行います: ${tweet.tweetLink}`);
        const summarizedContent = await summarizeTweet(
          tweet,
          classificationResult.category,
          scrapedContent
        );

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

    // カテゴリで分類
    const techContents = processedContents.filter(
      (content) => content.category === ContentCategory.TECH
    );
    const otherContents = processedContents.filter(
      (content) => content.category === ContentCategory.OTHER
    );

    logInfo(
      `分類結果: 技術系=${techContents.length}件, その他=${otherContents.length}件`
    );

    // 3. 会話形式に変換
    logInfo("会話形式への変換を開始します");
    const script = await createPodcastScript(techContents, otherContents);

    // 4. 音声合成
    logInfo("テキストの音声合成を開始します");
    const outputFileName = `podcast_${formatDateTimeJP().replace(
      /[\/\s:]/g,
      "_"
    )}.mp3`;
    const outputPath = path.join(config.paths.outputDir, outputFileName);

    const { filePath, duration } = await textToSpeech(script, {
      outputPath,
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
};

// コマンドラインインターフェースの設定
import { runCli } from "./utils/cli";
import commands from "./commands";

// スクリプトとして直接実行された場合
if (require.main === module) {
  // コマンドライン引数がある場合はCLIモードで実行
  // 引数がない場合は対話型モードになる
  runCli(commands).catch((error) => {
    console.error("\n❌ CLIの実行中にエラーが発生しました:", error);
    process.exit(1);
  });
}

export default main;
