/**
 * Webスクレイピングモジュール
 * ツイート内のリンクからWebページの内容を取得
 */
import puppeteer from "puppeteer";
import cheerio from "cheerio";
import { logError, logInfo } from "../utils/logger";
import { ScrapedContent } from "../types";
import { retryAsync } from "../utils/error-handler";

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
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        try {
          const page = await browser.newPage();

          // タイムアウト設定
          await page.setDefaultNavigationTimeout(30000);

          // ページにアクセス
          await page.goto(url, { waitUntil: "networkidle2" });

          // HTML取得
          const html = await page.content();
          const $ = cheerio.load(html);

          // タイトル取得
          const title = $("title").text().trim();

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
            $(
              "header, nav, footer, script, style, noscript, iframe, form"
            ).remove();
            content = $("body").text().trim().replace(/\s+/g, " ");
          }

          // 空の場合は仕方なくタイトルだけを使用
          if (!content) {
            content = title;
          }

          await browser.close();

          return {
            url,
            title,
            content,
            siteName,
            publishDate,
          };
        } catch (error) {
          await browser.close();
          throw error;
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
