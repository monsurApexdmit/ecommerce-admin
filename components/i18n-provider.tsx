"use client"

import { useState, type ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { createI18n, type Lang } from "@/lib/i18n"

/** Language from the admin-lang cookie (read by the root layout) */
export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const [i18n] = useState(() => createI18n(lang))
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
