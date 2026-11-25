"use client";

// 修改密码：提交后不会立刻生效，而是发一封确认信，点开确认才写库
import { useActionState, useEffect, useRef } from "react";
import { submitPasswordChange, type PasswordState } from "./actions";

const initialState: PasswordState = { status: "idle", message: "" };

export default function PasswordForm() {
  const [state, action, pending] = useActionState(
    submitPasswordChange,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 发送成功后清空输入框，避免密码留在页面上
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form className="site-form" action={action} ref={formRef}>
      <label className="field">
        <span className="field-label">当前密码</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label className="field">
        <span className="field-label">新密码</span>
        <input
          name="newPassword"
          type="password"
          minLength={8}
          autoComplete="new-password"
          placeholder="至少 8 位"
          required
        />
      </label>
      <label className="field">
        <span className="field-label">再输一次</span>
        <input
          name="repeatPassword"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>

      <div className="form-actions">
        <button
          className="btn btn-outline-light btn-plain"
          type="submit"
          disabled={pending}
        >
          {pending ? "发送中…" : "发送确认邮件"}
        </button>
        {state.message && (
          <span
            className={state.status === "error" ? "form-error form-msg" : "form-msg"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
