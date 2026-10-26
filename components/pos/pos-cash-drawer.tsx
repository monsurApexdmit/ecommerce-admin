"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { apiError, posApi, REGISTERS, type RegisterSession } from "@/lib/posApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    register: string
    onRegisterChange: (r: string) => void
    locationId?: number
    session: RegisterSession | null
    history: RegisterSession[]
    /** Called after any change so the page can refetch the shift */
    onChanged: () => void | Promise<void>
    initialError?: string
}

const field =
    "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"

/** Cash drawer: open a shift, record cash in/out, close with a count. */
export function PosCashDrawer({ open, onOpenChange, register, onRegisterChange, locationId, session, history, onChanged, initialError }: Props) {
    const { formatCurrency: fc } = useCompanySettings()
    const { toast } = useToast()
    const [err, setErr] = useState("")
    const [busy, setBusy] = useState(false)
    const [openAmt, setOpenAmt] = useState("")
    const [mvType, setMvType] = useState<"in" | "out">("in")
    const [mvAmt, setMvAmt] = useState("")
    const [mvReason, setMvReason] = useState("")
    const [counted, setCounted] = useState("")
    const [note, setNote] = useState("")

    useEffect(() => { if (open) setErr(initialError ?? "") }, [open, initialError])

    const s = session?.summary
    const expected = s?.expected ?? session?.expectedCash ?? 0
    const diff = session && counted !== "" && !Number.isNaN(Number(counted)) ? Math.round((Number(counted) - expected) * 100) / 100 : null

    const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
        setBusy(true)
        setErr("")
        try {
            await fn()
            toast({ title: ok })
            await onChanged()
            after?.()
        } catch (e) {
            setErr(apiError(e, "Something went wrong"))
        } finally {
            setBusy(false)
        }
    }

    const doOpen = () => {
        if (openAmt === "") return setErr("Enter the opening cash (0 if the drawer is empty).")
        const amount = Number(openAmt)
        if (!(amount >= 0)) return setErr("Opening cash must be 0 or more.")
        run(() => posApi.openShift({ register, locationId, openingCash: amount }), `${register} shift opened`, () => { setOpenAmt(""); onOpenChange(false) })
    }

    const doMove = () => {
        if (!session) return
        const amount = Number(mvAmt)
        if (!(amount > 0)) return setErr("Enter an amount greater than 0.")
        if (!mvReason.trim()) return setErr("Add a reason.")
        run(
            () => posApi.cashMovement(session.id, { type: mvType, amount, reason: mvReason.trim() }),
            `${mvType === "in" ? "Cash in" : "Cash out"} ${fc(amount)} recorded`,
            () => { setMvAmt(""); setMvReason("") },
        )
    }

    const doClose = () => {
        if (!session) return
        if (counted === "") return setErr("Enter the cash you counted.")
        if (!window.confirm(`Close ${session.register}? Expected ${fc(expected)}, counted ${fc(Number(counted))}.`)) return
        run(() => posApi.closeShift(session.id, { counted: Number(counted), note: note.trim() || undefined }), "Shift closed", () => {
            setCounted(""); setNote(""); onOpenChange(false)
        })
    }

    const rows: [string, string, "pos" | "neg" | "plain"][] = s
        ? [
            ["Opening cash", fc(s.opening), "plain"],
            [`Cash sales (${s.saleCount} sale${s.saleCount === 1 ? "" : "s"})`, `+ ${fc(s.cashSales)}`, "pos"],
            ["Due collected in cash", `+ ${fc(s.collections)}`, "pos"],
            ["Cash in", `+ ${fc(s.cashIn)}`, "pos"],
            ["Cash out", `− ${fc(s.cashOut)}`, "neg"],
            ["Cash refunds", `− ${fc(s.refunds)}`, "neg"],
            ["Cash expenses", `− ${fc(s.expenses)}`, "neg"],
            ["Supplier payments (cash)", `− ${fc(s.supplierPaid)}`, "neg"],
        ]
        : []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-h-[92vh] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[560px]"
            >
                <div className="flex items-start justify-between gap-3 border-b border-dash-border px-6 py-[18px]">
                    <div>
                        <DialogTitle className="font-dash-display text-[22px] font-bold">Cash drawer</DialogTitle>
                        <DialogDescription className="mt-0.5 text-[13px] text-dash-muted">
                            {session
                                ? `${session.register} · opened ${new Date(session.openedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} by ${session.openedBy || "staff"}`
                                : "Start a shift to take cash and track the drawer"}
                        </DialogDescription>
                    </div>
                    <button type="button" aria-label="Close" onClick={() => onOpenChange(false)}
                        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-dash-border hover:bg-dash-neutral-soft">
                        <X className="size-[18px]" />
                    </button>
                </div>

                <div className="flex flex-col gap-5 px-6 py-5">
                    {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2.5 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}

                    {!session && (
                        <div className="flex flex-col gap-3">
                            <div className="rounded-xl bg-dash-warn-soft p-3.5 text-[13px] text-dash-warn-fg">
                                No shift is open. Count the cash in the drawer and start a shift to begin selling.
                            </div>
                            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Register
                                <select value={register} onChange={(e) => onRegisterChange(e.target.value)} className={field}>
                                    {REGISTERS.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Opening cash (float)
                                <input type="number" min={0} step="0.01" placeholder="0.00" value={openAmt} onChange={(e) => setOpenAmt(e.target.value)} className={field} />
                            </label>
                            <button type="button" onClick={doOpen} disabled={busy}
                                className="h-12 rounded-xl bg-dash-accent text-[15px] font-bold text-white disabled:opacity-50">
                                {busy ? "Opening…" : "Open shift"}
                            </button>
                        </div>
                    )}

                    {session && s && (
                        <>
                            <div className="flex items-start justify-between gap-3 rounded-xl bg-dash-accent-soft p-4 text-dash-accent-fg">
                                <div>
                                    <div className="text-xs">Cash on hand</div>
                                    <div className="font-dash-display text-[28px] font-bold tabular-nums">{fc(expected)}</div>
                                </div>
                                <div className="text-right text-xs">{session.no}<br />since {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            </div>

                            <div className="flex flex-col text-sm tabular-nums">
                                {rows.map(([k, v, tone]) => (
                                    <div key={k} className="flex justify-between border-b border-dash-border-soft py-2">
                                        <span className="text-dash-muted">{k}</span>
                                        <span className={cn("font-semibold", tone === "pos" && "text-dash-success-fg", tone === "neg" && "text-dash-danger-fg")}>{v}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between py-2 text-xs text-dash-muted">
                                    <span>Non-cash sales this shift (not in drawer)</span>
                                    <span className="font-semibold">{fc(s.nonCashSales)}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2.5 rounded-xl border border-dash-border p-3.5">
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(["in", "out"] as const).map((t) => (
                                        <button key={t} type="button" onClick={() => setMvType(t)}
                                            className={cn("h-10 rounded-[10px] border-2 text-[13px] font-bold",
                                                mvType === t
                                                    ? t === "in" ? "border-dash-success bg-dash-success-soft text-dash-success-fg" : "border-dash-danger bg-dash-danger-soft text-dash-danger-fg"
                                                    : "border-dash-border text-dash-muted")}>
                                            {t === "in" ? "+ Cash in" : "− Cash out"}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-[110px_1fr_auto] gap-2">
                                    <input type="number" min={0} step="0.01" aria-label="Amount" placeholder="Amount" value={mvAmt} onChange={(e) => setMvAmt(e.target.value)} className={field} />
                                    <input aria-label="Reason" value={mvReason} onChange={(e) => setMvReason(e.target.value)}
                                        placeholder={mvType === "in" ? "Reason (e.g. float top-up)" : "Reason (e.g. bank deposit, petty cash)"} className={field} />
                                    <button type="button" onClick={doMove} disabled={busy} className="h-[42px] rounded-[10px] bg-dash-ink px-4 text-[13px] font-bold text-dash-bg disabled:opacity-50">Record</button>
                                </div>
                                {s.movements.length > 0 && (
                                    <ul className="flex flex-col text-[13px]">
                                        {[...s.movements].reverse().slice(0, 6).map((m) => (
                                            <li key={m.id} className="flex justify-between border-t border-dash-border-soft py-1.5">
                                                <span>
                                                    <strong className={m.type === "in" ? "text-dash-success-fg" : "text-dash-danger-fg"}>{m.type === "in" ? "+" : "−"}</strong> {m.reason}{" "}
                                                    <span className="text-dash-muted">· {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </span>
                                                <span className="font-semibold tabular-nums">{fc(m.amount)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="flex flex-col gap-2.5 rounded-xl border border-dash-border p-3.5">
                                <div className="text-sm font-bold">Close shift</div>
                                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Cash counted in the drawer
                                    <input type="number" min={0} step="0.01" placeholder="0.00" value={counted} onChange={(e) => { setCounted(e.target.value); setErr("") }} className={field} />
                                </label>
                                {diff !== null && (
                                    <div className={cn("rounded-[10px] px-3 py-2 text-[13px] font-semibold tabular-nums", diff === 0 ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-danger-soft text-dash-danger-fg")}>
                                        {diff === 0 ? "Matches the expected cash" : `${diff > 0 ? "Over by" : "Short by"} ${fc(Math.abs(diff))}`}
                                    </div>
                                )}
                                <input aria-label="Closing note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required when the count does not match)" className={field} />
                                <button type="button" onClick={doClose} disabled={busy}
                                    className="h-11 rounded-[10px] border border-dash-danger text-sm font-bold text-dash-danger-fg hover:bg-dash-danger-soft disabled:opacity-50">
                                    Close shift
                                </button>
                            </div>
                        </>
                    )}

                    {history.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <div className="text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">Recent shifts</div>
                            {history.map((h) => {
                                const v = h.variance ?? 0
                                return (
                                    <div key={h.id} className="flex justify-between gap-3 border-t border-dash-border-soft py-2 text-[13px]">
                                        <span>{h.register} · {h.no}<br /><span className="text-xs text-dash-muted">{h.closedAt ? new Date(h.closedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></span>
                                        <span className="text-right tabular-nums">Counted {fc(h.countedCash ?? 0)}<br />
                                            <strong className={v === 0 ? "text-dash-success-fg" : "text-dash-danger-fg"}>{v === 0 ? "Matched" : `${v > 0 ? "Over" : "Short"} ${fc(Math.abs(v))}`}</strong>
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
