// 凭据变更的确认页。
// GET 只展示「将要发生什么」，POST 才真正生效——邮件客户端和杀毒软件会预取链接，
// 如果 GET 就执行，等于让扫描器替人点了确认。
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { consumePendingChange, readPendingChange } from "@/lib/pending";
import {
  authorizePasskeyAdd,
  bumpSessionVersion,
  getAuth,
  setTotpSecret,
} from "@/lib/credentials";
import { deletePasskey, listPasskeys } from "@/lib/passkey";
import { openValue } from "@/lib/secret-box";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

async function applyChange(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const doc = await consumePendingChange(token);
  if (!doc) redirect(`/confirm/${token}?state=failed`);

  if (doc.purpose === "totp-set") {
    const sealed = String(doc.payload.sealedSecret ?? "");
    // 先自己解一遍：AUTH_SECRET 若在申请和确认之间变过，密文就打不开了，
    // 这时候写库等于把验证器静默弄失效，不如直接报失败让人重来。
    if (!sealed || !openValue(sealed)) redirect(`/confirm/${token}?state=failed`);
    await setTotpSecret(sealed);
  } else if (doc.purpose === "totp-disable") {
    await setTotpSecret(null);
  } else if (doc.purpose === "passkey-add") {
    // 不给攻击者「偷到邮件链接就直接绑一把钥匙」的能力：
    // 这里只开一个 10 分钟窗口，真正的绑定还得本人在设备上做 WebAuthn。
    await authorizePasskeyAdd();
  } else if (doc.purpose === "passkey-remove") {
    const credentialId = String(doc.payload.credentialId ?? "");
    if (!credentialId) redirect(`/confirm/${token}?state=failed`);
    const [keys, auth] = await Promise.all([
      listPasskeys(),
      getAuth().catch(() => null),
    ]);
    // 绝不能把最后一把钥匙删掉，否则连自己都进不去
    if (keys.length <= 1 && !auth?.totpSecret) {
      redirect(`/confirm/${token}?state=failed`);
    }
    if (!(await deletePasskey(credentialId))) {
      redirect(`/confirm/${token}?state=failed`);
    }
    await bumpSessionVersion();
  } else {
    redirect(`/confirm/${token}?state=failed`);
  }

  // 版本号已经 +1，所有设备（包括当前这台）都需要重新登录
  redirect(`/confirm/${token}?state=done`);
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { token } = await params;
  const { state: result } = await searchParams;
  const { state, doc } = await readPendingChange(token);

  const isDone = result === "done";
  const isFailed = result === "failed";

  return (
    <main className="site">
      <header className="site-head">
        <h1 className="site-title">{isDone ? "已完成" : "确认变更"}</h1>
      </header>

      <section className="section">
        {isDone && (
          <>
            <p className="notice">变更已生效。</p>
            {doc?.purpose === "passkey-add" ? (
              <>
                <p className="notice">
                  现在回设置页，在 10 分钟内用设备完成绑定（Touch ID / 指纹）。过期需要重新申请。
                </p>
                <p>
                  <a href="/settings">去设置页</a>
                </p>
              </>
            ) : (
              <>
                <p className="notice">
                  所有设备上的登录状态都已失效，包括当前这台。请用 Passkey 或验证器重新登录。
                </p>
                <p>
                  <a href="/login">去登录</a>
                </p>
              </>
            )}
          </>
        )}

        {!isDone && isFailed && (
          <>
            <p className="notice">这个链接已经失效：可能已被使用，或超过 10 分钟。</p>
            <p className="notice">到设置页重新发起一次即可。</p>
          </>
        )}

        {!isDone && !isFailed && state === "missing" && (
          <p className="notice">链接不对，或者这条记录已经被清理掉了。</p>
        )}

        {!isDone && !isFailed && state === "used" && (
          <>
            <p className="notice">这个链接已经用过了，不能重复使用。</p>
            <p className="notice">
              如果刚才确实是你确认的，变更已经生效，请用 Passkey 或验证器重新登录。
            </p>
          </>
        )}

        {!isDone && !isFailed && state === "expired" && (
          <>
            <p className="notice">链接超过 10 分钟，已失效。</p>
            <p className="notice">回到设置页重新发起一次即可。</p>
          </>
        )}

        {!isDone && !isFailed && state === "ok" && doc && (
          <>
            <p className="notice">
              即将执行：
              {doc.purpose === "totp-disable"
                ? "解绑登录验证器。"
                : doc.purpose === "totp-set"
                  ? "把登录验证器换成新的一个。"
                  : doc.purpose === "passkey-add"
                    ? "授权 10 分钟内绑定一把新的 Passkey（还要本人在设备上确认）。"
                    : "删除一把 Passkey。"}
            </p>

            <dl className="confirm-meta">
              <dt>申请时间</dt>
              <dd>{formatDateTime(doc.createdAt)}</dd>
              <dt>来源 IP</dt>
              <dd>{doc.ip}</dd>
              <dt>设备</dt>
              <dd>{doc.ua.slice(0, 120) || "未知"}</dd>
            </dl>

            <p className="notice">
              确认后所有设备都需要重新登录。不是你发起的就关掉这页，什么都不会变。
            </p>
            <form action={applyChange} className="form-actions">
              <input type="hidden" name="token" value={token} />
              <button className="btn btn-outline-light btn-plain" type="submit">
                确认执行
              </button>
              <a href="/">取消</a>
            </form>
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
