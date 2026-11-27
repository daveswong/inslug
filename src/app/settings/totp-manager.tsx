"use client";

/**
 * 手机验证器的绑定 / 更换 / 解绑。
 *
 * 首次绑定：扫码 → 填一次 6 位码 → 直接生效（此时账号只有 Passkey，多一把钥匙不损失什么）
 * 更换 / 解绑：验过新码后还要过邮件确认，因为这两件事会让已有的钥匙失效
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";

type Setup = { secret: string; grouped: string; qrSvg: string };

export default function TotpManager({
  bound,
  mailReady,
  onBound,
}: {
  bound: boolean;
  mailReady: boolean;
  onBound?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setSetup(null);
    setCode("");
  };

  const begin = async () => {
    setBusy(true);
    setError("");
    setStatus(t("正在生成密钥…"));
    try {
      const res = await fetch("/api/auth/totp/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("无法生成密钥"));
      setSetup(data as Setup);
      setStatus("");
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : t("无法生成密钥"));
    } finally {
      setBusy(false);
    }
  };

  const confirmBind = async () => {
    if (!setup) return;
    // 位数不对就当场说清楚。以前按钮直接置灰，点了跟没点一样，
    // 用户根本不知道是哪里不对。
    if (code.length !== 6) {
      setError(t("验证码是 6 位数字，现在只输入了 {n} 位。", { n: code.length }));
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: setup.secret, code }),
        // 请求挂住时给个说法，不然页面看起来就是没反应
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("绑定失败"));

      if (data.pending) {
        reset();
        setStatus(t("确认信已发出：点邮件里的链接、点一下确认，更换才会生效。"));
      } else {
        setStatus(t("已绑定。以后可以用这个验证器的 6 位码登录。"));
        reset();
        if (onBound) {
          onBound();
        }
        // 让服务端重读绑定状态即可。整页 reload 会把下面的成功提示
        // 和二维码 state 一起冲掉，看起来像「绑了又没绑」。
        // 会话版本变化由 verify 接口签名的新 cookie 处理，不需要 reload。
        router.refresh();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        setError(t("请求超时了，服务器没在 20 秒内回应。稍后再试一次。"));
      } else {
        setError(e instanceof Error ? e.message : t("绑定失败"));
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/auth/totp/disable", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("请求失败"));
      setStatus(t("确认信已发出：点邮件里的链接、点一下确认，解绑才会生效。"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("请求失败"));
    } finally {
      setBusy(false);
    }
  };

  // 扫码绑定中
  if (setup) {
    return (
      <div className="totp-manager">
        <p className="notice">
          
          {t("用手机上的验证器（1Password、Google Authenticator、iOS 密码 App 都行）扫这个码：")}
        </p>
        <div className="totp-qr" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
        <p className="notice">
          
          {t("扫不了就把这串密钥手输进去：")}<code className="totp-secret">{setup.grouped}</code>
        </p>
        <p className="notice">
          {t("手机上要留的必须是这一条。重新生成密钥后，旧的条目就作废了，验证码要对上这一串。")}
        </p>

        {/*
          这里不能用 <form>：本组件被塞进设置页的 <form action={saveSiteSettings}> 里，
          内层 form 会被浏览器丢弃，里面的 submit 按钮和回车都去提交外层表单，
          于是输验证码 / 粘贴到一半就把整页刷掉了。改用普通 div + 点击绑定。
        */}
        <div className="login-form totp-form">
          <input
            className="search-input"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) =>
              // 只留数字；粘贴带空格的码也能用
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirmBind();
              }
            }}
            placeholder={t("验证器上显示的 6 位码")}
            aria-label={t("6 位验证码")}
          />
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={confirmBind}
            disabled={busy}
          >
            {bound ? t("验证并请求更换") : t("验证并绑定")}
          </button>
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={reset}
            disabled={busy}
          >
            
            {t("取消")}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="totp-manager">
      {bound ? (
        <>
          <p className="notice">{t("已经绑了一把验证器。")}</p>
          <div className="tag-list">
            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              onClick={begin}
              disabled={busy || !mailReady}
            >
              
              {t("换一把")}
            </button>
            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              onClick={disable}
              disabled={busy || !mailReady}
            >
              
              {t("解绑")}
            </button>
          </div>
          {!mailReady && (
            <p className="notice">
              
              {t("换绑 / 解绑需邮件确认。请先配置服务端发信，并在站点设置里填好通知邮箱。")}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="notice">{t("还没有绑定验证器。")}</p>
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            onClick={begin}
            disabled={busy || !mailReady}
          >
            
            {t("绑定验证器")}
          </button>
          {!mailReady && (
            <p className="notice">
              {t("绑定验证器需要邮件确认。请先配置服务端发信，并在站点设置里填好通知邮箱。")}
            </p>
          )}
        </>
      )}

      {status && <p className="notice">{status}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
