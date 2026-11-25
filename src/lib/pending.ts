import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./mongodb";

/**
 * 待确认的凭据变更。
 *
 * 为什么要绕一圈邮件：换绑 / 解绑验证器会让账号少一把钥匙，一旦会话 cookie 被偷走，
 * 攻击者就能悄悄换掉你的验证器、把你锁在门外。多发一封确认信，等于要求操作者
 * 同时能读邮箱，成本很低但拦得住这种情况。
 *
 * 安全约定：
 * - 库里只存 token 的 SHA-256，明文 token 只在邮件链接里出现一次
 * - 10 分钟过期、单次使用、绑定 purpose
 * - 10 分钟内最多发 3 封，避免被当成发信器
 */

export type ChangePurpose = "totp-set" | "totp-disable";

export interface PendingDoc {
  _id?: unknown;
  tokenHash: string;
  purpose: ChangePurpose;
  payload: Record<string, unknown>;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  ip: string;
  ua: string;
}

const TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;

function collection() {
  return getDb().then((db) => db.collection<PendingDoc>("pending_changes"));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPendingChange(input: {
  purpose: ChangePurpose;
  payload: Record<string, unknown>;
  ip: string;
  ua: string;
}): Promise<{ token: string } | { error: string }> {
  const col = await collection();
  const now = Date.now();

  const recent = await col.countDocuments({
    createdAt: { $gte: new Date(now - RATE_WINDOW_MS) },
  });
  if (recent >= RATE_MAX) {
    return { error: "确认邮件发得太频繁，请 10 分钟后再试" };
  }

  const token = randomBytes(32).toString("base64url");
  await col.insertOne({
    tokenHash: hashToken(token),
    purpose: input.purpose,
    payload: input.payload,
    expiresAt: new Date(now + TTL_MS),
    usedAt: null,
    createdAt: new Date(now),
    ip: input.ip,
    ua: input.ua,
  });

  // 顺手清掉一天前的旧记录，集合不会无限长
  await col
    .deleteMany({ createdAt: { $lt: new Date(now - 24 * 60 * 60 * 1000) } })
    .catch(() => undefined);

  return { token };
}

export type PendingState = "ok" | "used" | "expired" | "missing";

export interface PendingLookup {
  state: PendingState;
  doc: PendingDoc | null;
}

/** 只读查询：确认页第一次打开时用它渲染「将要发生什么」，不产生任何副作用 */
export async function readPendingChange(token: string): Promise<PendingLookup> {
  if (!token) return { state: "missing", doc: null };
  const col = await collection();
  const doc = await col.findOne({ tokenHash: hashToken(token) });
  if (!doc) return { state: "missing", doc: null };
  if (doc.usedAt) return { state: "used", doc };
  if (doc.expiresAt.getTime() <= Date.now()) return { state: "expired", doc };
  return { state: "ok", doc };
}

/**
 * 原子地标记为已使用并返回文档。
 * 用 findOneAndUpdate 而不是「先查再写」，避免两个并发请求同时通过校验。
 */
export async function consumePendingChange(
  token: string
): Promise<PendingDoc | null> {
  if (!token) return null;
  const col = await collection();
  const doc = await col.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" }
  );
  return doc ?? null;
}
