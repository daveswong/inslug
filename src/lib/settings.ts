import { getDb } from "./mongodb";
import { DEFAULT_SETTINGS, type SettingsDoc } from "./types";

type SettingsCollection = Omit<SettingsDoc, "_id"> & { _id: string };

export async function getSettings(): Promise<SettingsDoc> {
  try {
    const db = await getDb();
    const doc = await db
      .collection<SettingsCollection>("settings")
      .findOne({ _id: "site" });
    // 合并默认值：老文档缺新增字段（如 notifyEmail）时不至于读成 undefined
    if (doc) {
      return { ...DEFAULT_SETTINGS, ...doc, updatedAt: doc.updatedAt } as SettingsDoc;
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
