// Server-safe language settings: no React or i18next imports, so the root layout (a server component) can use them.
export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "bn", label: "বাংলা", short: "বাং" },
] as const
export type Lang = (typeof LANGUAGES)[number]["code"]

/** Cookie the root layout reads, so the server renders the staff member's language (no flash) */
export const LANG_COOKIE = "admin-lang"

export const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v)

// English uses en-GB: day-first dates ("25 Oct"), as written in Bangladesh
/** BCP 47 tag for Intl / toLocaleDateString in a language */
export const localeTag = (lng: string) => (lng === "bn" ? "bn-BD" : "en-GB")
