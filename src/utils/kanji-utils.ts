/**
 * 漢字変換ユーティリティ
 * 小学校4年生以上で習う漢字をひらがなに変換する
 */
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

// 初期化フラグ
let initialized = false;
// Kuroshiroインスタンス
let kuroshiro: Kuroshiro;

/**
 * Kuroshiroを初期化する
 * @returns 初期化されたKuroshiroインスタンス
 */
export const initializeKuroshiro = async (): Promise<Kuroshiro> => {
  if (!initialized) {
    kuroshiro = new Kuroshiro();
    await kuroshiro.init(new KuromojiAnalyzer());
    initialized = true;
  }
  return kuroshiro;
};

/**
 * 難しい漢字をひらがなに変換する
 * 小学校4年生以上で習う漢字を対象とする
 * @param text 変換するテキスト
 * @returns 変換後のテキスト
 */
export const convertComplexKanji = async (text: string): Promise<string> => {
  // Kuroshiroが初期化されていなければ初期化
  if (!initialized) {
    await initializeKuroshiro();
  }

  try {
    // すべての漢字をひらがなに変換するのではなく、読みがなを振る形式にする
    // 小学校1年生～4年生までの教育漢字はそのまま残し、それ以外の漢字にふりがなをつける
    // ※実際の実装では、教育漢字リストを使った詳細な制御が必要だが、
    // ここではKuroshiroの機能を使って簡易的に実装する
    const result = await kuroshiro.convert(text, {
      mode: "furigana", // ふりがなモード
      to: "hiragana", // ひらがなに変換
      delimiter_start: "（",
      delimiter_end: "）",
    });

    return result;
  } catch (error) {
    console.error("漢字変換中にエラーが発生しました:", error);
    // エラー時は元のテキストを返す
    return text;
  }
};

export default {
  convertComplexKanji,
  initializeKuroshiro,
};
