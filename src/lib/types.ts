import type { Block } from "@blocknote/core";

export type Visibility = "draft" | "private" | "public";

export interface PostDoc {
  _id?: unknown;
  slug: string;
  title: string;
  blocks: Block[];
  plainText: string;
  tags: string[];
  visibility: Visibility;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagDoc {
  _id?: unknown;
  name: string;
  createdAt: Date;
}

export interface SocialLinks {
  github?: string;
  x?: string;
  email?: string;
}

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
  social: {},
  favicon: "",
  ogImage: "",
  footerText: "",
  postsPerPage: 20,
  notifyEmail: "",
  setupCompleted: false,
};
