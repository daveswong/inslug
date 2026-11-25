// 脚本共用：解析数据库连接串。
//
// 顺序和程序本身一致：进程环境变量 → .env → .env.local → config/database.json。
// 这样本地只需要维护一个 .env，config/database.json 变成可选项。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function parseEnv(text) {
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (!/^["']/.test(value)) {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function fileEnv(name) {
  const path = join(ROOT, name);
  if (!existsSync(path)) return {};
  try {
    return parseEnv(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/** 返回 { uri, dbName }，找不到就抛错 */
export function resolveDb() {
  const fromEnv = process.env.MONGODB_URI;
  const files = { ...fileEnv(".env"), ...fileEnv(".env.local") };
  const uri = fromEnv || files.MONGODB_URI;
  if (uri) {
    return {
      uri,
      dbName: process.env.MONGODB_DB_NAME || files.MONGODB_DB_NAME || "inslug",
    };
  }
  const cfgPath = join(ROOT, "config", "database.json");
  if (existsSync(cfgPath)) {
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    return {
      uri: cfg.uri,
      dbName: process.env.MONGODB_DB_NAME || cfg.dbName || "inslug",
    };
  }
  throw new Error(
    "找不到数据库配置：请在 .env 里填 MONGODB_URI，或填写 config/database.json"
  );
}
