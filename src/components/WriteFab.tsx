"use client";

// 写文章悬浮按钮：右下角固定，圆形黑色，仅有笔图标（高频操作，单功能）
// 仅登录后显示；在 /write 页隐藏，避免误触
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n-provider";

export default function WriteFab({ visible }: { visible: boolean }) {
  const t = useT();
  const pathname = usePathname();

  if (!visible) return null;

  // 正在写文章时不需要这个按钮
  if (pathname === "/write" || pathname.startsWith("/write/")) {
    return null;
  }

  return (
    <Link href="/write" className="write-fab" aria-label={t("写文章")} title={t("写文章")}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </Link>
  );
}
