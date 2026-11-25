import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./mongodb";

/**
 * 凭据存储：密码哈希 + 会话版本号。
 *
 * 读取优先级：数据库 > ADMIN_PASSWORD_HASH > config/auth.json。
 * 后两者只是「初始种子」和「救急重置」：一旦在设置页里改过密码，库里就有了权威值，
 * 之后改环境变量不会再把它顶回去（否则每次改密码都会被旧的 env 覆盖）。
 * 真要强制重置，把 auth 集合里那条文档删掉即可。
 */

const AUTH_ID = "admin";

interface AuthDoc {
  _id: string;
  passwordHash: string;
  sessionVersion: number;
  updatedAt: Date;
}

/** 种子哈希：部署读环境变量，本地读 config/auth.json（避免 $ 被 dotenv 展开） */
function seedHash(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD_HASH;
  if (fromEnv) return fromEnv;
  try {
    const raw = readFileSync(join(process.cwd(), "config", "auth.json"), "utf8");
    const parsed = JSON.parse(raw) as { passwordHash?: string };
    return parsed.passwordHash ?? null;
  } catch {
    return null;
  }
}

export interface AuthState {
  passwordHash: string | null;
  sessionVersion: number;
  source: "db" | "seed" | "none";
}

/** 当前凭据状态。库里没有文档时退回种子哈希，版本号按 0 算 */
export async function getAuth(): Promise<AuthState> {
  try {
    const db = await getDb();
    const doc = await db.collection<AuthDoc>("auth").findOne({ _id: AUTH_ID });
    if (doc?.passwordHash) {
      return {
        passwordHash: doc.passwordHash,
        sessionVersion: doc.sessionVersion ?? 0,
        source: "db",
      };
    }
  } catch {
    // 数据库暂时不可用时退回种子，避免整站因为一次连接失败而锁死
  }
  const seed = seedHash();
  return {
    passwordHash: seed,
    sessionVersion: 0,
    source: seed ? "seed" : "none",
  };
}

/**
 * 写入新密码哈希，并把会话版本号 +1（让所有旧 cookie 失效）。
 * 返回新的版本号，调用方拿它给当前浏览器重签会话。
 */
export async function setPasswordHash(passwordHash: string): Promise<number> {
  const db = await getDb();
  const collection = db.collection<AuthDoc>("auth");
  const current = await collection.findOne({ _id: AUTH_ID });
  const sessionVersion = (current?.sessionVersion ?? 0) + 1;
  await collection.updateOne(
    { _id: AUTH_ID },
    { $set: { passwordHash, sessionVersion, updatedAt: new Date() } },
    { upsert: true }
  );
  return sessionVersion;
}

/** 只递增版本号（删 Passkey 这类不需要改密码的场合） */
export async function bumpSessionVersion(): Promise<number> {
  const db = await getDb();
  const collection = db.collection<AuthDoc>("auth");
  const current = await collection.findOne({ _id: AUTH_ID });
  const sessionVersion = (current?.sessionVersion ?? 0) + 1;
  if (current) {
    await collection.updateOne(
      { _id: AUTH_ID },
      { $set: { sessionVersion, updatedAt: new Date() } }
    );
  }
  return sessionVersion;
}
