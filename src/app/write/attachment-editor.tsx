"use client";

/**
 * 文章附件的编辑区。
 *
 * 附件不限文件类型（PDF、STEP、DXF、ZIP……都能传），单个最大 50MB。
 * 上传走现有的可插拔存储，跟图片同一套。
 *
 * 状态由父组件持有：附件列表要跟着文章一起存，编辑时不能丢。
 */
import { useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { uploadFile, type ClientStorageProvider } from "@/lib/upload-client";
import type { Attachment } from "@/lib/types";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

type Props = {
  attachments: Attachment[];
  provider: ClientStorageProvider;
  onChange: (next: Attachment[]) => void;
};

export default function AttachmentEditor({
  attachments,
  provider,
  onChange,
}: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setError(t("附件太大，单个不能超过 50MB"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const url = await uploadFile(file, provider, "attachment");
      onChange([
        ...attachments,
        {
          name: file.name,
          url,
          size: file.size,
          type: file.type || "application/octet-stream",
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("[UNAUTHORIZED]")) {
        setError(t("登录已过期，请重新登录后再上传"));
      } else if (msg.includes("[TOO_LARGE]")) {
        setError(t("附件太大，单个不能超过 50MB"));
      } else {
        setError(msg.replace(/\s*\[[A-Z_]+\]\s*$/, "") || t("上传失败，请重试"));
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) =>
    onChange(attachments.filter((_, i) => i !== index));

  return (
    <div className="attachment-editor">
      <div className="attachment-editor-head">
        <span className="write-meta-label">{t("附件")}</span>
        <span className="write-meta-hint">
          {t("不限文件类型，单个最大 50MB。文章末尾会列出这些文件供下载。")}
        </span>
      </div>

      {attachments.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((item, index) => (
            <li key={`${item.url}-${index}`}>
              <span className="attachment-name">{item.name}</span>
              <button
                type="button"
                className="attachment-remove"
                onClick={() => remove(index)}
                aria-label={t("删除附件 {name}", { name: item.name })}
              >
                {t("删除")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="attachment-editor-actions">
        <button
          type="button"
          className="btn btn-outline-light btn-plain"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? t("上传中…") : t("上传附件")}
        </button>
        {error && <span className="form-error">{error}</span>}
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={onPick}
      />
    </div>
  );
}
