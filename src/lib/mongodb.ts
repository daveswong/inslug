import { MongoClient, Db } from "mongodb";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 数据库连接：
 * - 本地开发读 config/database.json（被 gitignore，不提交）
 * - 部署时读环境变量 MONGODB_URI（Vercel 后台配置）
 * 全局缓存 client，避免 serverless 冷启动时重复建连。
 */

type DbConfig = { uri: string; dbName: string };

function resolveConfig(): DbConfig {
  // 生产/部署优先用环境变量
  const envUri = process.env.MONGODB_URI;
  if (envUri) {
    return {
      uri: envUri,
      dbName: process.env.MONGODB_DB_NAME || "inslug",
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
    return { uri: cfg.uri, dbName: cfg.dbName || "inslug" };
  } catch {
    throw new Error(
      "未找到数据库配置：请设置 MONGODB_URI 环境变量，或填写 config/database.json"
    );
  }
}

const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
  _mongoDbName?: string;
};

export async function getDb(): Promise<Db> {
  if (!globalForMongo._mongoClient) {
    const { uri, dbName } = resolveConfig();
    globalForMongo._mongoDbName = dbName;
    const client = new MongoClient(uri);
    globalForMongo._mongoClient = client.connect();
  }
  const client = await globalForMongo._mongoClient;
  return client.db(globalForMongo._mongoDbName || "inslug");
}
