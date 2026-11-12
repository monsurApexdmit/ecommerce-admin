import { createInstance, type i18n as I18n } from "i18next"
import { initReactI18next } from "react-i18next"
import { NAMESPACES, resources } from "./resources"
import { LANGUAGES, LANG_COOKIE, type Lang } from "./config"

export * from "./config"

/** One instance per provider: safe on the server, where requests in different languages overlap */
export function createI18n(lng: Lang): I18n {
  const i18n = createInstance()
  void i18n.use(initReactI18next).init({
    resources,
    ns: NAMESPACES,
    defaultNS: "common",
    lng,
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false }, // React escapes
    initAsync: false, // resources are bundled: ready on the first render
    react: { useSuspense: false },
  })
  return i18n
}

/** Remember the staff member's pick for the next page load */
export function rememberLanguage(lng: Lang) {
  document.cookie = `${LANG_COOKIE}=${lng}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.lang = lng
}
