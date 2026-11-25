"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Block } from "@blocknote/core";
import type { Visibility } from "@/lib/types";
import { deletePostAction, savePost } from "./actions";

// BlockNote 依赖浏览器 API，关闭 SSR
const BlockEditor = dynamic(() => import("@/components/BlockEditor"), {
  ssr: false,
  loading: () => <div className="notice">编辑器加载中…</div>,
});

type Props = {
  slug: string | null;
  initialTitle: string;
  initialTags: string[];
  initialBlocks: Block[];
  initialVisibility: Visibility;
  availableTags: string[];
};

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "public", label: "公开" },
  { value: "private", label: "私有" },
  { value: "draft", label: "草稿" },
];

export default function WriteClient({
  slug,
  initialTitle,
  initialTags,
  initialBlocks,
  initialVisibility,
  availableTags,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags);
  const [tagOptions, setTagOptions] = useState(availableTags);
  const [newTag, setNewTag] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hint, setHint] = useState("");

  // 正文块只在保存时取一次，避免每次输入都触发父组件重渲染
  const blocksRef = useRef<Block[]>(initialBlocks);

  const toggleTag = (tag: string) => {
    setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    if (!tagOptions.includes(name)) setTagOptions([...tagOptions, name]);
    if (!tags.includes(name)) setTags([...tags, name]);
    setNewTag("");
  };

  // 按钮文案跟着可见性走，一眼能看出这次保存会得到什么状态
  const saveLabel =
    visibility === "draft" ? "保存草稿" : visibility === "private" ? "保存为私有" : "发布";

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setHint("保存中…");
    const result = await savePost({
      slug,
      title,
      blocks: blocksRef.current,
      tags,
      visibility,
    });
    if (!result.ok) {
      setSaving(false);
      setHint(result.error);
      return;
    }
    // 保存成功就离开编辑页，直接看文章的实际效果
    // 这里故意不解除 saving，避免跳转前重复提交
    router.push(`/posts/${result.slug}`);
  };

  const handleDelete = async () => {
    if (!slug || deleting) return;
    // 删除不可撤销，必须先明确确认
    if (!window.confirm("确定删除这篇文章？删除后无法恢复。")) return;
    setDeleting(true);
    setHint("删除中…");
    const result = await deletePostAction(slug);
    if (!result.ok) {
      setDeleting(false);
      setHint(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <div className="write-bar">
        <a href={slug ? `/posts/${slug}` : "/"}>← 返回</a>
        <span className="notice">{slug ? "编辑文章" : "新建文章"}</span>
        <span className="write-save-hint">{hint}</span>
      </div>

      <input
        className="write-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="文章标题"
        aria-label="文章标题"
      />

      <div className="write-tags">
        <div className="tag-list">
          {tagOptions.map((tag) => (
            <button
              type="button"
              key={tag}
              className={`tag-chip ${tags.includes(tag) ? "selected" : ""}`}
              aria-pressed={tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="write-tag-add">
          <input
            className="search-input"
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="新建标签后回车"
            aria-label="新建标签"
          />
          <button className="btn btn-outline-light btn-plain" type="button" onClick={addTag}>
            添加
          </button>
        </div>
      </div>

      <div className="write-editor">
        <BlockEditor
          initialBlocks={initialBlocks}
          onChange={(blocks) => {
            blocksRef.current = blocks;
          }}
        />
      </div>

      {/* 先选可见性，按钮在它下面（都靠左），按钮文案跟着可见性变 */}
      <div className="write-actions">
        <div className="write-meta">
          <span className="write-meta-label">可见性</span>
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`visibility-option ${
                visibility === option.value ? "selected" : ""
              }`}
              aria-pressed={visibility === option.value}
              onClick={() => setVisibility(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-outline-light btn-plain"
          type="button"
          disabled={saving}
          onClick={handleSave}
        >
          {saveLabel}
        </button>
        {slug && (
          <button
            className="btn btn-outline-light btn-plain"
            type="button"
            disabled={saving || deleting}
            onClick={handleDelete}
          >
            删除这篇文章
          </button>
        )}
      </div>
    </>
  );
}
