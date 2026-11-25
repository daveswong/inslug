import { MongoClient, Db } from "mongodb";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getEnvValue } from "./env-config";

/**
 * 数据库连接：
 * - 运行时配置里的 MONGODB_URI（引导程序写进 .env，或部署时注入的环境变量）
 * - 库名：MONGODB_DB_NAME > 连接串里的路径 > 默认 inslug
 * - 本地开发读 config/database.json（被 gitignore，不提交）
 *
 * 全局缓存 client，避免 serverless 冷启动时重复建连。
 * 连接串变了要重新连：引导程序改完 MONGODB_URI 后不用重启就能生效。
 */

type DbConfig = { uri: string; dbName: string };

/**
 * 从连接串里取库名：mongodb://host:27017/库名?opts → 库名
 *
 * 连接串自带库名是 MongoDB 的惯例。不认它的话，
 * 同一个集群里跑第二个站点（文档站）就会写错库。
 */
function dbNameFromUri(uri: string): string | null {
  try {
    const schemeAt = uri.indexOf("://");
    if (schemeAt < 0) return null;
    const afterScheme = uri.slice(schemeAt + 3);
    const slash = afterScheme.indexOf("/");
    if (slash < 0) return null;
    const path = afterScheme.slice(slash + 1).split("?")[0].trim();
    if (!path) return null;
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

function resolveConfig(): DbConfig {
  // 运行时配置优先：.env 里的值，其次部署时注入的环境变量
  const envUri = getEnvValue("MONGODB_URI");
  // 库名也走同一套：MONGODB_DB_NAME 可以单独指定，
  // 没指定就用连接串里带的路径，再没有才用默认值
  const envDbName = getEnvValue("MONGODB_DB_NAME");
  if (envUri) {
    return {
      uri: envUri,
      dbName: envDbName || dbNameFromUri(envUri) || "inslug",
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
    return {
      uri: cfg.uri,
      dbName: envDbName || cfg.dbName || dbNameFromUri(cfg.uri) || "inslug",
    };
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

/**
 * 连不上时返回 null 而不是抛错。
 *
 * 全新部署的第一件事就是「还没有数据库地址」——那会儿首页、文章页都得能打开，
 * 给出「去安装向导」的提示，而不是甩一个 500 给用户看。
 */
export async function getDbOrNull(): Promise<Db | null> {
  try {
    return await getDb();
  } catch {
    return null;
  }
}

/** 数据库的当前状态：给安装 / 重置引导看 */
export type DatabaseStatus = {
  /** 实际连的库名 */
  dbName: string;
  /** 集群里有没有这个库 */
  exists: boolean;
  /** 这次是不是刚建出来的 */
  created: boolean;
  /** 库里的集合 */
  collections: string[];
  /** 里面有多少篇文章 */
  postCount: number;
};

/** 只看状态，不改任何东西 */
export async function inspectDatabase(): Promise<DatabaseStatus> {
  const { uri, dbName } = resolveConfig();
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const list = await client.db("admin").admin().listDatabases();
    const exists = list.databases.some((db) => db.name === dbName);
    const collections = (
      await client.db(dbName).listCollections().toArray()
    ).map((c) => c.name);
    const postCount = collections.includes("posts")
      ? await client.db(dbName).collection("posts").countDocuments()
      : 0;
    return { dbName, exists, created: false, collections, postCount };
  } finally {
    await client.close(true).catch(() => undefined);
  }
}

/**
 * 确保这个库存在：不存在就建一个。
 *
 * MongoDB 的数据库是「写入即产生」，所以建库就是写一条站点设置记录。
 * 已经存在的话原样接着用，不碰里面的任何数据。
 */
export async function ensureDatabase(): Promise<DatabaseStatus> {
  const status = await inspectDatabase();
  if (status.exists) return status;

  const db = await getDb();
  await db
    .collection<{ _id: string; updatedAt: Date }>("settings")
    .updateOne(
      { _id: "site" },
      { $setOnInsert: { _id: "site", updatedAt: new Date() } },
      { upsert: true }
    );
  return { ...status, exists: true, created: true };
}
