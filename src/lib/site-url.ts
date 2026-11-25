/** 站点对外地址，优先用正式域名 */
export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.ORIGIN ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
