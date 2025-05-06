/**
 * Webスクレイピングモジュール
 * ツイート内のリンクからWebページの内容を取得
 */
import puppeteer from "puppeteer";
// ESMインポートではなくCommonJSスタイルでcheerioをインポート
const cheerio = require("cheerio");
import { logError, logInfo } from "../utils/logger";
import { ScrapedContent } from "../types";
import { config } from "../config";
import { retryAsync } from "../utils/error-handler";

/**
 * コンテンツがエラーメッセージかどうかを判定する
 * @param content スクレイピングしたコンテンツ
 * @returns エラーメッセージならtrue、そうでなければfalse
 */
function isErrorMessage(content: string): boolean {
  // エラーメッセージのパターン
  const errorPatterns = [
    "特定のブラウザをサポートしていない",
    "サポート対象のブラウザに切り替える",
    "X Corpの運営するウェブサイトx.com",
    "ブラウザが現在サポートされていません",
    "このブラウザはサポートされていません",
  ];

  // いずれかのパターンが含まれていればエラーメッセージと判断
  return errorPatterns.some((pattern) => content.includes(pattern));
}

/**
 * HTMLからコンテンツを抽出する
 * @param $ cheerioオブジェクト
 * @param title ページタイトル（コンテンツが見つからない場合のフォールバック）
 * @returns 抽出したコンテンツ
 */
function extractContent($: any, title: string): string {
  // 記事コンテンツを取得（一般的な記事コンテナを対象）
  let content = "";
  const contentSelectors = [
    "article",
    ".article",
    ".post-content",
    ".entry-content",
    "main",
    "#main",
    ".main-content",
    ".content",
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      // HTML要素を除去してテキストのみ取得
      content = element.text().trim().replace(/\s+/g, " ");
      break;
    }
  }

  // コンテンツが見つからない場合は本文全体を使用
  if (!content) {
    // 不要な要素を削除
    $("header, nav, footer, script, style, noscript, iframe, form").remove();
    content = $("body").text().trim().replace(/\s+/g, " ");
  }

  // 空の場合は仕方なくタイトルだけを使用
  if (!content) {
    content = title;
  }

  return content;
}

/**
 * URLからWebページの内容を取得する
 * @param url スクレイピング対象のURL
 * @returns コンテンツ情報
 */
export const scrapeUrl = async (url: string): Promise<ScrapedContent> => {
  logInfo(`URLのスクレイピングを開始: ${url}`);

  try {
    // 存在しないURLやアクセスできないURLの場合はエラー
    if (!url || !url.startsWith("http")) {
      return {
        url,
        content: "",
        error: "無効なURLです",
      };
    }

    // Puppeteerを使用してJavaScriptが必要なサイトに対応
    return await retryAsync(
      async () => {
        // Puppeteerブラウザの起動
        logInfo(`Puppeteerでスクレイピング開始: ${url}`);
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        try {
          const page = await browser.newPage();

          // タイムアウト設定
          await page.setDefaultNavigationTimeout(30000);

          // ページにアクセス
          logInfo(`ページに接続中: ${url}`);
          await page.goto(url, { waitUntil: "networkidle2" });

          // HTML取得
          logInfo("HTMLコンテンツを取得中...");
          const html = await page.content();

          // HTMLが取得できたか確認
          if (!html) {
            throw new Error("HTMLコンテンツが取得できませんでした");
          }

          logInfo(`HTMLコンテンツ取得完了: ${html.length}文字`);

          // cheerioを使ってHTMLをパース
          try {
            const $ = cheerio.load(html);

            // タイトル取得
            const title = $("title").text().trim();
            logInfo(`タイトル: ${title}`);

            // サイト名取得（OGPから）
            const siteName =
              $('meta[property="og:site_name"]').attr("content") || "";

            // 公開日取得（metaタグから）
            const publishDate =
              $('meta[property="article:published_time"]').attr("content") ||
              $('meta[name="pubdate"]').attr("content") ||
              $('meta[name="publishdate"]').attr("content") ||
              $('meta[name="date"]').attr("content") ||
              "";

            // 本文抽出
            const content = extractContent($, title);

            // エラーメッセージのチェック
            if (isErrorMessage(content)) {
              logInfo(`エラーメッセージが検出されました: ${url}`);
              return {
                url,
                title,
                content: "", // エラーメッセージの場合は空文字を返す
                siteName,
                publishDate,
                error: "ブラウザ非対応エラーが検出されました",
              };
            }

            logInfo(`コンテンツ抽出完了: ${content.length}文字`);

            return {
              url,
              title,
              content,
              siteName,
              publishDate,
            };
          } catch (cheerioError) {
            logError("cheerioでのHTMLパース中にエラーが発生しました", {
              error:
                cheerioError instanceof Error
                  ? cheerioError.message
                  : String(cheerioError),
            });

            // cheerioでのパースに失敗した場合、単純なテキスト抽出で対応
            const title = await page.title();
            const content = await page.evaluate(() => document.body.innerText);

            return {
              url,
              title,
              content: content || "",
              siteName: "",
              publishDate: "",
            };
          }
        } catch (error) {
          logError(`スクレイピング処理でエラー発生`, {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          // 必ずブラウザを閉じる
          await browser.close();
          logInfo("ブラウザを閉じました");
        }
      },
      2,
      2000,
      (error, attempt) => {
        logError(
          `スクレイピング中にエラーが発生しました (リトライ ${attempt}/2)`,
          {
            url,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    );
  } catch (error) {
    logError("スクレイピングに失敗しました", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      url,
      content: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * 複数のURLを並行してスクレイピング
 * @param urls スクレイピング対象のURL配列
 * @returns スクレイピング結果の配列
 */
export const scrapeMultipleUrls = async (
  urls: string[]
): Promise<ScrapedContent[]> => {
  // 重複URLの削除
  const uniqueUrls = [...new Set(urls)];
  logInfo(`${uniqueUrls.length}件のURLのスクレイピングを開始します`);

  // 並行実行（最大5並列）
  const results: ScrapedContent[] = [];
  const batchSize = 5;

  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((url) => scrapeUrl(url)));
    results.push(...batchResults);
  }

  logInfo(`${results.length}件のURLのスクレイピングが完了しました`);
  return results;
};

export default {
  scrapeUrl,
  scrapeMultipleUrls,
};
