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
  /** 邮件确认后开启的「可以绑新 Passkey」窗口，10 分钟 */
  passkeyAddUntil?: Date;
  sessionVersion: number;
  updatedAt: Date;
}

export interface AuthState {
  /** 已解密的 TOTP secret；没绑验证器、或密钥换了解不开，就是 null */
  totpSecret: string | null;
  /**
   * 数据库里是否确实存着密文。
   * 跟 totpSecret 分开：解不开不等于没绑过，
   * 当成「没绑过」会让换绑绕过邮件确认。
   */
  totpBound: boolean;
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
    return {
      totpSecret: null,
      totpBound: false,
      totpLastStep: null,
      sessionVersion: 0,
    };
  }
  // totpBound 表示「数据库里确实有密文」，totpSecret 是「能不能解开」。
  // 两者必须分开：密钥换过或密文损坏时 openValue 会返回 null，
  // 但那不等于「没绑过」——当成没绑过的话，换绑就能绕过邮件确认，
  // 任何登录用户都能静默替换掉站长的验证器。
  const totpBound = Boolean(doc.totpSecret);
  return {
    totpSecret: doc.totpSecret ? openValue(doc.totpSecret) : null,
    totpBound,
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

/**
 * 只递增版本号，不碰凭据本身（删 Passkey 这类场合）。
 *
 * 用 $inc 原子自增，而不是「读出来 +1 再写回去」：
 * 后者在并发下会丢增量——两个请求读到同一个旧值，各自算出 +1，
 * 写回去的是同一个数，等于只加了一次，而页面宣称「所有设备都失效了」。
 *
 * 另外要 upsert：只用 Passkey、没绑过验证器的站点 auth 集合是空的，
 * 不 upsert 的话版本号根本没写进去，旧 cookie 照样有效。
 */
export async function bumpSessionVersion(): Promise<number> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  await col.updateOne(
    { _id: AUTH_ID },
    { $inc: { sessionVersion: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
  const after = await col.findOne({ _id: AUTH_ID });
  return after?.sessionVersion ?? 1;
}

/** 邮件确认通过后，开一个 10 分钟的窗口允许绑定新 Passkey */
export async function authorizePasskeyAdd(): Promise<void> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  await col.updateOne(
    { _id: AUTH_ID },
    {
      $set: {
        passkeyAddUntil: new Date(Date.now() + 10 * 60 * 1000),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/** 绑定窗口是否还有效（读操作，不消耗） */
export async function passkeyAddAllowed(): Promise<boolean> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  const doc = await col.findOne({ _id: AUTH_ID });
  return !!doc?.passkeyAddUntil && doc.passkeyAddUntil.getTime() > Date.now();
}

/** 绑定成功后关掉窗口，避免一次授权绑很多把 */
export async function clearPasskeyAddAuthorization(): Promise<void> {
  const col = (await getDb()).collection<AuthDoc>("auth");
  await col.updateOne(
    { _id: AUTH_ID },
    { $unset: { passkeyAddUntil: "" }, $set: { updatedAt: new Date() } }
  );
}
