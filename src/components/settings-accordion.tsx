"use client";

/**
 * 设置页用的折叠面板。
 *
 * 用的是 Bootstrap 折叠控件的类名（accordion / accordion-item / accordion-button /
 * accordion-collapse），展开状态由 React 管，不依赖 bootstrap 的 JS bundle——
 * 少一份几百 KB 的脚本，也不用担心脚本在客户端路由切换后没初始化。
 */
import { useState, type ReactNode } from "react";

export type AccordionItem = {
  id: string;
  title: string;
  /** 折叠状态下在标题右边显示的一行摘要 */
  summary?: string;
  children: ReactNode;
};

export default function SettingsAccordion({
  items,
  defaultOpen = [],
}: {
  items: AccordionItem[];
  /** 默认展开哪几项 */
  defaultOpen?: string[];
}) {
  const [open, setOpen] = useState<string[]>(defaultOpen);

  const toggle = (id: string) =>
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );

  return (
    <div className="accordion settings-accordion">
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        return (
          <div className="accordion-item" key={item.id}>
            <h2 className="accordion-header">
              <button
                type="button"
                className={`accordion-button${isOpen ? "" : " collapsed"}`}
                aria-expanded={isOpen}
                onClick={() => toggle(item.id)}
              >
                <span className="accordion-title">{item.title}</span>
                {item.summary && (
                  <span className="accordion-summary">{item.summary}</span>
                )}
              </button>
            </h2>
            <div className={`accordion-collapse collapse${isOpen ? " show" : ""}`}>
              <div className="accordion-body">{item.children}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
