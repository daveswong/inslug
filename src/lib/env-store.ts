import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * .env 文件的读写。
 *
 * 这是「引导程序配置」的落地方式：值真的写进项目根目录的 .env 文件，
 * 部署时带着走，重启也在。Vercel 这类平台文件系统只读，写不进去——
 * 那时 writeEnvValues 会报错，页面上如实告诉用户「当前平台不支持」。
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

/** 值里带引号或特殊字符时加引号，避免下次解析出错 */
function needsQuote(value: string): boolean {
  return /[\s#"'`\\]/.test(value) || value === "";
}

function formatValue(value: string): string {
  return needsQuote(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * 更新 .env：传入要写的键值，值为 null 表示删除该键。
 * 保留文件里原有的注释和未涉及的行；新键追加到文件末尾。
 */
export function writeEnvValues(
  updates: Record<string, string | null>
): { ok: true } | { ok: false; error: string } {
  // 主目标是 .env（部署时生成的那个文件）
  const result = applyToFile(envPath(), updates);
  if (!result.ok) return result;

  // .env.local 里已经有这些键时同步更新，免得本地开发读到旧值
  try {
    if (existsSync(localEnvPath())) {
      const existing = parseEnv(readFileSync(localEnvPath(), "utf8"));
      const overlap: Record<string, string | null> = {};
      for (const key of Object.keys(updates)) {
        if (key in existing) overlap[key] = updates[key];
      }
      if (Object.keys(overlap).length) applyToFile(localEnvPath(), overlap);
    }
  } catch {
    // 同步失败不影响主流程
  }
  return { ok: true };
}

/** 把一批键值应用到指定文件，保留原有的注释与未涉及的行 */
function applyToFile(
  path: string,
  updates: Record<string, string | null>
): { ok: true } | { ok: false; error: string } {
  let text = "";
  try {
    if (existsSync(path)) text = readFileSync(path, "utf8");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "读取 .env 失败",
    };
  }

  const lines = text.length ? text.split("\n") : [];
  const remaining = new Set(Object.keys(updates));
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;
    const eq = withoutExport.indexOf("=");
    const key = eq > 0 ? withoutExport.slice(0, eq).trim() : "";

    if (key && remaining.has(key)) {
      remaining.delete(key);
      const value = updates[key];
      // 删除：整行丢掉，保留原来的注释行
      if (value === null) continue;
      out.push(`${key}=${formatValue(value)}`);
      continue;
    }
    out.push(line);
  }

  // 剩下的是新增的键
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) continue;
    out.push(`${key}=${formatValue(value)}`);
  }

  try {
    writeFileSync(path, out.join("\n").replace(/\n+$/, "\n"), { mode: 0o600 });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Vercel / 只读文件系统最常见的报错
    if (/read-only|EACCES|EROFS|permission/i.test(message)) {
      return {
        ok: false,
        error:
          "当前部署平台的文件系统是只读的，写不进 .env 文件。请部署到自有服务器或 Docker，或改用环境变量配置。",
      };
    }
    return { ok: false, error: message };
  }
}

/** 文件系统能不能写 .env（用于页面上提前说明，而不是等保存才报错） */
export function canWriteEnvFile(): boolean {
  const path = envPath();
  try {
    if (existsSync(path)) {
      // 用只读方式打开，成功说明文件可访问；再试一次写权限检查
      readFileSync(path, "utf8");
    }
    // 尝试创建再删除一个探针文件
    const probe = join(process.cwd(), `.env-write-probe-${process.pid}`);
    writeFileSync(probe, "");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
