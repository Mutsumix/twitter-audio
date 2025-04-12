/**
 * データベース接続
 * Prismaクライアントのエクスポート
 */
import { PrismaClient } from "@prisma/client";

// Prismaクライアントのシングルトンインスタンス
const prisma = new PrismaClient();

export default prisma;

/**
 * 処理済みツイートの保存
 */
export const saveTweet = async (data: {
  tweetDate: Date;
  account: string;
  tweetLink: string;
  contentLink?: string | null;
  content: string;
  category: string;
}) => {
  return prisma.processedTweet.upsert({
    where: { tweetLink: data.tweetLink },
    update: {
      category: data.category,
      content: data.content,
    },
    create: {
      tweetDate: data.tweetDate,
      account: data.account,
      tweetLink: data.tweetLink,
      contentLink: data.contentLink,
      content: data.content,
      category: data.category,
    },
  });
};

/**
 * Podcastエピソードの保存
 */
export const savePodcastEpisode = async (data: {
  title: string;
  fileLocation: string;
  duration: number;
  tweets: string;
}) => {
  return prisma.podcastEpisode.create({
    data,
  });
};

/**
 * ログエントリの保存
 */
export const saveLogEntry = async (data: {
  level: string;
  message: string;
  details?: string | null;
}) => {
  return prisma.systemLog.create({
    data,
  });
};

/**
 * 過去1週間の間に処理されていないツイートを取得
 */
export const getUnprocessedTweets = async (startDate: Date, endDate: Date) => {
  return prisma.processedTweet.findMany({
    where: {
      tweetDate: {
        gte: startDate,
        lte: endDate,
      },
      processed: false,
    },
    orderBy: {
      tweetDate: "asc",
    },
  });
};

/**
 * ツイートを処理済みとしてマーク
 */
export const markTweetAsProcessed = async (tweetId: number) => {
  return prisma.processedTweet.update({
    where: { id: tweetId },
    data: { processed: true },
  });
};
