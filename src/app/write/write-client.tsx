"use client";

import type { ClientStorageProvider } from "@/lib/upload-client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Block } from "@blocknote/core";
import type { Visibility } from "@/lib/types";
import { deletePostAction, savePost } from "./actions";
import { useT } from "@/components/i18n-provider";

type Props = {
  slug: string | null;
  initialTitle: string;
  initialTags: string[];
  initialBlocks: Block[];
  initialVisibility: Visibility;
  initialPinned: boolean;
  availableTags: string[];
  storageProvider: ClientStorageProvider;
  siteOrigin: string;
  /** 自动暂存间隔（分钟），由站点设置统一配置；0 表示关闭 */
  autosaveMinutes: number;
};

type Draft = {
  title: string;
  blocks: Block[];
  tags: string[];
  visibility: Visibility;
  pinned: boolean;
  slugInput: string;
  savedAt: number;
};

const draftKeyFor = (slug: string | null) => `inslog:autosave:${slug ?? "new"}`;

export default function WriteClient({
  slug,
  initialTitle,
  initialTags,
  initialBlocks,
  initialVisibility,
  initialPinned,
  availableTags,
  storageProvider,
  siteOrigin,
  autosaveMinutes,
}: Props) {
  const t = useT();
  // BlockNote 依赖浏览器 API，关闭 SSR。
  // 关键：dynamic 要缓存，不能在每次渲染时重新构造，否则下面任何 input 的
  // setState 重渲染都会让编辑器被当成新组件卸载重挂载，表现为「每敲一个字闪一下」。
  const BlockEditor = useMemo(
    () =>
      dynamic(() => import("@/components/BlockEditor"), {
        ssr: false,
        loading: () => <div className="notice">{t("编辑器加载中…")}</div>,
      }),
    [t]
  );
  const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
    { value: "public", label: t("公开") },
    { value: "private", label: t("私有") },
    { value: "draft", label: t("草稿") },
  ];
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags);
  const [tagOptions, setTagOptions] = useState(availableTags);
  const [newTag, setNewTag] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [pinned, setPinned] = useState(initialPinned);
  // 编辑时预填当前地址，留空表示让系统自动生成（新建）或保持原样（编辑）
  const [slugInput, setSlugInput] = useState(slug ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hint, setHint] = useState("");

  // 自动暂存：间隔由站点设置统一下发；草稿只存在本机浏览器，不进数据库、不回显给服务器
  const autosaveMin = Math.max(0, Math.floor(autosaveMinutes || 0));
  const [restoredDraft, setRestoredDraft] = useState<Draft | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const [editorInitialBlocks, setEditorInitialBlocks] = useState(initialBlocks);

  // 正文块只在保存时取一次，避免每次输入都触发父组件重渲染
  const blocksRef = useRef<Block[]>(initialBlocks);
  const draftKey = draftKeyFor(slug);

  // 草稿里要存的最新值：正文放 ref，其它字段每次渲染同步进去
  const draftValues = useRef({ title, tags, visibility, pinned, slugInput });
  draftValues.current = { title, tags, visibility, pinned, slugInput };

  useEffect(() => {
    // 只在挂载时看一次草稿；有草稿就提示，绝不自动覆盖当前内容
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft;
        if (parsed && (parsed.title?.trim() || parsed.blocks?.length)) {
          setRestoredDraft(parsed);
        }
      }
    } catch {
      // 坏数据直接忽略，不打断写作
    }
  }, [draftKey]);

  // 定时写草稿：填 0 表示关闭；有草稿待处理时暂停，免得覆盖掉它
  useEffect(() => {
    if (autosaveMin <= 0 || restoredDraft) return;
    const id = window.setInterval(() => {
      const v = draftValues.current;
      const draft: Draft = {
        title: v.title,
        blocks: blocksRef.current,
        tags: v.tags,
        visibility: v.visibility,
        pinned: v.pinned,
        slugInput: v.slugInput,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // 存不进去就静默跳过，不打扰写作
      }
    }, autosaveMin * 60 * 1000);
    return () => window.clearInterval(id);
  }, [autosaveMin, draftKey, restoredDraft]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // 忽略
    }
  };

  const restoreDraft = () => {
    if (!restoredDraft) return;
    setTitle(restoredDraft.title ?? "");
    setTags(Array.isArray(restoredDraft.tags) ? restoredDraft.tags : []);
    setVisibility(restoredDraft.visibility ?? "draft");
    setPinned(Boolean(restoredDraft.pinned));
    setSlugInput(restoredDraft.slugInput ?? "");
    blocksRef.current = restoredDraft.blocks ?? [];
    // BlockEditor 只在挂载时读 initialContent，换 key 强制重建才能灌入草稿正文
    setEditorInitialBlocks(restoredDraft.blocks ?? []);
    setEditorKey((k) => k + 1);
    setRestoredDraft(null);
  };

  const discardDraft = () => {
    clearDraft();
    setRestoredDraft(null);
  };

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
    visibility === "draft" ? t("保存草稿") : visibility === "private" ? t("保存为私有") : t("发布");

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setHint(t("保存中…"));
    const result = await savePost({
      slug,
      customSlug: slugInput,
      title,
      blocks: blocksRef.current,
      tags,
      visibility,
      pinned,
    });
    if (!result.ok) {
      setSaving(false);
      setHint(result.error);
      return;
    }
    // 保存成功就清掉本机草稿，免得下次进来又提示恢复旧内容
    clearDraft();
    // 保存成功就离开编辑页，直接看文章的实际效果
    // 这里故意不解除 saving，避免跳转前重复提交
    router.push(`/posts/${result.slug}`);
  };

  const handleDelete = async () => {
    if (!slug || deleting) return;
    // 删除不可撤销，必须先明确确认
    if (!window.confirm(t("确定删除这篇文章？删除后无法恢复。"))) return;
    setDeleting(true);
    setHint(t("删除中…"));
    const result = await deletePostAction(slug);
    if (!result.ok) {
      setDeleting(false);
      setHint(result.error);
      return;
    }
    clearDraft();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <div className="write-bar d-flex align-items-baseline">
        <a href={slug ? `/posts/${slug}` : "/"}>{t("← 返回")}</a>
        <span className="notice">{slug ? t("编辑文章") : t("新建文章")}</span>
      </div>

      {restoredDraft && (
        <div className="write-meta d-flex flex-wrap align-items-baseline">
          <span className="write-meta-label">
            {t("发现 {time} 的暂存草稿", {
              time: new Date(restoredDraft.savedAt).toLocaleString(),
            })}
          </span>
          <button type="button" className="visibility-option selected" onClick={restoreDraft}>
            {t("恢复")}
          </button>
          <button type="button" className="visibility-option" onClick={discardDraft}>
            {t("丢弃")}
          </button>
        </div>
      )}

      <input
        className="write-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("文章标题")}
        aria-label={t("文章标题")}
      />

      <div className="write-tags">
        <div className="tag-list d-flex flex-wrap">
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
        <div className="write-tag-add d-flex align-items-baseline">
          <input
            className="write-tag-input"
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={t("新建标签后回车")}
            aria-label={t("新建标签")}
          />
          <button className="write-tag-add-btn" type="button" onClick={addTag}>
            {t("添加")}
          </button>
        </div>
      </div>

      <div className="write-editor">
        <BlockEditor
          key={editorKey}
          storageProvider={storageProvider}
          initialBlocks={editorInitialBlocks}
          onChange={(blocks) => {
            blocksRef.current = blocks;
          }}
        />
      </div>

      {/* 先选可见性，按钮在它下面（都靠左），按钮文案跟着可见性变 */}
      <div className="write-actions d-flex flex-column align-items-start">
        <div className="write-meta d-flex flex-wrap align-items-baseline">
          <span className="write-meta-label">{t("可见性")}</span>
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
        <div className="write-meta d-flex flex-wrap align-items-baseline">
          <label className="pin-toggle d-inline-flex align-items-center">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            <span>{t("置顶")}</span>
          </label>
          <span className="write-meta-hint">{t("置顶的文章排在列表最前面")}</span>
        </div>
        <div className="write-meta d-flex flex-wrap align-items-baseline">
          <span className="write-meta-label">{t("文章地址")}</span>
          <span className="write-slug-field d-inline-flex align-items-baseline">
            <span className="write-slug-prefix">{siteOrigin}/posts/</span>
            <input
              id="post-slug"
              className="write-slug-input"
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder={t("留空自动生成")}
              aria-label={t("文章地址")}
            />
          </span>
          <span className="write-meta-hint">{t("只能用小写字母、数字和连字符，中文会自动转拼音")}</span>
        </div>
        <div className="write-action-row d-flex flex-wrap align-items-center">
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
              className="write-delete-link"
              type="button"
              disabled={saving || deleting}
              onClick={handleDelete}
            >
              {t("删除这篇文章")}
            </button>
          )}
        </div>
        {hint && <div className="write-save-hint">{hint}</div>}
      </div>
    </>
  );
}
