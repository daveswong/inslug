import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * .env 文件的只读访问。
 *
 * 安全规则：程序永远不写服务器上的环境变量。安装向导只负责生成 .env 内容，
 * 由用户下载后自行保存到服务器或导入平台后台；这里只读取已经配置好的值。
 *
 * .env 里有数据库密码和密钥，绝不能提交到 GitHub（.gitignore 已覆盖）。
 */

const ENV_FILE = ".env";
const LOCAL_ENV_FILE = ".env.local";

function envPath(): string {
  return join(process.cwd(), ENV_FILE);
}

function localEnvPath(): string {
  return join(process.cwd(), LOCAL_ENV_FILE);
}

export type EnvValues = Record<string, string>;

/** 解析 .env：支持 export 前缀、单双引号、行内注释 */
export function parseEnv(text: string): EnvValues {
  const out: EnvValues = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!key) continue;
    let value = withoutExport.slice(eq + 1).trim();
    // 去掉行尾注释（只对不带引号的值）
    if (!/^["']/.test(value)) {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    // 去掉包裹的引号
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

/**
 * 读当前配置。
 *
 * 两个文件都看，.env.local 优先——和 Next 的行为一致：
 * 本地开发（next dev）读 .env.local，生产（next start）只有 .env。
 */
export function readEnvFile(): EnvValues {
  const merged: EnvValues = {};
  for (const path of [envPath(), localEnvPath()]) {
    try {
      if (!existsSync(path)) continue;
      Object.assign(merged, parseEnv(readFileSync(path, "utf8")));
    } catch {
      // 读不到就跳过
    }
  }
  return merged;
}
