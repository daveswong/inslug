import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

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

/** 读文件的结果：分清「没有文件」和「文件坏了」——两者的处理方式不一样 */
export type SettingsFileRead =
  | { state: "missing" }
  | { state: "ok"; values: SettingsFileShape }
  | { state: "broken"; error: string };

function settingsPath(): string {
  return SETTINGS_FILE;
}

export function readSettingsFile(): SettingsFileRead {
  try {
    if (!existsSync(settingsPath())) return { state: "missing" };
    const raw = readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { state: "broken", error: "配置文件不是合法的 JSON 对象" };
    }
    return { state: "ok", values: parsed as SettingsFileShape };
  } catch (error) {
    // 文件存在但解析失败：这是「坏了」，不能当成「没配置」——
    // 悄悄回退到默认值会让站点名、通知邮箱这些全丢，
    // 而用户什么都看不出来，只觉得站点「莫名其妙变了」。
    return {
      state: "broken",
      error: error instanceof Error ? error.message : "配置文件读取失败",
    };
  }
}

export function writeSettingsFile(
  values: SettingsFileShape
): { ok: true } | { ok: false; error: string } {
  const path = settingsPath();
  // 先写临时文件再改名：直接覆盖的话，进程在写的过程中被打断，
  // 会留下半截 JSON，下次就读不出来了。rename 在同一文件系统内是原子的。
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, path);
    return { ok: true };
  } catch (error) {
    // 临时文件别留在那儿
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // 清理失败不影响主流程
    }
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
    const probe = join(
      dir,
      `.settings-write-probe-${process.pid}-${randomBytes(4).toString("hex")}`
    );
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
    const probe = join(
      dir,
      `.settings-dir-probe-${process.pid}-${randomBytes(4).toString("hex")}`
    );
    writeFileSync(probe, "");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
