"use client";

// 把服务端读到的语言包交给客户端组件。client 组件用 useT() 拿翻译函数。
import { createContext, useContext } from "react";
import { render, type Dictionary, type Translate } from "@/lib/i18n-core";

const I18nContext = createContext<Translate>((key) => key);

export function I18nProvider({
  dict,
  children,
}: {
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const t: Translate = (key, vars) => render(dict, key, vars);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return useContext(I18nContext);
}
