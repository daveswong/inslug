"use client";

import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { upload } from "@vercel/blob/client";
import type { Block, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

type Props = {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
};

// BlockNote 编辑器：内容一变就把当前块数组交给父组件，什么时候写库由父组件决定
export default function BlockEditor({ initialBlocks, onChange }: Props) {
  const [dark, setDark] = useState(false);
  // 注意：BlockNote 要求 initialContent 是非空数组，新建文章传 [] 会直接抛错。
  // 传 undefined 时它自己会生成一个空段落。
  const editor = useCreateBlockNote({
    initialContent:
      initialBlocks.length > 0 ? (initialBlocks as PartialBlock[]) : undefined,
    // 图片直传 Vercel Blob，数据库里只留 URL
    uploadFile: async (file: File) => {
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        return blob.url;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("登录")) throw new Error("登录已过期，请重新登录后再上传");
        if (msg.includes("content type")) throw new Error("只支持图片文件（jpg/png/webp/gif）");
        if (msg.includes("too large")) throw new Error("图片超过 10MB，请压缩后再传");
        throw new Error(msg || "图片上传失败，请重试");
      }
    },
  });

  // 跟随系统夜览模式，避免编辑器在深色页面里出现一整块白
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
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
