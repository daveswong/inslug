// 诊断：报告服务器实际读到的配置值和实际服务的域名。
//
// 存在的理由：Passkey 绑定失败时，浏览器只说「The RP ID "xxx" is invalid for
// this domain」，既不说是哪个域名不对，也不说服务器读到了什么。填错环境变量、
// 改完没重新部署、或者在预览部署上操作，从页面上完全看不出来——
// 这个接口把两边的事实摆出来，一眼就能对上。
//
// 只暴露非敏感信息：域名类配置（RP_ID / ORIGIN）和当前请求的主机名。
// 数据库连接串、密钥这些一个都不返回。
import { NextResponse } from "next/server";
import { getEnvValue } from "@/lib/env-config";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = await getT();
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";

  const rpId = getEnvValue("RP_ID") ?? "";
  const origin = getEnvValue("ORIGIN") ?? "";
  const recoveryToken = getEnvValue("RECOVERY_TOKEN") ?? "";

  // 浏览器判断 RP ID 合不合法：它必须是当前页面域名的「可注册域后缀」或完全相等。
  // 这里做同样的判断，把结论直接给出来。
  const hostName = host.split(":")[0].toLowerCase();
  const rpIdLower = rpId.toLowerCase();
  const rpIdMatchesHost =
    !!hostName &&
    !!rpIdLower &&
    (hostName === rpIdLower || hostName.endsWith(`.${rpIdLower}`));

  let originHost = "";
  try {
    originHost = origin ? new URL(origin).hostname : "";
  } catch {
    originHost = "";
  }

  return NextResponse.json({
    // 服务器读到了什么
    rpId,
    origin,
    // 这次请求实际是从哪个域名进来的
    requestHost: host,
    requestProto: proto,
    // 结论
    rpIdMatchesHost,
    originHost,
    originMatchesHost: !!originHost && originHost === hostName,
    // 顺带看一眼紧急入口的状态（只说有没有，不说值）
    recoveryConfigured: recoveryToken.length >= 16,
    note: t("只返回域名类信息，密钥和连接串不返回。"),
  });
}
