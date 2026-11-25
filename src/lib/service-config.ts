import { getDb } from "./mongodb";

/**
 * 服务类配置：邮件（Resend）与图片存储（Vercel Blob）的凭据。
 *
 * 这一组不是身份验证必需的，部署之后随时可以改，所以存在数据库里，
 * 而不是环境变量——省得每次改都要重新部署。
 *
 * 读取顺序：数据库 > 进程环境变量（部署时注入的仍作兜底）。
 */

const COLLECTION = "runtime_config";
const DOC_ID = "config";

type ServiceDoc = {
  _id: string;
  values: Record<string, string>;
  updatedAt: Date;
};

export async function getServiceValues(): Promise<Record<string, string>> {
  try {
    const db = await getDb();
    const doc = await db.collection<ServiceDoc>(COLLECTION).findOne({ _id: DOC_ID });
    return (doc?.values as Record<string, string>) ?? {};
  } catch {
    // 数据库还没配好或连不上时退回环境变量
    return {};
  }
}

export async function getServiceValue(key: string): Promise<string | undefined> {
  const values = await getServiceValues();
  if (values[key]) return values[key];
  return process.env[key] || undefined;
}

/** 写服务类配置（null 表示删除该键） */
export async function setServiceValues(
  updates: Record<string, string | null>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const current = await getServiceValues();
    const merged = { ...current };
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) delete merged[key];
      else if (value !== "") merged[key] = value;
    }
    await db
      .collection<ServiceDoc>(COLLECTION)
      .updateOne(
        { _id: DOC_ID },
        { $set: { values: merged, updatedAt: new Date() } },
        { upsert: true }
      );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存失败：数据库异常",
    };
  }
}
