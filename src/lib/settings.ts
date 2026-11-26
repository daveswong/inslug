import { getDb } from "./mongodb";
import { DEFAULT_SETTINGS, type SettingsDoc, type SocialLinks } from "./types";

type SettingsCollection = Omit<SettingsDoc, "_id"> & { _id: string };

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

export async function getSettings(): Promise<SettingsDoc> {
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
  const db = await getDb();
  const current = await getSettings();
  const merged: SettingsDoc = { ...current, ...values, _id: "site", updatedAt: new Date() };
  await db.collection<SettingsCollection>("settings").updateOne(
    { _id: "site" },
    { $set: merged },
    { upsert: true }
  );
  return merged;
}
