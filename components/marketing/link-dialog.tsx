"use client"

import * as React from "react"
import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import { ChevronDown, Layers, Package, QrCode as QrIcon, Store, Zap } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { AD_SOURCE_META } from "@/components/sales/ad-source"
import { ORDERS_NS } from "@/components/sales/i18n"
import { MARKETING_NS, type MarketingKey } from "@/components/marketing/i18n"
import { CollectionPicker, ProductPicker, type PickedTarget } from "@/components/marketing/target-pickers"
import { CopyField, QrCode, TARGET_LABEL, UTM_MEDIUM, buildCaption, channelLabel, shareUrl, slugify } from "@/components/marketing/link-ui"
import {
  LINK_CHANNELS, campaignLinkApi, type CampaignLink, type CampaignLinkPayload, type LinkChannel, type LinkTargetType,
} from "@/lib/campaignLinkApi"
import { apiErrorMessage, apiFieldErrors } from "@/lib/collectionApi"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const TARGETS: { value: LinkTargetType; icon: React.ReactNode; description: MarketingKey }[] = [
  { value: "quick_order", icon: <Zap className="size-4" aria-hidden />, description: "commerce:marketing.targetDesc.quickOrder" },
  { value: "product", icon: <Package className="size-4" aria-hidden />, description: "commerce:marketing.targetDesc.product" },
  { value: "collection", icon: <Layers className="size-4" aria-hidden />, description: "commerce:marketing.targetDesc.collection" },
  { value: "store", icon: <Store className="size-4" aria-hidden />, description: "commerce:marketing.targetDesc.store" },
]

type UtmKey = "utmSource" | "utmMedium" | "utmCampaign" | "utmContent"
const UTM_FIELDS: [UtmKey, string][] = [["utmSource", "utm_source"], ["utmMedium", "utm_medium"], ["utmCampaign", "utm_campaign"], ["utmContent", "utm_content"]]

interface FormState {
  name: string
  channel: LinkChannel | ""
  targetType: LinkTargetType
  target: PickedTarget | null
  code: string
  utm: Record<UtmKey, string>
  /** UTM fields the user typed in (others follow the auto values). */
  touched: Partial<Record<UtmKey, boolean>>
  notes: string
  isActive: boolean
}

const emptyForm = (): FormState => ({
  name: "", channel: "", targetType: "quick_order", target: null, code: "",
  utm: { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "" }, touched: {}, notes: "", isActive: true,
})

const fromLink = (l: CampaignLink): FormState => ({
  name: l.name, channel: l.channel, targetType: l.targetType,
  target: l.target ? { id: l.target.id, name: l.target.name, image: l.target.image } : null,
  code: l.code,
  utm: { utmSource: l.utmSource ?? "", utmMedium: l.utmMedium ?? "", utmCampaign: l.utmCampaign ?? "", utmContent: l.utmContent ?? "" },
  touched: { utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true },
  notes: l.notes ?? "", isActive: l.isActive,
})

/** Auto UTM values from channel + name + target (same rules as the server defaults). */
function autoUtm(f: FormState): Record<UtmKey, string> {
  return {
    utmSource: f.channel || "",
    utmMedium: f.channel ? UTM_MEDIUM[f.channel] : "",
    utmCampaign: slugify(f.name),
    utmContent: f.targetType === "store" ? "store" : f.target ? slugify(f.target.name) : "",
  }
}

interface LinkDialogProps {
  open: boolean
  /** Link to edit; null creates a new one. */
  link: CampaignLink | null
  /** Open straight on the share step (links / QR / captions). */
  shareOnly?: boolean
  storeName?: string
  onClose: () => void
  onSaved: (link: CampaignLink) => void
}

export function LinkDialog({ open, link, shareOnly, storeName, onClose, onSaved }: LinkDialogProps) {
  const { t } = useTranslation(MARKETING_NS)
  const { t: tOrders } = useTranslation(ORDERS_NS)
  const { toast } = useToast()
  const [f, setF] = React.useState<FormState>(emptyForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState<CampaignLink | null>(null)
  const [utmOpen, setUtmOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setF(link ? fromLink(link) : emptyForm())
    setErrors({}); setUtmOpen(false)
    setSaved(shareOnly && link ? link : null)
  }, [open, link, shareOnly])

  const auto = autoUtm(f)
  const utmValue = (k: UtmKey) => (f.touched[k] ? f.utm[k] : auto[k])
  const patch = (p: Partial<FormState>) => setF((cur) => ({ ...cur, ...p }))
  const needsProduct = f.targetType === "product" || f.targetType === "quick_order"

  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = t("commerce:marketing.validation.name")
    if (!f.channel) e.channel = t("commerce:marketing.validation.channel")
    if (needsProduct && !f.target) e.targetId = t("commerce:marketing.validation.product")
    if (f.targetType === "collection" && !f.target) e.targetId = t("commerce:marketing.validation.collection")
    const code = f.code.trim()
    if (code && !/^[A-Za-z0-9_-]{4,20}$/.test(code)) e.code = t("commerce:marketing.validation.code")
    for (const [k] of UTM_FIELDS) if (utmValue(k).length > 100) e[k] = t("commerce:marketing.validation.utm")
    return e
  }

  const submit = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      if (UTM_FIELDS.some(([k]) => e[k])) setUtmOpen(true)
      return
    }
    const body: CampaignLinkPayload = {
      name: f.name.trim(),
      channel: f.channel as LinkChannel,
      targetType: f.targetType,
      targetId: f.targetType === "store" ? null : f.target?.id ?? null,
      code: f.code.trim() ? f.code.trim() : null,
      // Untouched UTM fields go as null so the server applies its defaults
      utmSource: f.touched.utmSource ? f.utm.utmSource.trim() || null : null,
      utmMedium: f.touched.utmMedium ? f.utm.utmMedium.trim() || null : null,
      utmCampaign: f.touched.utmCampaign ? f.utm.utmCampaign.trim() || null : null,
      utmContent: f.touched.utmContent ? f.utm.utmContent.trim() || null : null,
      notes: f.notes.trim() || null,
      isActive: f.isActive,
    }
    setSaving(true)
    try {
      const res = link ? await campaignLinkApi.update(link.id, body) : await campaignLinkApi.create(body)
      onSaved(res)
      setSaved(res)
      toast({ title: link ? t("commerce:marketing.toast.updated") : t("commerce:marketing.toast.created"), description: t("commerce:marketing.toast.savedDesc") })
    } catch (err) {
      const fe = apiFieldErrors(err)
      setErrors(fe)
      if (UTM_FIELDS.some(([k]) => fe[k])) setUtmOpen(true)
      toast({ variant: "destructive", title: t("commerce:marketing.toast.saveFailed"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{saved ? saved.name : link ? t("commerce:marketing.dialog.editTitle") : t("commerce:marketing.dialog.newTitle")}</DialogTitle>
          <DialogDescription>
            {saved
              ? t("commerce:marketing.dialog.savedDesc")
              : t("commerce:marketing.dialog.formDesc")}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <SharePanel link={saved} storeName={storeName} />
        ) : (
          <div className="flex flex-col gap-5">
            <FormField label={t("commerce:marketing.dialog.name")} htmlFor="cl-name" required error={errors.name} description={t("commerce:marketing.dialog.nameHelp")}>
              <Input id="cl-name" value={f.name} maxLength={150} autoFocus placeholder={t("commerce:marketing.dialog.namePlaceholder")}
                aria-invalid={!!errors.name} onChange={(e) => patch({ name: e.target.value })} />
            </FormField>

            <FormField label={t("commerce:marketing.dialog.where")} required error={errors.channel}>
              <ChoiceCardGroup aria-label={t("commerce:marketing.table.channel")} value={f.channel} onValueChange={(v) => patch({ channel: v as LinkChannel })}
                className="grid-cols-2 sm:grid-cols-4">
                {LINK_CHANNELS.map((c) => {
                  const meta = AD_SOURCE_META[c]
                  const Icon = meta.icon
                  return (
                    <ChoiceCard key={c} value={c} className="p-3"
                      icon={<span className={cn("grid size-7 place-items-center rounded-md", meta.className)}><Icon className="size-4" aria-hidden /></span>}
                      title={channelLabel(tOrders, c)} />
                  )
                })}
              </ChoiceCardGroup>
            </FormField>

            <FormField label={t("commerce:marketing.dialog.opens")} required>
              <ChoiceCardGroup aria-label={t("commerce:marketing.dialog.opensAria")} value={f.targetType}
                onValueChange={(v) => {
                  const next = v as LinkTargetType
                  const sameKind = (a: LinkTargetType, b: LinkTargetType) => (a === "product" || a === "quick_order") && (b === "product" || b === "quick_order")
                  patch({ targetType: next, target: sameKind(next, f.targetType) ? f.target : null })
                  setErrors((e) => ({ ...e, targetId: "" }))
                }}
                className="sm:grid-cols-2">
                {TARGETS.map((o) => (
                  <ChoiceCard key={o.value} value={o.value} icon={o.icon} title={t(TARGET_LABEL[o.value])} description={t(o.description)} />
                ))}
              </ChoiceCardGroup>
            </FormField>

            {needsProduct && (
              <FormField label={t("common:fields.product")} htmlFor="cl-product" required error={errors.targetId}>
                <ProductPicker id="cl-product" value={f.target} invalid={!!errors.targetId} onChange={(p) => { patch({ target: p }); setErrors((e) => ({ ...e, targetId: "" })) }} />
              </FormField>
            )}
            {f.targetType === "collection" && (
              <FormField label={t("commerce:marketing.target.collection")} htmlFor="cl-collection" required error={errors.targetId}>
                <CollectionPicker id="cl-collection" value={f.target} invalid={!!errors.targetId} onChange={(c) => { patch({ target: c }); setErrors((e) => ({ ...e, targetId: "" })) }} />
              </FormField>
            )}

            <Collapsible open={utmOpen} onOpenChange={setUtmOpen} className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="h-auto w-full justify-between px-4 py-3 text-left">
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">{t("commerce:marketing.dialog.utmTitle")}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {[utmValue("utmSource"), utmValue("utmMedium"), utmValue("utmCampaign")].filter(Boolean).join(" · ") || t("commerce:marketing.dialog.utmAuto")}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 transition-transform", utmOpen && "rotate-180")} aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-3 border-t p-4 sm:grid-cols-2">
                {UTM_FIELDS.map(([k, label]) => (
                  <FormField key={k} label={label} htmlFor={`cl-${k}`} error={errors[k]}
                    description={f.touched[k] ? (
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs"
                        onClick={() => setF((cur) => ({ ...cur, touched: { ...cur.touched, [k]: false } }))}>
                        {t("commerce:marketing.dialog.useAuto")}
                      </Button>
                    ) : t("commerce:marketing.dialog.automatic")}>
                    <Input id={`cl-${k}`} className="font-mono text-xs" maxLength={100} value={utmValue(k)} aria-invalid={!!errors[k]}
                      onChange={(e) => setF((cur) => ({ ...cur, utm: { ...cur.utm, [k]: e.target.value }, touched: { ...cur.touched, [k]: true } }))} />
                  </FormField>
                ))}
                <FormField label={t("commerce:marketing.dialog.shortCode")} htmlFor="cl-code" error={errors.code} className="sm:col-span-2"
                  description={t("commerce:marketing.dialog.shortCodeHelp")}>
                  <Input id="cl-code" className="font-mono" maxLength={20} value={f.code} placeholder={t("commerce:marketing.dialog.autoPlaceholder")} aria-invalid={!!errors.code}
                    onChange={(e) => patch({ code: e.target.value.replace(/\s/g, "") })} />
                </FormField>
              </CollapsibleContent>
            </Collapsible>

            <FormField label={t("common:fields.notes")} htmlFor="cl-notes" description={t("commerce:marketing.dialog.notesHelp")}>
              <Textarea id="cl-notes" rows={2} maxLength={1000} value={f.notes} onChange={(e) => patch({ notes: e.target.value })} />
            </FormField>

            <div className="flex items-center gap-3">
              <Switch id="cl-active" checked={f.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
              <label htmlFor="cl-active" className="text-sm">
                {t("common:status.active")} <span className="text-muted-foreground">{t("commerce:marketing.dialog.activeHelp")}</span>
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          {saved ? (
            <>
              {shareOnly && link && <Button type="button" variant="outline" onClick={() => setSaved(null)}>{t("commerce:marketing.table.editLink")}</Button>}
              <Button type="button" onClick={onClose}>{t("common:actions.done")}</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
              <Button type="button" disabled={saving} onClick={submit}>{saving ? t("common:actions.saving") : link ? t("common:actions.saveChanges") : t("commerce:marketing.dialog.create")}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Full URL + short URL with copy, QR code and ready-to-post captions. */
export function SharePanel({ link, storeName, compact }: { link: CampaignLink; storeName?: string; compact?: boolean }) {
  const { t } = useTranslation(MARKETING_NS)
  const [captionKind, setCaptionKind] = React.useState<"facebook" | "whatsapp">(link.channel === "whatsapp" ? "whatsapp" : "facebook")
  const [caption, setCaption] = React.useState(() => buildCaption(t, captionKind, link, storeName))
  const [showQr, setShowQr] = React.useState(!compact)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => { setCaption(buildCaption(t, captionKind, link, storeName)) }, [t, captionKind, link, storeName])

  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* blocked */ }
  }
  const url = shareUrl(link)
  const hasAbsolute = !!(link.shortUrl || link.fullUrl)

  return (
    <div className="flex flex-col gap-4">
      {!link.storeBaseUrl && (
        <Alert>
          <Store aria-hidden />
          <AlertTitle>{t("commerce:marketing.share.noStoreTitle")}</AlertTitle>
          <AlertDescription>
            <p><Trans t={t} i18nKey="commerce:marketing.share.noStoreDesc" components={{ link: <Link href="/dashboard/store" className="font-medium underline underline-offset-4" /> }} /></p>
          </AlertDescription>
        </Alert>
      )}
      <div className={cn("grid gap-4", !compact && hasAbsolute && "sm:grid-cols-[1fr_auto]")}>
        <div className="flex min-w-0 flex-col gap-3">
          {link.shortUrl && (
            <FormField label={t("commerce:marketing.share.shortLabel")} htmlFor={`cl-short-${link.id}`}>
              <CopyField id={`cl-short-${link.id}`} label={t("commerce:marketing.share.short")} value={link.shortUrl} />
            </FormField>
          )}
          <FormField label={link.fullUrl ? t("commerce:marketing.share.fullLabel") : t("commerce:marketing.share.path")} htmlFor={`cl-full-${link.id}`}
            description={t("commerce:marketing.share.fullHelp")}>
            <CopyField id={`cl-full-${link.id}`} label={t("commerce:marketing.share.full")} value={link.fullUrl || link.targetPath} />
          </FormField>
          {compact && hasAbsolute && (
            <Button type="button" variant="outline" size="sm" className="w-fit" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
              <QrIcon className="size-4" aria-hidden /> {showQr ? t("commerce:marketing.share.hideQr") : t("commerce:marketing.share.showQr")}
            </Button>
          )}
        </div>
        {showQr && hasAbsolute && <QrCode value={url} fileName={`order-link-${link.code}`} className={compact ? "items-start" : undefined} />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("commerce:marketing.share.caption")}</p>
          <SegmentedControl aria-label={t("commerce:marketing.share.captionFor")} value={captionKind} onValueChange={(v) => setCaptionKind(v as "facebook" | "whatsapp")}
            options={[{ value: "facebook", label: "Facebook / Instagram" }, { value: "whatsapp", label: "WhatsApp" }]} />
        </div>
        <Textarea aria-label={t("commerce:marketing.share.captionAria")} rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyCaption}>{copied ? t("common:actions.copied") : t("commerce:marketing.share.copyCaption")}</Button>
          {captionKind === "whatsapp" && (
            <Button asChild variant="outline" size="sm">
              <a href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noopener noreferrer">{t("commerce:marketing.share.shareWa")}</a>
            </Button>
          )}
          {captionKind === "facebook" && link.fullUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">{t("commerce:marketing.share.shareFb")}</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
