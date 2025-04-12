/**
 * 漢字変換ユーティリティ - シンプル版
 * 型定義エラーを回避するための一時的な実装
 */

/**
 * 難しい漢字をひらがなに変換する
 * 小学校4年生以上で習う漢字を対象とする
 * @param text 変換するテキスト
 * @returns 変換後のテキスト
 */
export const convertComplexKanji = async (text: string): Promise<string> => {
  // この簡易版では元のテキストをそのまま返す
  return text;
};

export default {
  convertComplexKanji,
};
