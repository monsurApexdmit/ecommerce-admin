"use client"

import { Fragment, useEffect, useState } from "react"
import { X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiError, posApi, REGISTERS, type RegisterSession } from "@/lib/posApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
                className="max-h-[92vh] w-[calc(100%-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]"
            >
                <DialogHeader className="flex-row items-start justify-between gap-3 px-6 py-[18px] text-left">
                    <div className="flex flex-col gap-0.5">
                        <DialogTitle>Cash drawer</DialogTitle>
                        <DialogDescription>
                            {session
                                ? `${session.register} · opened ${new Date(session.openedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} by ${session.openedBy || "staff"}`
                                : "Start a shift to take cash and track the drawer"}
                        </DialogDescription>
                    </div>
                    <Button type="button" variant="outline" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}>
                        <X className="size-[18px]" />
                    </Button>
                </DialogHeader>
                <Separator />

                <div className="flex flex-col gap-5 px-6 py-5">
                    {err && <Alert variant="destructive" role="alert"><AlertDescription>{err}</AlertDescription></Alert>}

                    {!session && (
                        <div className="flex flex-col gap-3">
                            <Alert>
                                <AlertDescription>No shift is open. Count the cash in the drawer and start a shift to begin selling.</AlertDescription>
                            </Alert>
                            <FormField label="Register" htmlFor="pos-register">
                                <Select value={register} onValueChange={onRegisterChange}>
                                    <SelectTrigger id="pos-register" className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>{REGISTERS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormField>
                            <FormField label="Opening cash (float)" htmlFor="pos-opening-cash">
                                <Input id="pos-opening-cash" type="number" min={0} step="0.01" placeholder="0.00" value={openAmt} onChange={(e) => setOpenAmt(e.target.value)} />
                            </FormField>
                            <Button type="button" size="lg" onClick={doOpen} disabled={busy}>
                                {busy ? "Opening…" : "Open shift"}
                            </Button>
                        </div>
                    )}

                    {session && s && (
                        <>
                            <Card className="flex-row items-start justify-between gap-3 bg-muted/50 p-4 shadow-none">
                                <div>
                                    <div className="text-xs text-muted-foreground">Cash on hand</div>
                                    <div className="text-3xl font-bold tabular-nums">{fc(expected)}</div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">{session.no}<br />since {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            </Card>

                            <div className="flex flex-col text-sm tabular-nums">
                                <InfoList className="gap-0">
                                    {rows.map(([k, v, tone]) => (
                                        <Fragment key={k}>
                                            <InfoRow label={k} className="py-2" value={<span className={cn("font-semibold", tone === "neg" && "text-destructive")}>{v}</span>} />
                                            <Separator />
                                        </Fragment>
                                    ))}
                                </InfoList>
                                <div className="flex justify-between py-2 text-xs text-muted-foreground">
                                    <span>Non-cash sales this shift (not in drawer)</span>
                                    <span className="font-semibold">{fc(s.nonCashSales)}</span>
                                </div>
                            </div>

                            <Card className="gap-2.5 p-3.5 shadow-none">
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(["in", "out"] as const).map((t) => (
                                        <Button key={t} type="button" onClick={() => setMvType(t)}
                                            variant={mvType === t ? (t === "in" ? "default" : "destructive") : "outline"}>
                                            {t === "in" ? "+ Cash in" : "− Cash out"}
                                        </Button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-[110px_1fr_auto] gap-2">
                                    <Input type="number" min={0} step="0.01" aria-label="Amount" placeholder="Amount" value={mvAmt} onChange={(e) => setMvAmt(e.target.value)} />
                                    <Input aria-label="Reason" value={mvReason} onChange={(e) => setMvReason(e.target.value)}
                                        placeholder={mvType === "in" ? "Reason (e.g. float top-up)" : "Reason (e.g. bank deposit, petty cash)"} />
                                    <Button type="button" onClick={doMove} disabled={busy}>Record</Button>
                                </div>
                                {s.movements.length > 0 && (
                                    <ul className="flex flex-col text-sm">
                                        {[...s.movements].reverse().slice(0, 6).map((m) => (
                                            <li key={m.id} className="flex flex-col">
                                                <Separator />
                                                <div className="flex justify-between py-1.5">
                                                    <span>
                                                        <strong className={m.type === "in" ? "text-foreground" : "text-destructive"}>{m.type === "in" ? "+" : "−"}</strong> {m.reason}{" "}
                                                        <span className="text-muted-foreground">· {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                    </span>
                                                    <span className="font-semibold tabular-nums">{fc(m.amount)}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <SectionCard title="Close shift" className="gap-2.5 py-3.5 shadow-none" contentClassName="flex flex-col gap-2.5 px-3.5">
                                <FormField label="Cash counted in the drawer" htmlFor="pos-counted-cash">
                                    <Input id="pos-counted-cash" type="number" min={0} step="0.01" placeholder="0.00" value={counted} onChange={(e) => { setCounted(e.target.value); setErr("") }} />
                                </FormField>
                                {diff !== null && (
                                    <Alert variant={diff === 0 ? "default" : "destructive"} className="font-semibold tabular-nums">
                                        <AlertDescription>{diff === 0 ? "Matches the expected cash" : `${diff > 0 ? "Over by" : "Short by"} ${fc(Math.abs(diff))}`}</AlertDescription>
                                    </Alert>
                                )}
                                <Input aria-label="Closing note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required when the count does not match)" />
                                <Button type="button" variant="destructive" onClick={doClose} disabled={busy}>
                                    Close shift
                                </Button>
                            </SectionCard>
                        </>
                    )}

                    {history.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <SectionTitle as="h3">Recent shifts</SectionTitle>
                            {history.map((h) => {
                                const v = h.variance ?? 0
                                return (
                                    <Fragment key={h.id}>
                                        <Separator />
                                        <div className="flex justify-between gap-3 py-2 text-sm">
                                            <span>{h.register} · {h.no}<br /><span className="text-xs text-muted-foreground">{h.closedAt ? new Date(h.closedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></span>
                                            <span className="text-right tabular-nums">Counted {fc(h.countedCash ?? 0)}<br />
                                                <StatusBadge status={v === 0 ? "matched" : "short"} variant={v === 0 ? "default" : "destructive"} label={v === 0 ? "Matched" : `${v > 0 ? "Over" : "Short"} ${fc(Math.abs(v))}`} />
                                            </span>
                                        </div>
                                    </Fragment>
                                )
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
