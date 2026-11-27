import { getDb } from "./mongodb";
import { DEFAULT_SETTINGS, type SettingsDoc, type SocialLinks } from "./types";
import { getEnvValue } from "./env-config";
import { readSettingsFile, writeSettingsFile, type SettingsFileShape } from "./settings-file";

type SettingsCollection = Omit<SettingsDoc, "_id"> & { _id: string };

/**
 * 站点设置存在哪儿。
 *
 * - mongodb（默认）：存进数据库的 settings 集合。跟着数据库一起备份。
 * - file：存进项目根目录的 config/settings.json。改完立刻生效，不用连库；
 *   数据库只放文章。适合想让站点信息独立于数据库、或者想直接手改这个文件的用法。
 *
 * 由 .env 里的 SETTINGS_STORE 决定，部署时定好，程序不猜。
 */
export type SettingsStore = "mongodb" | "file";

export function settingsStore(): SettingsStore {
  const raw = (getEnvValue("SETTINGS_STORE") ?? "").trim().toLowerCase();
  return raw === "file" ? "file" : "mongodb";
}

/** 上一次读设置时，配置文件有没有出问题（页面用它来提示站长） */
let settingsFileProblem: string | null = null;

/**
 * 老版本的社交链接是固定三个字段 { github, x, email }。
 * 新版本改成用户自己填的 { title, url } 数组，读的时候把老数据转过来，不丢链接。
 * 只在读取时转换，不回写——用户下次保存社交链接时自然落成新格式。
 */
function normalizeSocial(raw: unknown): SocialLinks {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object")
      )
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        url: String(item.url ?? "").trim(),
      }))
      .filter((item) => item.title && item.url);
  }
  if (raw && typeof raw === "object") {
    const old = raw as Record<string, unknown>;
    const links: SocialLinks = [];
    if (old.github) links.push({ title: "GitHub", url: String(old.github) });
    if (old.x) links.push({ title: "X", url: String(old.x) });
    if (old.email) links.push({ title: "Email", url: `mailto:${String(old.email)}` });
    return links;
  }
  return [];
}

/** 文件里读出来的是 JSON，日期得转回 Date */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * 把文件里的值收敛成合法的设置。
 *
 * 这个后端主打「想直接手改这个文件」，所以文件是人写的：
 * postsPerPage 写成 "abc"、social 写成对象而不是数组都很常见。
 * 不校验的话，NaN 会一路传到 MongoDB 的 $limit 里，首页直接 500。
 */
function sanitizeSettings(raw: SettingsFileShape): SettingsDoc {
  const { _id: _ignored, updatedAt: rawUpdatedAt, ...rest } = raw;

  const postsPerPage = Number(rest.postsPerPage);
  const notifyEmail = String(rest.notifyEmail ?? "");
  const uiLanguage = String(rest.uiLanguage ?? "");

  const text = (value: unknown): string =>
    typeof value === "string" ? value : value == null ? "" : String(value);

  return {
    ...DEFAULT_SETTINGS,
    siteName: text(rest.siteName) || DEFAULT_SETTINGS.siteName,
    description: text(rest.description),
    author: text(rest.author),
    seoTitle: text(rest.seoTitle),
    seoDescription: text(rest.seoDescription),
    seoKeywords: text(rest.seoKeywords),
    social: normalizeSocial(rest.social),
    favicon: text(rest.favicon),
    ogImage: text(rest.ogImage),
    footerText: text(rest.footerText),
    postsPerPage:
      Number.isFinite(postsPerPage) && postsPerPage > 0
        ? Math.min(50, Math.round(postsPerPage))
        : DEFAULT_SETTINGS.postsPerPage,
    notifyEmail,
    setupCompleted: rest.setupCompleted === true,
    uiLanguage,
    _id: "site",
    updatedAt: toDate(rawUpdatedAt),
  } as SettingsDoc;
}

export async function getSettings(): Promise<SettingsDoc> {
  if (settingsStore() === "file") {
    const read = readSettingsFile();
    if (read.state === "missing") {
      return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
    }
    if (read.state === "broken") {
      // 配置文件坏了不能悄悄回退到默认值：那会让站点名、通知邮箱全丢，
      // 而用户只看到站点「变了个样」，根本不知道是文件出了问题。
      // 这里返回默认值让页面还能打开，但记下问题，由页面明确提示。
      settingsFileProblem = `配置文件 config/settings.json 读取失败：${read.error}`;
      return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
    }
    settingsFileProblem = null;
    return sanitizeSettings(read.values);
  }

  settingsFileProblem = null;
  try {
    const db = await getDb();
    const doc = await db
      .collection<SettingsCollection>("settings")
      .findOne({ _id: "site" });
    // 合并默认值：老文档缺新增字段（如 notifyEmail）时不至于读成 undefined
    if (doc) {
      return {
        ...DEFAULT_SETTINGS,
        ...doc,
        social: normalizeSocial(doc.social),
        updatedAt: doc.updatedAt ?? new Date(0),
      } as SettingsDoc;
    }
  } catch {
    // 数据库还没配好或连不上时，站点仍要能打开（尤其是安装向导）
    return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
  }
  // 未初始化时返回默认值（不写入，保持只读）
  return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
}

/**
 * 配置文件后端当前有没有问题（读不出来）。
 *
 * getSettings() 不会因为文件坏掉就抛错——那样整页会 500，用户什么都做不了。
 * 改为返回默认值 + 记下这个问题，由页面把话说清楚。
 */
export function settingsFileIssue(): string | null {
  return settingsFileProblem;
}

export async function saveSettings(
  values: Partial<Omit<SettingsDoc, "_id" | "updatedAt">>
): Promise<SettingsDoc> {
  const current = await getSettings();
  const merged: SettingsDoc = {
    ...current,
    ...values,
    _id: "site",
    updatedAt: new Date(),
  };

  if (settingsStore() === "file") {
    const { _id: _ignored, ...rest } = merged;
    // 保存是「读出来 → 合并 → 写回」，两次并发保存会互相覆盖：
    // 后写的那个拿着旧快照，把先写的改动抹掉了。
    // 这里用一条链把写操作串起来，同一时刻只有一个在写。
    const result = await enqueueFileWrite(() =>
      writeSettingsFile(rest as unknown as Record<string, unknown>)
    );
    if (!result.ok) throw new Error(result.error);
    return merged;
  }

  const db = await getDb();
  await db.collection<SettingsCollection>("settings").updateOne(
    { _id: "site" },
    { $set: merged },
    { upsert: true }
  );
  return merged;
}

/** 文件写入的串行队列：后到的排在前一个后面 */
let fileWriteChain: Promise<void> = Promise.resolve();

function enqueueFileWrite<T>(
  task: () => T | Promise<T>
): Promise<T> {
  const run = (): Promise<T> => Promise.resolve().then(task);
  const next = fileWriteChain.then(run, run);
  // 链本身吞掉异常，避免一次失败让后面全部卡住
  fileWriteChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
