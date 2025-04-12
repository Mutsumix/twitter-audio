/**
 * 型定義ファイル
 * サードパーティライブラリのための型定義
 */

declare module "kuroshiro" {
  export default class Kuroshiro {
    init(analyzer: any): Promise<void>;
    convert(
      text: string,
      options?: {
        mode?: "normal" | "spaced" | "okurigana" | "furigana";
        to?: "hiragana" | "katakana" | "romaji";
        delimiter_start?: string;
        delimiter_end?: string;
      }
    ): Promise<string>;
  }
}

declare module "kuroshiro-analyzer-kuromoji" {
  export default class KuromojiAnalyzer {
    constructor(options?: { dictPath?: string });
  }
}
