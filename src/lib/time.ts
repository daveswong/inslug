/** 统一按东八区显示到分钟，避免服务器在 UTC 时差 8 小时 */
const DATE_TIME_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 形如 2026-11-25 09:10 */
export function formatDateTime(date: Date): string {
  return DATE_TIME_FMT.format(new Date(date));
}
