"use client"

import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STORE_THEMES, STORE_THEME_FONTS_HREF, type StoreThemeId, type StoreThemePreview } from "@/lib/storeThemes"
import { cn } from "@/lib/utils"

export type ColorSource = "theme" | "brand"

export interface BrandColors {
  primaryColor: string
  accentColor: string
  backgroundColor: string
}

interface Props {
  theme: StoreThemeId
  onTheme: (id: StoreThemeId) => void
  colorSource: ColorSource
  onColorSource: (v: ColorSource) => void
  /** Accent colour hex, or "" for the template's own */
  accent: string
  onAccent: (hex: string) => void
  /** [hex, label] — the label is already translated */
  accents: [string, string][]
  /** Company settings brand colours, or null when none are saved */
  brand: BrandColors | null
}

const hsl = (v: string) => `hsl(${v})`

/** Gallery of storefront templates, each with a miniature of its real layout, plus colour and accent choice. */
export function StorefrontThemePicker({ theme, onTheme, colorSource, onColorSource, accent, onAccent, accents, brand }: Props) {
  const { t: tr } = useTranslation(["store", "common"])
  useEffect(() => {
    if (document.getElementById("store-theme-preview-fonts")) return
    const link = document.createElement("link")
    link.id = "store-theme-preview-fonts"
    link.rel = "stylesheet"
    link.href = STORE_THEME_FONTS_HREF
    document.head.appendChild(link)
  }, [])

  const usingBrand = colorSource === "brand" && !!brand

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label={tr("store:template.group")} className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {STORE_THEMES.map((t) => {
          const selected = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onTheme(t.id)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary ring-2 ring-primary" : "hover:shadow-md",
              )}
            >
              <span aria-hidden="true" className="relative block h-[188px] overflow-hidden border-b" style={{ background: hsl(t.bg), color: hsl(t.fg), fontFamily: t.body }}>
                <Preview t={t} accent={!usingBrand && accent ? accent : null} />
              </span>
              <span className="flex flex-1 items-start justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{tr(t.nameKey)}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{tr(t.descriptionKey)}</span>
                  <span className="mt-1.5 block text-[11px] font-medium text-foreground/70">{tr("store:template.bestFor", { text: tr(t.bestForKey) })}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{t.fonts}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{tr("store:template.colours")}</p>
        <div role="group" aria-label={tr("store:template.colours")} className="flex flex-wrap gap-2">
          <Button type="button" size="sm" aria-pressed={!usingBrand} variant={!usingBrand ? "default" : "outline"} onClick={() => onColorSource("theme")}>
            {tr("store:template.templateColours")}
          </Button>
          <Button type="button" size="sm" aria-pressed={usingBrand} variant={usingBrand ? "default" : "outline"} disabled={!brand} onClick={() => onColorSource("brand")}>
            {brand && (
              <span className="flex -space-x-1" aria-hidden="true">
                {[brand.backgroundColor, brand.primaryColor, brand.accentColor].map((c, i) => (
                  <span key={i} className="size-3.5 rounded-full ring-1 ring-border" style={{ background: c }} />
                ))}
              </span>
            )}
            {tr("store:template.brandColours")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {!brand
            ? tr("store:template.hintNoBrand")
            : usingBrand
              ? tr("store:template.hintBrand")
              : tr("store:template.hintTheme")}
        </p>
      </div>

      {!usingBrand && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{tr("store:template.accent")}</p>
          <div role="group" aria-label={tr("store:template.accentGroup")} className="flex flex-wrap gap-2">
            <Button type="button" size="sm" aria-pressed={!accent} variant={!accent ? "default" : "outline"} onClick={() => onAccent("")}>
              {tr("store:template.templatesOwn")}
            </Button>
            {accents.map(([color, label]) => (
              <Button key={color} type="button" size="sm" aria-pressed={accent === color} variant={accent === color ? "default" : "outline"} onClick={() => onAccent(color)}>
                <span className="size-4 rounded-full" style={{ background: color }} />
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{tr("store:template.accentHint")}</p>
        </div>
      )}
    </div>
  )
}

/** Miniature of each template's real home page layout, in its own colours and fonts. */
function Preview({ t, accent }: { t: StoreThemePreview; accent: string | null }) {
  const hl = accent ?? hsl(t.highlight)
  const hlFg = accent ? "#fff" : hsl(t.highlightFg)
  const display = { fontFamily: t.display } as const
  const bar = (w: string, o = 0.18) => <span className="block h-1 rounded-full" style={{ width: w, background: hsl(t.fg), opacity: o }} />

  switch (t.id) {
    case "market":
      return (
        <span className="flex h-full flex-col text-[7px]" style={{ background: hsl(t.bg) }}>
          <span className="block h-1.5" style={{ background: hsl(t.primary) }} />
          <span className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: hsl(t.card) }}>
            <b style={{ ...display, color: hsl(t.fg) }} className="text-[9px]">Aura<span style={{ color: hsl(t.primary) }}>Tech</span></b>
            <span className="flex h-3.5 flex-1 items-center justify-end overflow-hidden" style={{ border: `1px solid ${hsl(t.border)}`, borderRadius: t.pill }}>
              <span className="flex h-full w-4 items-center justify-center text-[6px]" style={{ background: hsl(t.primary), color: hsl(t.primaryFg) }}>⌕</span>
            </span>
            <span className="size-3 rounded" style={{ background: hsl(t.primary) }} />
          </span>
          <span className="flex gap-1.5 px-2 pb-1 text-[5px]" style={{ background: hsl(t.card), borderBottom: `1px solid ${hsl(t.border)}`, color: hsl(t.muted) }}>
            <span>Laptops</span><span>Audio</span><span>Gaming</span><span style={{ color: "hsl(0 80% 55%)" }}>Deals</span>
          </span>
          <span className="mx-2 mt-1.5 grid grid-cols-[1fr_44px] items-center gap-1.5 rounded-md p-1.5" style={{ background: hsl(t.tiles[0]) }}>
            <span className="flex flex-col gap-0.5">
              <b style={{ ...display, color: hsl(t.fg) }} className="text-[10px] leading-tight">Play without limits</b>
              <span className="self-start rounded px-1 text-[5px]" style={{ background: hsl(t.primary), color: hsl(t.primaryFg) }}>Shop now →</span>
            </span>
            <span className="h-8 rounded" style={{ background: `linear-gradient(135deg, hsl(${t.ink}), hsl(${t.primary}))` }} />
          </span>
          <span className="mt-1.5 grid grid-cols-4 gap-1 px-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="relative flex flex-col gap-[2px] rounded p-[3px]" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}` }}>
                <span className="block h-5 rounded-sm" style={{ background: hsl(t.tiles[(i + 1) % 4]) }} />
                {i % 2 === 0 && <span className="absolute left-1 top-1 rounded-sm px-0.5 text-[4px] text-white" style={{ background: "hsl(0 80% 55%)" }}>-10%</span>}
                <span className="text-[5px]" style={{ color: "hsl(38 92% 50%)" }}>★★★★★</span>
                <b style={{ color: hsl(t.fg) }}>${[899, 129, 99, 494][i]}</b>
              </span>
            ))}
          </span>
        </span>
      )

    case "luxe":
      return (
        <span className="flex h-full flex-col text-[7px]" style={{ background: hsl(t.bg) }}>
          <span className="flex items-center justify-between px-2 py-1" style={{ background: hsl(t.card) }}>
            <b style={display} className="text-[9px]">⌂ Aura Homes</b>
            <span className="px-1.5 py-[1px] text-[5px] font-semibold" style={{ background: hsl(t.primary), color: hsl(t.primaryFg), borderRadius: t.pill }}>Browse</span>
          </span>
          <span className="relative flex h-[58px] flex-col justify-center px-2.5" style={{ background: `linear-gradient(120deg, hsl(${t.ink}), hsl(${t.ink} / 0.75)), linear-gradient(hsl(${t.tiles[0]}), hsl(${t.tiles[0]}))`, color: hsl(t.inkFg) }}>
            <span className="self-start rounded-full px-1 text-[4px] font-semibold" style={{ background: hsl(t.highlight), color: hsl(t.highlightFg) }}>FIND YOUR HOME</span>
            <span style={display} className="mt-0.5 text-[11px] leading-tight">Find a place you<br />will love</span>
            <span className="mt-1 flex h-2.5 w-3/4 items-center justify-end rounded-sm pr-0.5" style={{ background: hsl(t.card) }}>
              <span className="h-1.5 w-3 rounded-sm" style={{ background: hsl(t.primary) }} />
            </span>
          </span>
          <span className="-mt-1.5 grid grid-cols-4 gap-1 px-2">
            {["36+", "8", "120+", "14+"].map((v) => (
              <span key={v} className="rounded-sm px-1 py-0.5 text-[6px] font-semibold" style={{ ...display, background: hsl(t.card), border: `1px solid ${hsl(t.border)}` }}>{v}</span>
            ))}
          </span>
          <span className="mt-1.5 grid grid-cols-3 gap-1 px-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col overflow-hidden rounded-sm" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}` }}>
                <span className="relative block h-6" style={{ background: hsl(t.tiles[(i + 1) % 4]) }}>
                  <b className="absolute bottom-0.5 left-0.5 text-[6px]" style={{ color: hsl(t.fg) }}>{["$1.18M", "$18.9k", "$4.8k"][i]}</b>
                </span>
                <span className="px-0.5 text-[4px] font-semibold" style={{ color: hsl(t.primary) }}>HOUSE</span>
                <span className="px-0.5 pb-0.5 text-[4px]" style={{ color: hsl(t.muted) }}>🛏 4 · 🛁 3 · 310 m²</span>
              </span>
            ))}
          </span>
        </span>
      )

    case "single":
      return (
        <span className="flex h-full flex-col text-[7px]" style={{ background: hsl(t.bg) }}>
          <span className="block h-1.5" style={{ background: hsl(t.primary) }} />
          <span className="flex items-center gap-1.5 px-2 py-1">
            <b style={display} className="text-[10px]">
              {"KIDDO".split("").map((c, i) => <span key={i} style={{ color: [hsl(t.primary), hl, "hsl(40 95% 50%)", "hsl(158 55% 40%)", hsl(t.primary)][i] }}>{c}</span>)}
            </b>
            <span className="flex h-3.5 flex-1 items-center justify-end rounded-full pr-0.5" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}` }}>
              <span className="size-2.5 rounded-full" style={{ background: hsl(t.primary) }} />
            </span>
          </span>
          <span className="mx-2 grid grid-cols-[1fr_40px] items-center gap-1.5 rounded-lg p-1.5" style={{ background: "hsl(343 80% 92%)", borderTop: "2px dotted hsl(343 80% 85%)", borderBottom: "2px dotted hsl(343 80% 85%)" }}>
            <span className="flex flex-col gap-0.5">
              <b style={{ ...display, color: hsl(t.fg) }} className="text-[10px] leading-tight">Play that <span style={{ color: hl }}>grows</span></b>
              <span className="self-start rounded-full px-1.5 text-[5px] font-semibold" style={{ background: hsl(t.primary), color: hsl(t.primaryFg) }}>Shop toys →</span>
            </span>
            <span className="relative h-8 rounded-md" style={{ background: hsl(t.tiles[1]) }}>
              <span className="absolute -right-1 -top-1 size-3 rounded-full" style={{ background: hsl(t.primary) }} />
            </span>
          </span>
          <span className="mt-1.5 flex justify-between px-2">
            {[0, 1, 2, 3, 0, 1].map((k, i) => <span key={i} className="size-4 rounded-full" style={{ background: hsl(t.tiles[k]) }} />)}
          </span>
          <span className="mt-1.5 grid grid-cols-4 gap-1 px-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex flex-col gap-[2px] p-[3px]" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}`, borderRadius: `calc(${t.radius} * 0.5)` }}>
                <span className="block h-5 rounded" style={{ background: hsl(t.tiles[(i + 2) % 4]) }} />
                <b style={{ color: hsl(t.fg) }}>${[29, 24, 17, 44][i]}</b>
              </span>
            ))}
          </span>
        </span>
      )

    case "fresh":
      return (
        <span className="flex h-full flex-col text-[7px]" style={{ background: hsl(t.bg) }}>
          <span className="block h-1.5" style={{ background: hsl(t.primary) }} />
          <span className="flex items-center gap-1.5 px-2 py-1">
            <b style={display} className="text-[9px]"><span style={{ color: hsl(t.fg) }}>Aura</span> <span style={{ color: hsl(t.primary) }}>Mart</span></b>
            <span className="flex h-3.5 flex-1 items-center justify-end overflow-hidden" style={{ border: `1px solid ${hsl(t.border)}`, borderRadius: t.pill }}>
              <span className="h-full w-4" style={{ background: hsl(t.primary) }} />
            </span>
          </span>
          <span className="flex gap-1.5 px-2 pb-1 text-[5px]" style={{ borderBottom: `1px solid ${hsl(t.border)}` }}>
            <span className="rounded px-1" style={{ background: hsl(t.primary), color: hsl(t.primaryFg) }}>All categories</span>
            <span>Bakery</span><span>Dairy</span><span style={{ color: hl }}>Weekly deals</span>
          </span>
          <span className="mt-1.5 grid grid-cols-[1fr_36px] gap-1 px-2">
            <span className="flex h-12 flex-col justify-center rounded-md px-1.5" style={{ background: `linear-gradient(90deg, hsl(${t.ink}), hsl(${t.ink} / 0.6))`, color: hsl(t.inkFg) }}>
              <b style={display} className="text-[9px] leading-tight">Baked this morning</b>
              <span className="mt-0.5 self-start rounded px-1 text-[5px]" style={{ background: hl, color: hlFg }}>Shop →</span>
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex-1 rounded" style={{ background: hsl(t.tiles[0]) }} />
              <span className="flex-1 rounded" style={{ background: hsl(t.tiles[1]) }} />
            </span>
          </span>
          <span className="mt-1.5 grid grid-cols-4 gap-1 px-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex flex-col gap-[2px] rounded p-[3px]" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}` }}>
                <span className="block h-5 rounded-sm" style={{ background: hsl(t.tiles[(i + 2) % 4]) }} />
                <span className="flex items-center justify-between">
                  <b style={{ color: i % 2 ? hl : hsl(t.fg) }}>${[9.5, 5.5, 1.9, 4.9][i]}</b>
                  <span className="rounded-sm px-0.5 text-[5px] font-semibold" style={{ border: `1px solid ${hsl(t.primary)}`, color: hsl(t.primary) }}>+ Add</span>
                </span>
              </span>
            ))}
          </span>
        </span>
      )

    default:
      return (
        <span className="flex h-full flex-col p-3">
          <span className="flex items-center justify-between">
            <span style={{ ...display, fontWeight: 800 }} className="text-[12px] leading-none">Aura</span>
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full" style={{ background: hsl(t.fg) }} />
              <span className="size-1.5 rounded-full" style={{ background: hl }} />
            </span>
          </span>
          <span className="mt-2.5 grid flex-1 grid-cols-[1fr_1.15fr] gap-2.5">
            <span className="relative">
              <span className="absolute left-1 top-1 h-16 w-12 rotate-[-6deg] text-center text-xl leading-[4rem]" style={{ background: hsl(t.tiles[0]), borderRadius: `calc(${t.radius} * 0.6)` }}>👗</span>
              <span className="absolute bottom-1 right-0 h-14 w-11 rotate-[5deg] text-center text-lg leading-[3.5rem]" style={{ background: hsl(t.tiles[1]), borderRadius: `calc(${t.radius} * 0.6)` }}>👔</span>
            </span>
            <span className="flex min-w-0 flex-col justify-center">
              <span style={{ ...display, fontWeight: 800 }} className="text-[16px] leading-[1.05]">
                Wear the <em style={{ color: hl }}>happy</em> stuff.
              </span>
              <span className="mt-2 self-start px-2.5 py-1 text-[8px] font-semibold" style={{ background: hsl(t.ink), color: hsl(t.inkFg), borderRadius: t.pill }}>Shop the drop</span>
            </span>
          </span>
          <span className="mt-2 grid grid-cols-3 gap-1.5">
            {t.tiles.slice(1).map((tile, i) => (
              <span key={i} className="flex flex-col gap-0.5">
                <span className="block h-5" style={{ background: hsl(tile), borderRadius: `calc(${t.radius} * 0.5)` }} />
                {bar("70%")}
              </span>
            ))}
          </span>
        </span>
      )
  }
}
