import type { Block } from "@blocknote/core";

export type Visibility = "draft" | "private" | "public";

/**
 * 文章附件。
 *
 * 正文里插不了附件块（编辑器只管排版），所以附件单独存一份，
 * 文章末尾按列表渲染给访客下载。
 */
export interface Attachment {
  /** 上传时的原始文件名，下载时显示用 */
  name: string;
  /** 存储里的地址 */
  url: string;
  /** 字节数 */
  size: number;
  /** MIME 类型。浏览器给什么就是什么，不准也没关系 */
  type: string;
}

export interface PostDoc {
  _id?: unknown;
  slug: string;
  title: string;
  blocks: Block[];
  plainText: string;
  tags: string[];
  visibility: Visibility;
  /** 置顶：排在这条时间线的最前面，方便别人找到 */
  pinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** 文章末尾的附件列表。没有附件时是空数组 */
  attachments: Attachment[];
}

export interface TagDoc {
  _id?: unknown;
  name: string;
  createdAt: Date;
}

/** 一条社交链接：标题和网址都由站长自己填，不再固定 GitHub / X / Email */
export interface SocialLink {
  title: string;
  url: string;
}

export type SocialLinks = SocialLink[];

export interface SettingsDoc {
  _id: "site";
  siteName: string;
  description: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  social: SocialLinks;
  favicon: string;
  ogImage: string;
  footerText: string;
  postsPerPage: number;
  /** 接收「更换 / 解绑验证器」确认邮件的地址；为空则这类操作整体禁用 */
  notifyEmail: string;
  /** 首次安装向导是否走完。老文档缺字段时按 false 处理 */
  setupCompleted: boolean;
  /** 界面语言：zh-CN / en；空字符串表示用默认（环境变量或本地配置） */
  uiLanguage: string;
  updatedAt: Date;
}

export const DEFAULT_SETTINGS: Omit<SettingsDoc, "updatedAt"> = {
  _id: "site",
  siteName: "inslug",
  description: "",
  author: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  social: [],
  favicon: "",
  ogImage: "",
  footerText: "",
  postsPerPage: 20,
  notifyEmail: "",
  setupCompleted: false,
  uiLanguage: "",
};
