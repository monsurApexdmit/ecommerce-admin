"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { Check, Copy, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { WithTooltip } from "@/components/common/WithTooltip"
import { adSourceText } from "@/components/sales/ad-source"
import type { OrdersT } from "@/components/sales/i18n"
import { MARKETING_NS, type MarketingKey, type MarketingT } from "@/components/marketing/i18n"
import { localeTag } from "@/lib/i18n"
import { qrMatrix } from "@/lib/qr"
import type { CampaignLink, LinkChannel, LinkPeriod, LinkTargetType } from "@/lib/campaignLinkApi"
import { cn } from "@/lib/utils"

/** Period options; labels are keys, translate with `periodOptions(t)`. */
export const PERIODS: { value: LinkPeriod; label: MarketingKey }[] = [
  { value: "today", label: "common:time.today" },
  { value: "7d", label: "commerce:marketing.period.d7" },
  { value: "30d", label: "commerce:marketing.period.d30" },
  { value: "90d", label: "commerce:marketing.period.d90" },
  { value: "all", label: "common:time.allTime" },
]

export const periodOptions = (t: MarketingT) => PERIODS.map((p) => ({ value: p.value, label: t(p.label) }))

/** Link target type → label key. */
export const TARGET_LABEL: Record<LinkTargetType, MarketingKey> = {
  product: "commerce:marketing.target.product",
  quick_order: "commerce:marketing.target.quickOrder",
  collection: "commerce:marketing.target.collection",
  store: "commerce:marketing.target.store",
}

/** Channel code → label (brand names stay; "Other" etc. translated). Needs `t` of `useTranslation(ORDERS_NS)`. */
export const channelLabel = (tOrders: OrdersT, c: string) => adSourceText(tOrders, c) || c

/** Server UTM defaults (AD_ORDERS_API_CONTRACT.md §3.1), mirrored for the live preview in the form. */
export const UTM_MEDIUM: Record<LinkChannel, string> = {
  facebook: "social", instagram: "social", tiktok: "social", youtube: "social", messenger: "social",
  whatsapp: "chat", google: "cpc", other: "referral",
}

export const slugify = (v: string, max = 100) =>
  v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "")

export const pct = (n: number) => `${(Number(n) || 0).toFixed(n >= 10 || n === 0 ? 1 : 2)}%`

/** The link a shopper should get: short URL, else the full URL, else the bare path. */
export const shareUrl = (l: Pick<CampaignLink, "shortUrl" | "fullUrl" | "targetPath">) => l.shortUrl || l.fullUrl || l.targetPath

/** Read-only URL field with a copy button. */
export function CopyField({ id, label, value, onCopied }: { id: string; label: string; value: string; onCopied?: () => void }) {
  const { t } = useTranslation(MARKETING_NS)
  const [done, setDone] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true); onCopied?.()
      setTimeout(() => setDone(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <InputGroup>
      <InputGroupInput id={id} readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <InputGroupAddon align="inline-end">
        <WithTooltip content={done ? t("common:actions.copied") : t("commerce:marketing.copyLabel", { label: label.toLowerCase() })}>
          <InputGroupButton size="icon-xs" aria-label={t("commerce:marketing.copyLabel", { label: label.toLowerCase() })} onClick={copy}>
            {done ? <Check aria-hidden /> : <Copy aria-hidden />}
          </InputGroupButton>
        </WithTooltip>
      </InputGroupAddon>
    </InputGroup>
  )
}

/** QR code for a URL (pure-TS encoder, no dependency) with an SVG download. */
export function QrCode({ value, size = 168, fileName = "order-link-qr", className }: { value: string; size?: number; fileName?: string; className?: string }) {
  const { t } = useTranslation(MARKETING_NS)
  const matrix = React.useMemo(() => qrMatrix(value), [value])
  if (!matrix) return <p className="text-xs text-muted-foreground">{t("commerce:marketing.qrTooLong")}</p>
  const n = matrix.length + 8
  let d = ""
  matrix.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4},${y + 4}h1v1h-1z` }))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="1024" height="1024" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  const download = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const a = document.createElement("a")
    a.href = url; a.download = `${fileName}.svg`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={t("commerce:marketing.qrFor", { value })} className="rounded-md border">
        <rect width={n} height={n} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <Button type="button" variant="outline" size="sm" onClick={download}>
        <Download className="size-4" aria-hidden /> {t("commerce:marketing.downloadQr")}
      </Button>
    </div>
  )
}

/** Ready-to-post text for a link. */
export function buildCaption(t: MarketingT, kind: "facebook" | "whatsapp", link: Pick<CampaignLink, "targetType" | "target" | "shortUrl" | "fullUrl" | "targetPath">, storeName?: string) {
  const url = shareUrl(link)
  const what = link.target?.name || storeName || t("commerce:marketing.caption.ourCollection")
  const action = link.targetType === "quick_order" ? t("commerce:marketing.caption.actionQuick") : link.targetType === "store" ? t("commerce:marketing.caption.actionStore") : t("commerce:marketing.caption.actionProduct")
  if (kind === "whatsapp") {
    return [
      t("commerce:marketing.caption.waGreeting", { what }),
      t("commerce:marketing.caption.waAction", { action, url }),
      t("commerce:marketing.caption.waReply"),
    ].join("\n")
  }
  return [
    `${what}`,
    "",
    t("commerce:marketing.caption.fbAction", { action }),
    t("commerce:marketing.caption.fbOrder", { url }),
    "",
    t("commerce:marketing.caption.fbInbox"),
  ].join("\n")
}

/** Daily clicks (light) with orders (solid) on the same scale. */
export function ClicksOrdersChart({ days, height = 150 }: { days: { date: string; clicks: number; orders: number }[]; height?: number }) {
  const { t, i18n } = useTranslation(MARKETING_NS)
  const peak = Math.max(1, ...days.map((d) => Math.max(d.clicks, d.orders)))
  if (!days.some((d) => d.clicks || d.orders)) return <p className="py-8 text-center text-sm text-muted-foreground">{t("commerce:marketing.chart.empty")}</p>
  const tag = localeTag(i18n.language)
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(tag, { day: "numeric", month: "short" })
  const every = days.length > 14 ? Math.ceil(days.length / 7) : 1
  return (
    <div>
      <div className="flex items-end gap-0.5 border-b" style={{ height }} role="img"
        aria-label={t("commerce:marketing.chart.aria", { peak })}>
        {days.map((d) => (
          <WithTooltip key={d.date} content={t("commerce:marketing.chart.tip", { date: label(d.date), clicks: t("commerce:marketing.chart.clicks", { count: d.clicks }), orders: t("common:count.orders", { count: d.orders }) })}>
            <div className="relative flex h-full min-w-0 flex-1 items-end justify-center">
              <div className="absolute bottom-0 w-full max-w-5 rounded-t-sm bg-primary/20" style={{ height: `${d.clicks ? Math.max(2, (d.clicks / peak) * 100) : 0}%` }} />
              <div className="absolute bottom-0 w-full max-w-5 rounded-t-sm bg-primary" style={{ height: `${d.orders ? Math.max(3, (d.orders / peak) * 100) : 0}%` }} />
            </div>
          </WithTooltip>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {days.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">{i % every === 0 ? label(d.date) : ""}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/20" aria-hidden /> {t("commerce:marketing.chart.legendClicks")}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" aria-hidden /> {t("commerce:marketing.chart.legendOrders")}</span>
        <span className="ml-auto tabular-nums">{t("commerce:marketing.chart.peak", { peak })}</span>
      </div>
    </div>
  )
}
