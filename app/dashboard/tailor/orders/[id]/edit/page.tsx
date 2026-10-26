"use client"

import { Fragment, use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { Textarea } from "@/components/ui/textarea"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { PayBadge, StageBadge, apiError, fmtDate } from "@/components/tailor/order-ui"
import { tailorApi, tailorOrdersApi, type TailorOrderDetail } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/**
 * Edit the commercial header of an order. Garments, fabric and measurements are fixed once the order
 * is placed (fabric stock has already been deducted); the API only accepts these header fields.
 */
export default function EditTailorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { formatCurrency: fc } = useCompanySettings()
  const { canWrite } = useSaasAuth()
  const router = useRouter()
  const blocked = useModuleGuard("TailorOrders")

  const [o, setO] = useState<TailorOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [stitching, setStitching] = useState(0)
  const [extra, setExtra] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState("")
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    tailorOrdersApi.detail(Number(id))
      .then((d) => {
        setO(d)
        setDeliveryDate(d.deliveryDate ?? "")
        setStitching(d.charges.stitching || d.charges.stitchingOrderLevel)
        setExtra(d.charges.extra); setDiscount(d.charges.discount); setNotes(d.notes ?? "")
      })
      .catch((e) => setLoadError(apiError(e, "Failed to load order")))
      .finally(() => setLoading(false))
  }, [id])

  if (blocked) return blocked
  if (!canWrite("TailorOrders")) return <div className="p-6 text-sm text-muted-foreground">You do not have permission to edit tailor orders.</div>

  const back = `/dashboard/tailor/orders?view=${id}`
  const fabric = o?.charges.fabric ?? 0
  const urgent = o?.charges.urgent ?? 0
  const total = Math.max(0, stitching + fabric + urgent + extra - discount)

  const save = async () => {
    if (!o) return
    if (o.orderDate && deliveryDate && deliveryDate < o.orderDate) return setErr("Delivery date cannot be before the order date.")
    if (discount > stitching + fabric + urgent + extra) return setErr("Discount cannot be more than the order subtotal.")
    setSaving(true); setErr("")
    try {
      await tailorApi.updateOrder(o.id, {
        delivery_date: deliveryDate || undefined, stitching_charge: stitching, extra_charge: extra, discount, notes: notes || undefined,
      })
      toast.success("Order updated")
      router.push(back)
    } catch (e) {
      setErr(apiError(e, "Failed to update order"))
      setSaving(false)
    }
  }

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={`Edit order${o ? ` ${o.orderNumber}` : ""}`}
        description="Adjust delivery, charges and notes. Garments and fabric are locked once the order is placed."
      />

      {loading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : loadError || !o ? (
        <Card className="items-start gap-4 p-5">
          <p className="font-medium text-destructive">{loadError || "Order not found."}</p>
          <Button asChild variant="outline"><Link href="/dashboard/tailor/orders">Back to orders</Link></Button>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="gap-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{o.customer?.name ?? "—"}</span>
                <span className="text-sm text-muted-foreground">{o.customer?.phone}</span>
                <StageBadge stage={o.stage} /><PayBadge status={o.paymentStatus} />
              </div>
              <ItemGroup>
                {o.items.map((it, idx) => (
                  <Fragment key={it.id}>
                    {idx > 0 && <ItemSeparator />}
                    <Item size="sm" className="items-start px-0">
                      <ItemContent>
                        <ItemTitle>{it.productType} ×{it.quantity}</ItemTitle>
                        <ItemDescription className="text-xs">{it.fabricSource === "shop" && it.fabric ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}` : "Customer fabric"}</ItemDescription>
                      </ItemContent>
                      <ItemActions className="text-sm font-semibold tabular-nums">{fc(it.lineTotal)}</ItemActions>
                    </Item>
                  </Fragment>
                ))}
              </ItemGroup>
            </Card>

            <Card className="gap-4 p-5">
              <SectionTitle as="h2">Delivery</SectionTitle>
              <FormField label="Delivery date" htmlFor="e-delivery" className="max-w-[240px]" description={`Ordered ${fmtDate(o.orderDate)}`}>
                <Input id="e-delivery" type="date" value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); setErr("") }} />
              </FormField>
              <FormField label="Order notes" htmlFor="e-notes">
                <Textarea id="e-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the shop should remember about this order" />
              </FormField>
            </Card>
          </div>

          <SectionCard title="Charges" className="lg:sticky lg:top-4" contentClassName="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm">
              <FormField orientation="horizontal" className="justify-between gap-3" label="Stitching" htmlFor="e-stitch">
                <Input id="e-stitch" type="number" min={0} className="w-28 text-right" value={stitching} onChange={(e) => setStitching(Math.max(0, num(e.target.value)))} />
              </FormField>
              <InfoList>
                <InfoRow label="Fabric"><span className="tabular-nums">{fc(fabric)}</span></InfoRow>
                {urgent > 0 && <InfoRow label="Urgent charge"><span className="tabular-nums">{fc(urgent)}</span></InfoRow>}
              </InfoList>
              <FormField orientation="horizontal" className="justify-between gap-3" label="Extra charge" htmlFor="e-extra">
                <Input id="e-extra" type="number" min={0} className="w-28 text-right" value={extra} onChange={(e) => setExtra(Math.max(0, num(e.target.value)))} />
              </FormField>
              <FormField orientation="horizontal" className="justify-between gap-3" label="Discount" htmlFor="e-disc">
                <Input id="e-disc" type="number" min={0} className="w-28 text-right" value={discount} onChange={(e) => setDiscount(Math.max(0, num(e.target.value)))} />
              </FormField>
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Total</span><span className="text-2xl font-semibold tabular-nums">{fc(total)}</span>
              </div>
              <InfoList>
                <InfoRow label="Paid"><span className="tabular-nums">{fc(o.paidAmount)}</span></InfoRow>
                <InfoRow label="Due"><span className="tabular-nums">{fc(Math.max(0, total - o.paidAmount))}</span></InfoRow>
              </InfoList>
            </div>
            {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1"><Link href={back}>Cancel</Link></Button>
              <Button type="button" disabled={saving} onClick={save} className="flex-1">{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
