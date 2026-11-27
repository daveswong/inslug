"use client";

/**
 * 设置页的图片字段：可以手填地址，也可以直接上传，并显示预览。
 *
 * 上传走 uploadImage() 按当前存储方案分派（Vercel Blob / S3 / 本地磁盘），
 * 别在这里写死 Blob——自部署选了 local 或 s3 时会直接失败。
 *
 * 名字仍然是 name，所以外层表单的 server action 不用改。
 */
import { useId, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { uploadImage, type ClientStorageProvider } from "@/lib/upload-client";

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  name: string;
  label: string;
  value: string;
  /** 当前图片存储方案，决定上传走哪条路 */
  provider: ClientStorageProvider;
  /** 预览框的比例，favicon 用正方形，分享图用 1200×630 */
  ratio?: "square" | "wide";
  hint?: string;
  placeholder?: string;
  /** 值变化时通知外层表单，便于只提交改动过的字段 */
  onChange?: (url: string) => void;
};

export default function ImageField({
  name,
  label,
  value,
  provider,
  ratio = "square",
  hint,
  placeholder,
  onChange,
}: Props) {
  const t = useT();
  const inputId = useId();
  const [url, setUrlState] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const setUrl = (next: string) => {
    setUrlState(next);
    onChange?.(next);
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("只支持图片文件"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("图片过大，请压缩后再传"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      // 这里不压缩：favicon 要保持原格式，转成 webp 会让 Safari 认不出
      const url = await uploadImage(file, provider);
      setUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // 上传接口在错误末尾带了稳定的英文标记，不受界面语言影响
      if (msg.includes("[UNAUTHORIZED]")) {
        setError(t("登录已过期，请重新登录后再上传"));
      } else if (msg.includes("content type")) {
        setError(t("只支持图片文件"));
      } else if (msg.includes("too large")) {
        setError(t("图片过大，请压缩后再传"));
      } else {
        setError(msg.replace(/\s*\[[A-Z_]+\]\s*$/, "") || t("图片上传失败，请重试"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field image-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      {/* 右列容器：控件、说明、预览从上到下排，避免被栅格拆到左边去 */}
      <div className="image-field-body">
        <div className="image-field-row">
          <input
            id={inputId}
            name={name}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
          />
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? t("上传中…") : t("上传图片")}
          </button>
          {url && (
            <button
              className="btn btn-outline-light btn-plain"
              type="button"
              disabled={busy}
              onClick={() => setUrl("")}
            >
              {t("清除")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFile}
        />
        {hint && <span className="field-hint">{hint}</span>}
        {url && (
          <div className={`image-preview image-preview-${ratio}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />
          </div>
        )}
        {error && <span className="form-error">{error}</span>}
      </div>
    </div>
  );
}
