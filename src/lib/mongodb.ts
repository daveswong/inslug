import { MongoClient, Db } from "mongodb";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getEnvValue } from "./env-config";

/**
 * 数据库连接：
 * - 运行时配置里的 MONGODB_URI（引导程序写进 .env，或部署时注入的环境变量）
 * - 本地开发读 config/database.json（被 gitignore，不提交）
 *
 * 全局缓存 client，避免 serverless 冷启动时重复建连。
 * 连接串变了要重新连：引导程序改完 MONGODB_URI 后不用重启就能生效。
 */

type DbConfig = { uri: string; dbName: string };

function resolveConfig(): DbConfig {
  // 显式的库名环境变量优先于任何配置文件
  const envDbName = process.env.MONGODB_DB_NAME;
  // 运行时配置优先：.env 里的值，其次部署时注入的环境变量
  const envUri = getEnvValue("MONGODB_URI");
  if (envUri) {
    return {
      uri: envUri,
      dbName: envDbName || "inslug",
    };
  }

  // 本地从配置文件读
  try {
    const raw = readFileSync(
      join(process.cwd(), "config", "database.json"),
      "utf8"
    );
    const cfg = JSON.parse(raw);
    if (!cfg.uri) throw new Error("database.json 缺少 uri");
    return { uri: cfg.uri, dbName: envDbName || cfg.dbName || "inslug" };
  } catch {
    throw new Error(
      "未找到数据库配置：请在设置里填写 MONGODB_URI，或填写 config/database.json"
    );
  }
}

const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
  _mongoDbName?: string;
  _mongoUri?: string;
};

export async function getDb(): Promise<Db> {
  const { uri, dbName } = resolveConfig();

  // 连接串变了就重连（旧连接已经指向别的库了）
  if (globalForMongo._mongoClient && globalForMongo._mongoUri !== uri) {
    const stale = globalForMongo._mongoClient;
    globalForMongo._mongoClient = undefined;
    globalForMongo._mongoDbName = undefined;
    globalForMongo._mongoUri = undefined;
    stale.then((client) => client.close(true)).catch(() => undefined);
  }

  if (!globalForMongo._mongoClient) {
    const client = new MongoClient(uri);
    globalForMongo._mongoUri = uri;
    globalForMongo._mongoDbName = dbName;
    globalForMongo._mongoClient = client.connect();
  }
  const client = await globalForMongo._mongoClient;
  return client.db(globalForMongo._mongoDbName || "inslug");
}

/** 数据库当前是否连得上。页面用它决定「数据库还没配好」时的降级展示 */
export async function isDbConfigured(): Promise<boolean> {
  try {
    await getDb();
    return true;
  } catch {
    return false;
  }
}
