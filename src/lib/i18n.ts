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
import { getSettings } from "./settings";
import { getEnvValue } from "./env-config";

/**
 * 界面语言，从三处取，优先级从高到低：
 *
 * 1. 设置页里选的（存 settings.uiLanguage）——最常用，改完立刻生效
 * 2. 环境变量 UI_LANGUAGE —— 部署时定的默认值
 * 3. 本地 config/locale.json —— 本机开发时改
 * 4. 都没有就是中文
 */
export async function currentLocale(): Promise<Locale> {
  try {
    const saved = (await getSettings()).uiLanguage?.trim();
    if (saved && SUPPORTED_LOCALES.includes(saved as Locale)) {
      return saved as Locale;
    }
  } catch {
    // 数据库读不到就往下走，不因为这个把整站卡住
  }

  // 部署时定的默认值：Vercel 上在环境变量里，本地 .env 也算
  const fromEnv = getEnvValue("UI_LANGUAGE")?.trim();
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
  const locale = await currentLocale();
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
