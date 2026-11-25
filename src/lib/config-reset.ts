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
import { getServiceValues, setServiceValues } from "./service-config";

export type ResetOutcome = {
  /** 应用已经清掉的字段 */
  cleared: string[];
  /** 应用清不掉、需要用户手动处理的字段 */
  manual: string[];
};

export async function performConfigReset(): Promise<ResetOutcome> {
  const cleared: string[] = [];
  const manual: string[] = [];

  // 一、服务组（邮件与图片存储）：存在数据库里，删掉就是真删
  const dbValues = await getServiceValues();
  const serviceKeys = SERVICE_KEYS.map((item) => item.key);
  const inDb = serviceKeys.filter((key) => Boolean(dbValues[key]));
  if (inDb.length) {
    const updates: Record<string, null> = {};
    for (const key of inDb) updates[key] = null;
    const result = await setServiceValues(updates);
    if (result.ok) cleared.push(...inDb);
    else manual.push(...inDb);
  }
  // 只在环境变量里、没存进数据库的：应用删不掉
  for (const key of serviceKeys) {
    if (!dbValues[key] && process.env[key]) manual.push(key);
  }

  // 二、身份验证与启动组：非 Vercel 写 .env 文件，Vercel 只能提示手动
  const authKeys = AUTH_KEYS.map((item) => item.key);
  const fileValues = readEnvFile();
  const inFile = authKeys.filter((key) => Boolean(fileValues[key]));

  if (canWriteEnvFile()) {
    const result = resetEnvKeys(authKeys);
    if (result.ok) cleared.push(...inFile);
    else manual.push(...inFile);
    // 只在进程环境变量里的（比如控制台注入的），应用改不了
    for (const key of authKeys) {
      if (!fileValues[key] && process.env[key]) manual.push(key);
    }
  } else {
    for (const key of authKeys) {
      if (fileValues[key] || process.env[key]) manual.push(key);
    }
  }

  return { cleared, manual: [...new Set(manual)] };
}
