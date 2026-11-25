// 服务端专用（用了 node:fs）：只从 page / route / server action 里引，不要引到 client 组件
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_LOCALE,
  render,
  SUPPORTED_LOCALES,
  type Dictionary,
  type Locale,
  type Translate,
} from "./i18n-core";

/**
 * 界面语言：环境变量优先，其次本地 config/locale.json，都没有就是中文。
 *
 * 环境变量 UI_LANGUAGE 用于 Vercel（只读文件系统改不了本地文件）；
 * config/locale.json 方便本机改一个值就切语言，已在 .gitignore 里。
 */
export function currentLocale(): Locale {
  const fromEnv = process.env.UI_LANGUAGE?.trim();
  if (fromEnv && SUPPORTED_LOCALES.includes(fromEnv as Locale)) {
    return fromEnv as Locale;
  }
  try {
    const cfg = JSON.parse(
      readFileSync(join(process.cwd(), "config", "locale.json"), "utf8")
    ) as { locale?: string };
    if (cfg.locale && SUPPORTED_LOCALES.includes(cfg.locale as Locale)) {
      return cfg.locale as Locale;
    }
  } catch {
    // 没这个文件是正常情况
  }
  return DEFAULT_LOCALE;
}

export async function getI18n(): Promise<{
  locale: Locale;
  dict: Dictionary;
  t: Translate;
}> {
  const locale = currentLocale();
  let dict: Dictionary = {};
  try {
    dict = JSON.parse(
      readFileSync(join(process.cwd(), "locales", `${locale}.json`), "utf8")
    ) as Dictionary;
  } catch {
    // 缺语言包时 t() 会回退到中文原文，不至于白屏
  }
  return { locale, dict, t: (key, vars) => render(dict, key, vars) };
}

/** 只想要翻译函数时用这个 */
export async function getT(): Promise<Translate> {
  return (await getI18n()).t;
}
