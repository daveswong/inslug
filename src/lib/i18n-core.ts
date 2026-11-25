/**
 * 语言包的核心逻辑，服务端和浏览器都能用（不引 node:fs）。
 *
 * 设计：key 就是中文原文。这样代码里一眼能看出界面会显示什么，
 * 英文包没写的条目自动回退到中文，不会因为漏 key 出现一串路径。
 */

export type Locale = "zh-CN" | "en";
export const SUPPORTED_LOCALES: Locale[] = ["zh-CN", "en"];
export const DEFAULT_LOCALE: Locale = "zh-CN";

export type Dictionary = Record<string, string>;
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** {name} 占位符替换。传进来的值一律转成字符串 */
export function render(
  dict: Dictionary,
  key: string,
  vars?: Record<string, string | number>
): string {
  const template = dict[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
