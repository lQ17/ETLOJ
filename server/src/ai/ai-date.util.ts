/** 按 Asia/Shanghai 取 YYYY-MM-DD，用于 AI 日额度 / 日统计切日 */
export function beijingDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
