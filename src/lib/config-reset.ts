// 「重置配置」的实际执行逻辑。
//
// 这个文件刻意不是 "use server"：放在那里的导出函数会被 Next 变成 server action，
// 客户端能直接调用——而这里是删除配置项的操作，只能由确认页的服务端动作触发
// （那一步的凭据是邮件里的一次性链接）。
//
// 重置的边界：
// - 清掉配置项的值
// - 不碰站点设置、文章、标签
// - 不碰已绑定的 Passkey 与验证器（那是「钥匙」，不是「配置」；删了就进不去了）
//
// 能自动清的和清不掉的要分开说清楚：Vercel 上配置在环境变量里，应用改不了，
// 只能告诉用户哪些变量需要自己去控制台删。
import { AUTH_KEYS, SERVICE_KEYS } from "./config-keys";
import { canWriteEnvFile, resetEnvKeys } from "./env-config";
import { readEnvFile } from "./env-store";

export type ResetOutcome = {
  /** 应用已经清掉的字段 */
  cleared: string[];
  /** 应用清不掉、需要用户手动处理的字段 */
  manual: string[];
};

export async function performConfigReset(): Promise<ResetOutcome> {
  const cleared: string[] = [];
  const manual: string[] = [];

  // 两组配置现在都在 .env：非 Vercel 直接删键，Vercel 只能提示手动
  const allKeys = [
    ...AUTH_KEYS.map((item) => item.key),
    ...SERVICE_KEYS.map((item) => item.key),
  ];
  const fileValues = readEnvFile();
  const inFile = allKeys.filter((key) => Boolean(fileValues[key]));

  if (canWriteEnvFile()) {
    const result = resetEnvKeys(allKeys);
    if (result.ok) cleared.push(...inFile);
    else manual.push(...inFile);
    // 只在进程环境变量里的（比如 Vercel 控制台注入的），应用改不了
    for (const key of allKeys) {
      if (!fileValues[key] && process.env[key]) manual.push(key);
    }
  } else {
    for (const key of allKeys) {
      if (fileValues[key] || process.env[key]) manual.push(key);
    }
  }

  return { cleared, manual: [...new Set(manual)] };
}
