/**
 * Storefront templates the owner can pick (Online store > Template), saved as `onlineStore.themePreset`.
 *
 * Each template is a different store layout (header, home page, product card, product page, footer)
 * with its own colours and fonts. Mirrors aura-shop `src/templates` + `src/themes/index.ts` and the
 * backend list (StorefrontController::THEME_PRESETS). Here only what the gallery preview needs.
 */

import type { ParseKeys } from "i18next"

export type StoreThemeId = "editorial" | "market" | "luxe" | "single" | "fresh"

/** Translation key in the "store" namespace (lib/i18n/locales/en/store.ts), translated where rendered. */
export type StoreThemeKey = ParseKeys<["store"]>

export interface StoreThemePreview {
  id: StoreThemeId
  /** Keys, translated where rendered: t(theme.nameKey) */
  nameKey: StoreThemeKey
  descriptionKey: StoreThemeKey
  /** Who it suits */
  bestForKey: StoreThemeKey
  fonts: string
  /** CSS font-family stacks */
  display: string
  body: string
  /** HSL triplets, light mode */
  bg: string
  card: string
  fg: string
  muted: string
  primary: string
  primaryFg: string
  highlight: string
  highlightFg: string
  ink: string
  inkFg: string
  border: string
  tiles: [string, string, string, string]
  radius: string
  pill: string
}

export const DEFAULT_STORE_THEME: StoreThemeId = "editorial"

export const STORE_THEMES: StoreThemePreview[] = [
  {
    id: "editorial",
    nameKey: "store:template.themes.editorial.name",
    descriptionKey: "store:template.themes.editorial.description",
    bestForKey: "store:template.themes.editorial.bestFor",
    fonts: "Fraunces · DM Sans",
    display: "Fraunces, Georgia, serif",
    body: '"DM Sans", system-ui, sans-serif',
    bg: "0 0% 100%", card: "0 0% 100%", fg: "24 10% 10%", muted: "25 5% 45%",
    primary: "24 10% 10%", primaryFg: "0 0% 100%",
    highlight: "341 62% 36%", highlightFg: "0 0% 100%",
    ink: "24 10% 10%", inkFg: "0 0% 100%", border: "30 8% 90%",
    tiles: ["47 95% 76.5%", "158 55% 78%", "197.5 71% 78%", "346 85% 84%"],
    radius: "1rem", pill: "9999px",
  },
  {
    id: "market",
    nameKey: "store:template.themes.market.name",
    descriptionKey: "store:template.themes.market.description",
    bestForKey: "store:template.themes.market.bestFor",
    fonts: "Plus Jakarta Sans · Inter",
    display: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
    body: 'Inter, "Hind Siliguri", system-ui, sans-serif',
    bg: "220 33% 97%", card: "0 0% 100%", fg: "222 47% 11%", muted: "220 9% 44%",
    primary: "221 83% 53%", primaryFg: "0 0% 100%",
    highlight: "217 91% 55%", highlightFg: "0 0% 100%",
    ink: "222 47% 11%", inkFg: "0 0% 100%", border: "220 20% 90%",
    tiles: ["221 85% 95%", "199 85% 94%", "250 75% 96%", "165 55% 93%"],
    radius: "0.625rem", pill: "0.5rem",
  },
  {
    id: "luxe",
    nameKey: "store:template.themes.luxe.name",
    descriptionKey: "store:template.themes.luxe.description",
    bestForKey: "store:template.themes.luxe.bestFor",
    fonts: "Playfair Display · Inter",
    display: '"Playfair Display", Georgia, serif',
    body: 'Inter, system-ui, sans-serif',
    bg: "216 25% 97%", card: "0 0% 100%", fg: "217 47% 12%", muted: "215 16% 42%",
    primary: "175 76% 26%", primaryFg: "0 0% 100%",
    highlight: "40 70% 52%", highlightFg: "217 47% 12%",
    ink: "218 52% 11%", inkFg: "210 33% 96%", border: "215 22% 89%",
    tiles: ["213 27% 91%", "176 26% 89%", "40 45% 90%", "220 18% 90%"],
    radius: "0.75rem", pill: "0.5rem",
  },
  {
    id: "single",
    nameKey: "store:template.themes.single.name",
    descriptionKey: "store:template.themes.single.description",
    bestForKey: "store:template.themes.single.bestFor",
    fonts: "Fredoka · Nunito",
    display: 'Fredoka, "Hind Siliguri", system-ui, sans-serif',
    body: 'Nunito, "Hind Siliguri", system-ui, sans-serif',
    bg: "40 60% 98%", card: "0 0% 100%", fg: "248 38% 18%", muted: "248 12% 42%",
    primary: "252 58% 60%", primaryFg: "0 0% 100%",
    highlight: "346 70% 52%", highlightFg: "0 0% 100%",
    ink: "252 42% 24%", inkFg: "40 60% 98%", border: "250 30% 91%",
    tiles: ["252 85% 94%", "42 95% 90%", "158 52% 89%", "345 85% 93%"],
    radius: "1rem", pill: "9999px",
  },
  {
    id: "fresh",
    nameKey: "store:template.themes.fresh.name",
    descriptionKey: "store:template.themes.fresh.description",
    bestForKey: "store:template.themes.fresh.bestFor",
    fonts: "Outfit · Plus Jakarta Sans",
    display: 'Outfit, system-ui, sans-serif',
    body: '"Plus Jakarta Sans", system-ui, sans-serif',
    bg: "0 0% 100%", card: "0 0% 100%", fg: "160 22% 10%", muted: "150 6% 40%",
    primary: "142 70% 30%", primaryFg: "0 0% 100%",
    highlight: "21 90% 41%", highlightFg: "0 0% 100%",
    ink: "152 45% 13%", inkFg: "140 20% 96%", border: "140 12% 90%",
    tiles: ["28 100% 93%", "140 48% 91%", "212 75% 93%", "350 85% 94%"],
    radius: "0.75rem", pill: "0.5rem",
  },
]

export const isStoreThemeId = (v: unknown): v is StoreThemeId => STORE_THEMES.some((t) => t.id === v)

/** One stylesheet with every template's fonts, for the gallery previews. */
export const STORE_THEME_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "Fraunces:ital,opsz,wght@0,9..144,800;1,9..144,800",
    "DM+Sans:wght@400;600",
    "Inter:wght@400;600;700",
    "Plus+Jakarta+Sans:wght@400;600;700;800",
    "Playfair+Display:wght@600;700",
    "Fredoka:wght@600;700",
    "Nunito:wght@400;700",
    "Hind+Siliguri:wght@500;600",
    "Outfit:wght@600;700",
  ].map((f) => `family=${f}`).join("&") +
  "&display=swap"

/** Template content blocks (Online store > Template content). Mirrors aura-shop src/templates/shared/useTemplateContent.ts. */
export type TemplateBlock = "announcement" | "headerNote" | "promoTiles" | "stats" | "testimonials" | "newsletter" | "cta"

/** Blocks each template has a place for, and how many promo tiles it shows. Editorial uses none. */
export const TEMPLATE_BLOCKS: Record<StoreThemeId, { blocks: TemplateBlock[]; promoTiles?: { max: number; hintKey: StoreThemeKey } }> = {
  editorial: { blocks: [] },
  market: { blocks: ["announcement", "promoTiles", "stats", "testimonials", "newsletter"], promoTiles: { max: 3, hintKey: "store:template.promoHints.market" } },
  single: { blocks: ["announcement", "promoTiles", "testimonials", "newsletter"], promoTiles: { max: 4, hintKey: "store:template.promoHints.single" } },
  fresh: { blocks: ["announcement", "headerNote", "promoTiles", "newsletter"], promoTiles: { max: 5, hintKey: "store:template.promoHints.fresh" } },
  luxe: { blocks: ["stats", "cta"] },
}

/** Homepage section tabs a template has no place for. */
export const TEMPLATE_HIDDEN_SECTIONS: Record<StoreThemeId, ("lookbook" | "perks")[]> = {
  editorial: [],
  market: ["lookbook"],
  single: ["lookbook"],
  fresh: ["lookbook"],
  luxe: ["lookbook"],
}
