/**
 * Googleスプレッドシート連携モジュール
 * IFTTTで連携されたツイートデータを取得
 */
import { google } from "googleapis";
import { config } from "../config";
import { SHEET_SETTINGS } from "../config/constants";
import { parseDate } from "../utils/date";
import { logError, logInfo } from "../utils/logger";
import { retryAsync } from "../utils/error-handler";
import { SpreadsheetRow, TweetData } from "../types";
import { saveTweet } from "../db";

/**
 * Google SheetsのAPIクライアントを初期化
 */
const initSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    apiKey: config.googleSheets.apiKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
};

/**
 * スプレッドシートから過去1週間分のデータを取得
 */
export const fetchRecentTweets = async (): Promise<TweetData[]> => {
  try {
    const sheets = initSheetsClient();
    const spreadsheetId = config.googleSheets.spreadsheetId;
    const range = SHEET_SETTINGS.RANGE;

    // スプレッドシートからデータを取得
    const response = await retryAsync(
      async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
      },
      3,
      1000,
      (error, attempt) => {
        logError(
          `Google Sheets API呼び出しに失敗しました (リトライ ${attempt}/3)`,
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    );

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      logInfo("スプレッドシートにデータがありませんでした");
      return [];
    }

    // ヘッダー行をスキップ（存在する場合）
    const dataRows = rows[0][0] === "Date" ? rows.slice(1) : rows;

    // 日付範囲を設定
    const { startDate, endDate } = config.date.getDateRange();
    logInfo(
      `${startDate.toISOString()} から ${endDate.toISOString()} までのデータを取得します`
    );

    // 過去1週間分のデータをフィルタリングして変換
    const tweets: TweetData[] = [];
    for (const row of dataRows) {
      if (row.length >= 5) {
        try {
          const date = parseDate(row[SHEET_SETTINGS.DATE_COL_INDEX]);

          // 日付が範囲内の場合のみ処理
          if (date >= startDate && date <= endDate) {
            const tweetData: TweetData = {
              tweetDate: date,
              account: row[SHEET_SETTINGS.ACCOUNT_COL_INDEX],
              contentLink: row[SHEET_SETTINGS.CONTENT_LINK_COL_INDEX] || null,
              tweetLink: row[SHEET_SETTINGS.TWEET_LINK_COL_INDEX],
              content: row[SHEET_SETTINGS.CONTENT_COL_INDEX],
            };
            tweets.push(tweetData);

            // データベースに保存
            await saveTweet({
              tweetDate: tweetData.tweetDate,
              account: tweetData.account,
              tweetLink: tweetData.tweetLink,
              contentLink: tweetData.contentLink,
              content: tweetData.content,
              category: "", // カテゴリは後で分類処理で設定
            });
          }
        } catch (error) {
          logError("ツイートデータの解析中にエラーが発生しました", {
            error: error instanceof Error ? error.message : String(error),
            row,
          });
        }
      }
    }

    logInfo(`${tweets.length}件のツイートデータを取得しました`);
    return tweets;
  } catch (error) {
    logError("スプレッドシートからのデータ取得に失敗しました", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export default {
  fetchRecentTweets,
};
