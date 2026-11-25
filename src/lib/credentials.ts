import { getDb } from "./mongodb";
import { openValue } from "./secret-box";

/**
 * 凭据存储：只存「怎么登录」这件事本身。
 *
 * 现在只有两把钥匙：
 * - Passkey（WebAuthn，凭据在 passkeys 集合，见 lib/passkey.ts）
 * - TOTP 验证器（6 位码，secret 加密存在这里）
 *
 * 没有密码了。密码是最弱的一环：能猜、能撞、能忘，而它换来的安全性还不如一把 Passkey。
 * 万一两把钥匙都没了（手机丢了、设备重置），走 RECOVERY_TOKEN 紧急入口，
 * 那是环境变量里的一把临时钥匙，用完就该删掉。
 */

const AUTH_ID = "admin";

interface AuthDoc {
  _id: string;
  /** TOTP secret 的密文（AES-256-GCM，见 secret-box.ts） */
  totpSecret?: string;
  /** 最近一次验证成功的时间步，同一个步长的码不能用第二次 */
  totpLastStep?: number;
  sessionVersion: number;
  updatedAt: Date;
}

export interface AuthState {
  /** 已解密的 TOTP secret；没绑验证器就是 null */
  totpSecret: string | null;
  totpLastStep: number | null;
  sessionVersion: number;
}

/**
 * 当前凭据状态。
 *
 * 数据库读不到时直接抛错：调用方是 isLoggedIn()，它把异常当成未登录。
 * 宁可让一次连接抖动把人踢下线，也不要在读不到状态时误判成「已登录」。
 */
export async function getAuth(): Promise<AuthState> {
  const db = await getDb();
  const doc = await db.collection<AuthDoc>("auth").findOne({ _id: AUTH_ID });
  if (!doc) {
    return { totpSecret: null, totpLastStep: null, sessionVersion: 0 };
  }
  return {
    totpSecret: doc.totpSecret ? openValue(doc.totpSecret) : null,
    totpLastStep: doc.totpLastStep ?? null,
    sessionVersion: doc.sessionVersion ?? 0,
  };
}

/**
 * 写入或清除验证器，并把会话版本 +1（所有设备立刻失效）。
 * 返回新的版本号，调用方拿它给当前浏览器重签会话。
 */
export async function setTotpSecret(sealed: string | null): Promise<number> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  const current = await col.findOne({ _id: AUTH_ID });
  const sessionVersion = (current?.sessionVersion ?? 0) + 1;

  if (sealed) {
    await col.updateOne(
      { _id: AUTH_ID },
      {
        $set: {
          totpSecret: sealed,
          totpLastStep: 0,
          sessionVersion,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } else {
    await col.updateOne(
      { _id: AUTH_ID },
      {
        $set: { sessionVersion, updatedAt: new Date() },
        $unset: { totpSecret: "", totpLastStep: "" },
      },
      { upsert: true }
    );
  }
  return sessionVersion;
}

/**
 * 记下已经用掉的时间步。
 * 用 $max 而不是 $set：并发请求下只会往前推，不会被旧值覆盖回去。
 */
export async function recordTotpStep(step: number): Promise<void> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  await col.updateOne(
    { _id: AUTH_ID },
    { $max: { totpLastStep: step } },
    { upsert: true }
  );
}

/** 只递增版本号，不碰凭据本身（删 Passkey 这类场合） */
export async function bumpSessionVersion(): Promise<number> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  const current = await col.findOne({ _id: AUTH_ID });
  const sessionVersion = (current?.sessionVersion ?? 0) + 1;
  if (current) {
    await col.updateOne(
      { _id: AUTH_ID },
      { $set: { sessionVersion, updatedAt: new Date() } }
    );
  }
  return sessionVersion;
}
