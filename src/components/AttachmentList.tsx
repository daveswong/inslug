import { attachmentDownloadUrl } from "@/lib/attachment-url";
import type { ClientStorageProvider } from "@/lib/upload-client";
import type { Attachment } from "@/lib/types";

/**
 * 附件地址要不要渲染。
 *
 * 保存时已经校验过一遍，但渲染这层再挡一次：
 * 万一库里的数据被改坏（或将来出了别的写入路径），
 * 也不至于渲染出 javascript:、data: 这类能执行脚本的链接。
 */
function safeUrl(url: string): boolean {
  if (!url) return false;
  // 站内路径，且不能是协议相对 URL（//evil.com）
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  return /^https?:\/\//i.test(url);
}

/**
 * 文章末尾的附件列表。
 *
 * 就是一列下载链接，不多渲染任何东西。
 *
 * 链接统一强制下载（attachmentDownloadUrl）——
 * 附件可能是 HTML、SVG 这类浏览器会直接渲染的类型，
 * 在自己域名下渲染访客带来的文件等于把会话交出去。
 */
export default function AttachmentList({
  attachments,
  provider,
}: {
  attachments: Attachment[];
  provider: ClientStorageProvider;
}) {
  if (!attachments || attachments.length === 0) return null;

  const items = attachments.filter((item) => safeUrl(item.url));
  if (items.length === 0) return null;

  return (
    <ul className="attachment-list">
      {items.map((item, index) => (
        <li key={`${item.url}-${index}`}>
          <a
            href={attachmentDownloadUrl(item.url, item.name, provider)}
            download={item.name}
          >
            {item.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
