import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

/**
 * TOTP（手机验证器里的 6 位码，RFC 6238）。
 *
 * 只依赖 otpauth（纯 TS）和 qrcode，没有原生模块，Vercel 上不用折腾。
 * secret 的加解密在 secret-box.ts，别在这里引 crypto，否则凡是判断登录态的页面
 * 都会被打包进二维码库。
 */

const ISSUER = "inslug";
const LABEL = "owner";
const PERIOD = 30;
const DIGITS = 6;

/** 新 secret，base32 编码，20 字节熵 */
export function newSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totpOf(secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: LABEL,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** 给二维码用的 otpauth:// 地址 */
export function otpauthUri(secret: string): string {
  return totpOf(secret).toString();
}

/** 二维码直接渲染成 SVG 字符串，前端 innerHTML 塞进去，不用图片 */
export async function qrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, {
    type: "svg",
    margin: 1,
    width: 160,
    errorCorrectionLevel: "M",
  });
}

/** base32 每 4 位一组，方便手动输入 */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function currentStep(): number {
  return Math.floor(Date.now() / (PERIOD * 1000));
}

/**
 * 校验 6 位码。
 *
 * window: 1 表示接受前后各一个时间步（±30 秒），容忍手机和服务器的小幅时钟偏差。
 * lastStep 用来防重放：同一个时间步的码验证成功过一次之后，再来一次就不认了，
 * 否则别人偷看到验证码能在剩余有效期内复用。
 */
export function verifyCode(
  secret: string,
  input: string,
  lastStep?: number | null
): { ok: boolean; step: number } {
  const token = input.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(token)) return { ok: false, step: 0 };

  let delta: number | null = null;
  try {
    delta = totpOf(secret).validate({ token, window: 1 });
  } catch {
    return { ok: false, step: 0 };
  }
  if (delta === null) return { ok: false, step: 0 };

  const step = currentStep() + delta;
  if (lastStep != null && step <= lastStep) return { ok: false, step };
  return { ok: true, step };
}

/** 测试/联调用：算当前时间步的验证码 */
export function currentToken(secret: string): string {
  return totpOf(secret).generate();
}
