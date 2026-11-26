"use client";

import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import type { Block, PartialBlock } from "@blocknote/core";
import { prepareImage } from "@/lib/image-compress";
import { uploadImage, type ClientStorageProvider } from "@/lib/upload-client";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useT } from "@/components/i18n-provider";

type Props = {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  /** 图片存储方案，由服务端读配置后传下来 */
  storageProvider: ClientStorageProvider;
};

// 只保留排版类块。待办、折叠、音频、视频、文件是交互块，个人博客用不到，
// 留着只会让斜杠菜单变杂。
const blockSpecs = { ...defaultBlockSpecs };
for (const key of ["checkListItem", "toggleListItem", "audio", "video", "file"]) {
  delete (blockSpecs as Record<string, unknown>)[key];
}
const editorSchema = BlockNoteSchema.create({ blockSpecs });

// BlockNote 编辑器：内容一变就把当前块数组交给父组件，什么时候写库由父组件决定
export default function BlockEditor({
  initialBlocks,
  onChange,
  storageProvider,
}: Props) {
  const t = useT();
  const [dark, setDark] = useState(false);
  // 注意：BlockNote 要求 initialContent 是非空数组，新建文章传 [] 会直接抛错。
  // 传 undefined 时它自己会生成一个空段落。
  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent:
      initialBlocks.length > 0 ? (initialBlocks as PartialBlock[]) : undefined,
    // 图片按当前存储方案上传，数据库里只留 URL
    uploadFile: async (file: File) => {
      try {
        // 手机拍的大图先降采样/转 webp，再传
        const prepared = await prepareImage(file);
        return await uploadImage(prepared, storageProvider);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "IMAGE_TYPE_NOT_ALLOWED") throw new Error(t("只支持 jpg / png / webp / gif / avif / svg 图片"));
        if (msg === "IMAGE_TOO_LARGE_CLIENT") throw new Error(t("图片超过 10MB，请先压缩"));
        if (msg.includes("[UNAUTHORIZED]")) throw new Error(t("登录已过期，请重新登录后再上传"));
        if (msg.includes("[BAD_TYPE]")) throw new Error(t("只支持图片文件（jpg/png/webp/gif）"));
        if (msg.includes("[TOO_LARGE]")) throw new Error(t("图片超过 10MB，请压缩后再传"));
        if (msg.includes("content type")) throw new Error(t("只支持图片文件（jpg/png/webp/gif）"));
        if (msg.includes("too large")) throw new Error(t("图片超过 10MB，请压缩后再传"));
        throw new Error(msg || t("图片上传失败，请重试"));
      }
    },
  });

  // 跟随系统夜览模式，避免编辑器在深色页面里出现一整块白
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const explicit = document.documentElement.dataset.theme;
      setDark(explicit === "dark" || (explicit !== "light" && mq.matches));
    };
    apply();
    mq.addEventListener("change", apply);
    // 设置页手动切换外观时也要跟着变
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      mq.removeEventListener("change", apply);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="bn-editor-wrap"
      data-mantine-color-scheme={dark ? "dark" : "light"}
      data-bs-theme={dark ? "dark" : "light"}
    >
      <BlockNoteView
        editor={editor}
        theme={dark ? "dark" : "light"}
        onChange={() => onChange(editor.document)}
      />
    </div>
  );
}
