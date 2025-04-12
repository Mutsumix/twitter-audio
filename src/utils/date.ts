/**
 * 日付処理ユーティリティ
 */

/**
 * YYYY-MM-DD形式の日付文字列をDateオブジェクトに変換
 */
export const parseDate = (dateStr: string): Date => {
  // Googleスプレッドシートの日付形式「March 17, 2025 at 10:35PM」をパース
  const regex = /([A-Za-z]+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)([AP]M)/;
  const match = dateStr.match(regex);

  if (match) {
    const [, month, day, year, hours, minutes, ampm] = match;

    // 月名を月番号に変換
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthIndex = monthNames.findIndex((m) => m === month);

    // 時間を24時間形式に変換
    let hour = parseInt(hours, 10);
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    return new Date(
      parseInt(year, 10),
      monthIndex,
      parseInt(day, 10),
      hour,
      parseInt(minutes, 10)
    );
  }

  // フォールバック: 標準的な日付形式の解析を試みる
  return new Date(dateStr);
};

/**
 * 日付が指定された範囲内かどうかをチェック
 */
export const isDateInRange = (
  date: Date,
  startDate: Date,
  endDate: Date
): boolean => {
  return date >= startDate && date <= endDate;
};

/**
 * 現在の日時からn日前の日付を取得
 */
export const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * YYYY-MM-DD形式の日付文字列を生成
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

/**
 * 現在の日時を「YYYY年MM月DD日HH時MM分」形式でフォーマット
 */
export const formatDateTimeJP = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return `${year}年${month}月${day}日${hours}時${minutes}分`;
};

export default {
  parseDate,
  isDateInRange,
  getDaysAgo,
  formatDate,
  formatDateTimeJP,
};
