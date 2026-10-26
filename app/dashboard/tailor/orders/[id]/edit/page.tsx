"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { PayBadge, StageBadge, apiError, fmtDate, tInput, tOutlineBtn, tPrimaryBtn } from "@/components/tailor/order-ui"
import { tailorApi, tailorOrdersApi, type TailorOrderDetail } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const label = "flex flex-col gap-1.5 text-[13px] font-semibold"
const card = "flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5"
const caption = "text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted"
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
  if (!canWrite("TailorOrders")) return <div className="p-6 text-sm text-dash-muted">You do not have permission to edit tailor orders.</div>

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Edit order{o ? ` ${o.orderNumber}` : ""}</h1>
        <p className="mt-1 text-sm text-dash-muted">Adjust delivery, charges and notes. Garments and fabric are locked once the order is placed.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-[14px]" />)}</div>
      ) : loadError || !o ? (
        <div className={cn(card, "items-start")}>
          <p className="font-semibold text-dash-danger-fg">{loadError || "Order not found."}</p>
          <Link href="/dashboard/tailor/orders" className={tOutlineBtn}>Back to orders</Link>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-dash-display text-lg font-bold">{o.customer?.name ?? "—"}</span>
                <span className="text-sm text-dash-muted">{o.customer?.phone}</span>
                <StageBadge stage={o.stage} /><PayBadge status={o.paymentStatus} />
              </div>
              <div className="flex flex-col rounded-xl border border-dash-border">
                {o.items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-3 border-b border-dash-border-soft px-3.5 py-2.5 last:border-0">
                    <div><div className="text-sm font-semibold">{it.productType} ×{it.quantity}</div>
                      <div className="text-xs text-dash-muted">{it.fabricSource === "shop" && it.fabric ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}` : "Customer fabric"}</div></div>
                    <span className="text-sm font-bold tabular-nums">{fc(it.lineTotal)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={card}>
              <span className={caption}>Delivery</span>
              <label className={cn(label, "max-w-[240px]")}>Delivery date
                <input type="date" className={tInput} value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); setErr("") }} />
              </label>
              <span className="text-xs text-dash-muted">Ordered {fmtDate(o.orderDate)}</span>
              <label className={label}>Order notes
                <textarea rows={3} className={cn(tInput, "h-auto py-2.5")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the shop should remember about this order" />
              </label>
            </section>
          </div>

          <aside className="flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5 lg:sticky lg:top-4">
            <h2 className="font-dash-display text-lg font-bold">Charges</h2>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex items-center justify-between gap-3"><label htmlFor="e-stitch" className="text-dash-muted">Stitching</label>
                <input id="e-stitch" type="number" min={0} className={cn(tInput, "h-9 w-28 text-right")} value={stitching} onChange={(e) => setStitching(Math.max(0, num(e.target.value)))} /></div>
              <div className="flex justify-between"><span className="text-dash-muted">Fabric</span><span className="font-semibold tabular-nums">{fc(fabric)}</span></div>
              {urgent > 0 && <div className="flex justify-between"><span className="text-dash-muted">Urgent charge</span><span className="font-semibold tabular-nums">{fc(urgent)}</span></div>}
              <div className="flex items-center justify-between gap-3"><label htmlFor="e-extra" className="text-dash-muted">Extra charge</label>
                <input id="e-extra" type="number" min={0} className={cn(tInput, "h-9 w-28 text-right")} value={extra} onChange={(e) => setExtra(Math.max(0, num(e.target.value)))} /></div>
              <div className="flex items-center justify-between gap-3"><label htmlFor="e-disc" className="text-dash-muted">Discount</label>
                <input id="e-disc" type="number" min={0} className={cn(tInput, "h-9 w-28 text-right")} value={discount} onChange={(e) => setDiscount(Math.max(0, num(e.target.value)))} /></div>
              <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2">
                <span className="font-bold">Total</span><span className="font-dash-display text-2xl font-bold tabular-nums">{fc(total)}</span>
              </div>
              <div className="flex justify-between"><span className="text-dash-muted">Paid</span><span className="font-semibold tabular-nums">{fc(o.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-dash-muted">Due</span><span className="font-semibold tabular-nums">{fc(Math.max(0, total - o.paidAmount))}</span></div>
            </div>
            {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
            <div className="flex gap-2">
              <Link href={back} className={cn(tOutlineBtn, "flex-1")}>Cancel</Link>
              <button type="button" disabled={saving} onClick={save} className={cn(tPrimaryBtn, "flex-1")}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
