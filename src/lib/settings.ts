import { getDb } from "./mongodb";
import { DEFAULT_SETTINGS, type SettingsDoc, type SocialLinks } from "./types";
import { getEnvValue } from "./env-config";
import { readSettingsFile, writeSettingsFile } from "./settings-file";

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

export async function getSettings(): Promise<SettingsDoc> {
  if (settingsStore() === "file") {
    const raw = readSettingsFile();
    if (!raw) return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
    const { _id: _ignored, updatedAt: rawUpdatedAt, ...rest } = raw as Record<
      string,
      unknown
    >;
    return {
      ...DEFAULT_SETTINGS,
      ...(rest as Partial<SettingsDoc>),
      _id: "site",
      social: normalizeSocial(raw.social),
      updatedAt: toDate(rawUpdatedAt),
    } as SettingsDoc;
  }

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
        updatedAt: doc.updatedAt,
      } as SettingsDoc;
    }
  } catch {
    // 数据库还没配好或连不上时，站点仍要能打开（尤其是安装向导）
    return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
  }
  // 未初始化时返回默认值（不写入，保持只读）
  return { ...DEFAULT_SETTINGS, updatedAt: new Date(0) };
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
    const result = writeSettingsFile(rest as unknown as Record<string, unknown>);
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
