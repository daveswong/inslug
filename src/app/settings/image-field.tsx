"use client";

/**
 * 设置页的图片字段：可以手填地址，也可以直接上传（直传 Vercel Blob），并显示预览。
 *
 * 名字仍然是 name，所以外层表单的 server action 不用改。
 */
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useT } from "@/components/i18n-provider";

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  name: string;
  label: string;
  value: string;
  /** 预览框的比例，favicon 用正方形，分享图用 1200×630 */
  ratio?: "square" | "wide";
  hint?: string;
  placeholder?: string;
};

export default function ImageField({
  name,
  label,
  value,
  ratio = "square",
  hint,
  placeholder,
}: Props) {
  const t = useT();
  const [url, setUrl] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setUrl(blob.url);
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
      <span className="field-label">{label}</span>
      {/* 右列容器：控件、说明、预览从上到下排，避免被栅格拆到左边去 */}
      <div className="image-field-body">
        <div className="image-field-row">
          <input
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
