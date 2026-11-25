import { getDb } from "./mongodb";

/** Passkey 凭据：公钥和计数器存库，私钥永远在用户设备的钥匙串里 */
export type PasskeyDoc = {
  credentialId: string; // base64url
  publicKey: string; // base64url
  counter: number;
  transports?: string[];
  createdAt: Date;
  lastUsedAt?: Date;
};

const COLLECTION = "passkeys";

async function collection() {
  const db = await getDb();
  return db.collection<PasskeyDoc>(COLLECTION);
}

export async function listPasskeys(): Promise<PasskeyDoc[]> {
  return (await collection()).find({}).toArray();
}

export async function findPasskey(credentialId: string): Promise<PasskeyDoc | null> {
  return (await collection()).findOne({ credentialId });
}

export async function addPasskey(
  doc: Omit<PasskeyDoc, "createdAt">
): Promise<void> {
  await (await collection()).insertOne({ ...doc, createdAt: new Date() });
}

export async function touchPasskey(
  credentialId: string,
  counter: number
): Promise<void> {
  await (await collection()).updateOne(
    { credentialId },
    { $set: { counter, lastUsedAt: new Date() } }
  );
}

/**
 * WebAuthn 的 RP_ID 和 origin：
 * 优先用环境变量（部署时配正式域名），本地开发按请求头推断，localhost 也能用 Passkey。
 */
export function rpConfig(req: Request): { rpID: string; origin: string } {
  const url = new URL(req.url);
  return {
    rpID: process.env.RP_ID || url.hostname,
    origin: process.env.ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || url.origin,
  };
}

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(value, "base64url");
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}
