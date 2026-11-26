import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * 站点设置的「配置文件」后端。
 *
 * 存在 config/settings.json 里——和 config/database.json 同一个目录，同样被 gitignore。
 * 适合不想让站点信息跟着数据库走的场景：数据库只放文章，站点名、简介、
 * 社交链接这些放在服务器上的一个 JSON 文件里，改完立刻生效，不用连库。
 *
 * 只在自部署（文件系统可写）时可用。Vercel 上文件系统只读，写不进去。
 */

const SETTINGS_FILE = join(process.cwd(), "config", "settings.json");

export type SettingsFileShape = Record<string, unknown>;

function settingsPath(): string {
  return SETTINGS_FILE;
}

export function readSettingsFile(): SettingsFileShape | null {
  try {
    if (!existsSync(settingsPath())) return null;
    const raw = readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as SettingsFileShape;
  } catch {
    // 文件不存在或内容坏了：当作没配置，页面用默认值
    return null;
  }
}

export function writeSettingsFile(
  values: SettingsFileShape
): { ok: true } | { ok: false; error: string } {
  try {
    const path = settingsPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(values, null, 2)}\n`, {
      mode: 0o600,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/read-only|EACCES|EROFS|permission/i.test(message)) {
      return {
        ok: false,
        error:
          "当前部署平台的文件系统是只读的，写不进配置文件。请改用 MongoDB 存站点设置。",
      };
    }
    return { ok: false, error: message };
  }
}

/** 这个后端现在能不能用：文件系统得可写。只检查，不创建任何文件 */
export function canWriteSettingsFile(): boolean {
  try {
    const dir = dirname(settingsPath());
    if (!existsSync(dir)) {
      // 目录不存在：看它的上级能不能建
      return canCreateIn(dirname(dir));
    }
    const probe = join(dir, `.settings-write-probe-${process.pid}`);
    writeFileSync(probe, "");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/** 目录不存在时，判断能不能创建 */
function canCreateIn(dir: string): boolean {
  try {
    const probe = join(dir, `.settings-dir-probe-${process.pid}`);
    writeFileSync(probe, "");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
