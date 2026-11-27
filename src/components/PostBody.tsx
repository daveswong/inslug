"use client";

import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

// 只读正文：把库里存的块原样渲染出来，不带工具栏、不可编辑
// BlockNote 依赖浏览器 API，必须等挂载后再创建编辑器，否则服务端渲染会报 window is not defined
export default function PostBody({ blocks }: { blocks: Block[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return <ReadonlyEditor blocks={blocks} />;
}

function ReadonlyEditor({ blocks }: { blocks: Block[] }) {
  const [dark, setDark] = useState(false);
  const editor = useCreateBlockNote({
    // BlockNote 的 initialContent 不能是空数组（传 [] 会抛错），
    // 空文章传 undefined，让它自己生成一个空段落。
    initialContent:
      blocks.length > 0 ? (blocks as PartialBlock[]) : undefined,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <div
      className="bn-readonly"
      data-mantine-color-scheme={dark ? "dark" : "light"}
      data-bs-theme={dark ? "dark" : "light"}
    >
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={dark ? "dark" : "light"}
      />
    </div>
  );
}
