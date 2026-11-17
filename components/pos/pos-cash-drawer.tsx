"use client"

import { Fragment, useEffect, useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiError, posApi, REGISTERS, type RegisterSession } from "@/lib/posApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
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
import { WithTooltip } from "@/components/common/WithTooltip"

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

/** Display name of a register. The stored value ("Register 1") is sent to the API unchanged. */
export function useRegisterLabel() {
    const { t } = useTranslation(["pos"])
    return (r: string) => {
        const m = /^Register (\d+)$/.exec(r)
        return m ? t("pos:drawer.registerN", { n: m[1] }) : r
    }
}

/** Cash drawer: open a shift, record cash in/out, close with a count. */
export function PosCashDrawer({ open, onOpenChange, register, onRegisterChange, locationId, session, history, onChanged, initialError }: Props) {
    const { t, i18n } = useTranslation(["pos", "common"])
    const regLabel = useRegisterLabel()
    const locale = localeTag(i18n.language)
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
            setErr(apiError(e, t("common:status.error")))
        } finally {
            setBusy(false)
        }
    }

    const doOpen = () => {
        if (openAmt === "") return setErr(t("pos:drawer.enterOpening"))
        const amount = Number(openAmt)
        if (!(amount >= 0)) return setErr(t("pos:drawer.openingMin"))
        run(() => posApi.openShift({ register, locationId, openingCash: amount }), t("pos:drawer.shiftOpened", { register: regLabel(register) }), () => { setOpenAmt(""); onOpenChange(false) })
    }

    const doMove = () => {
        if (!session) return
        const amount = Number(mvAmt)
        if (!(amount > 0)) return setErr(t("pos:drawer.amountMin"))
        if (!mvReason.trim()) return setErr(t("pos:drawer.addReason"))
        run(
            () => posApi.cashMovement(session.id, { type: mvType, amount, reason: mvReason.trim() }),
            t(mvType === "in" ? "pos:drawer.cashInRecorded" : "pos:drawer.cashOutRecorded", { amount: fc(amount) }),
            () => { setMvAmt(""); setMvReason("") },
        )
    }

    const doClose = () => {
        if (!session) return
        if (counted === "") return setErr(t("pos:drawer.enterCounted"))
        if (!window.confirm(t("pos:drawer.confirmClose", { register: regLabel(session.register), expected: fc(expected), counted: fc(Number(counted)) }))) return
        run(() => posApi.closeShift(session.id, { counted: Number(counted), note: note.trim() || undefined }), t("pos:drawer.shiftClosed"), () => {
            setCounted(""); setNote(""); onOpenChange(false)
        })
    }

    const rows: [string, string, "pos" | "neg" | "plain"][] = s
        ? [
            [t("pos:drawer.rowOpening"), fc(s.opening), "plain"],
            [t("pos:drawer.rowCashSales", { count: s.saleCount }), `+ ${fc(s.cashSales)}`, "pos"],
            [t("pos:drawer.rowCollections"), `+ ${fc(s.collections)}`, "pos"],
            [t("pos:drawer.rowCashIn"), `+ ${fc(s.cashIn)}`, "pos"],
            [t("pos:drawer.rowCashOut"), `− ${fc(s.cashOut)}`, "neg"],
            [t("pos:drawer.rowRefunds"), `− ${fc(s.refunds)}`, "neg"],
            [t("pos:drawer.rowExpenses"), `− ${fc(s.expenses)}`, "neg"],
            [t("pos:drawer.rowSupplier"), `− ${fc(s.supplierPaid)}`, "neg"],
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
                        <DialogTitle>{t("pos:drawer.title")}</DialogTitle>
                        <DialogDescription>
                            {session
                                ? t("pos:drawer.openedBy", {
                                    register: regLabel(session.register),
                                    time: new Date(session.openedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                                    user: session.openedBy || t("pos:drawer.staff"),
                                })
                                : t("pos:drawer.startHint")}
                        </DialogDescription>
                    </div>
                    <WithTooltip content={t("common:actions.close")}><Button type="button" variant="outline" size="icon" aria-label={t("common:actions.close")} onClick={() => onOpenChange(false)}>
                        <X className="size-[18px]" />
                    </Button></WithTooltip>
                </DialogHeader>
                <Separator />

                <div className="flex flex-col gap-5 px-6 py-5">
                    {err && <Alert variant="destructive" role="alert"><AlertDescription>{err}</AlertDescription></Alert>}

                    {!session && (
                        <div className="flex flex-col gap-3">
                            <Alert>
                                <AlertDescription>{t("pos:drawer.noShift")}</AlertDescription>
                            </Alert>
                            <FormField label={t("pos:drawer.register")} htmlFor="pos-register">
                                <Select value={register} onValueChange={onRegisterChange}>
                                    <SelectTrigger id="pos-register" className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>{REGISTERS.map((r) => <SelectItem key={r} value={r}>{regLabel(r)}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormField>
                            <FormField label={t("pos:drawer.openingCash")} htmlFor="pos-opening-cash">
                                <Input id="pos-opening-cash" type="number" min={0} step="0.01" placeholder="0.00" value={openAmt} onChange={(e) => setOpenAmt(e.target.value)} />
                            </FormField>
                            <Button type="button" size="lg" onClick={doOpen} disabled={busy}>
                                {busy ? t("pos:drawer.opening") : t("pos:drawer.openShift")}
                            </Button>
                        </div>
                    )}

                    {session && s && (
                        <>
                            <Card className="flex-row items-start justify-between gap-3 bg-muted/50 p-4 shadow-none">
                                <div>
                                    <div className="text-xs text-muted-foreground">{t("pos:drawer.cashOnHand")}</div>
                                    <div className="text-3xl font-bold tabular-nums">{fc(expected)}</div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">{session.no}<br />{t("pos:drawer.since", { time: new Date(session.openedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })}</div>
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
                                    <span>{t("pos:drawer.nonCash")}</span>
                                    <span className="font-semibold">{fc(s.nonCashSales)}</span>
                                </div>
                            </div>

                            <Card className="gap-2.5 p-3.5 shadow-none">
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(["in", "out"] as const).map((dir) => (
                                        <Button key={dir} type="button" onClick={() => setMvType(dir)} className="min-w-0"
                                            variant={mvType === dir ? (dir === "in" ? "default" : "destructive") : "outline"}>
                                            <span className="truncate">{dir === "in" ? t("pos:drawer.cashInBtn") : t("pos:drawer.cashOutBtn")}</span>
                                        </Button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-[110px_1fr_auto] gap-2">
                                    <Input type="number" min={0} step="0.01" aria-label={t("common:money.amount")} placeholder={t("common:money.amount")} value={mvAmt} onChange={(e) => setMvAmt(e.target.value)} />
                                    <Input aria-label={t("pos:drawer.reason")} value={mvReason} onChange={(e) => setMvReason(e.target.value)}
                                        placeholder={mvType === "in" ? t("pos:drawer.reasonIn") : t("pos:drawer.reasonOut")} />
                                    <Button type="button" onClick={doMove} disabled={busy}>{t("pos:drawer.record")}</Button>
                                </div>
                                {s.movements.length > 0 && (
                                    <ul className="flex flex-col text-sm">
                                        {[...s.movements].reverse().slice(0, 6).map((m) => (
                                            <li key={m.id} className="flex flex-col">
                                                <Separator />
                                                <div className="flex justify-between py-1.5">
                                                    <span>
                                                        <strong className={m.type === "in" ? "text-foreground" : "text-destructive"}>{m.type === "in" ? "+" : "−"}</strong> {m.reason}{" "}
                                                        <span className="text-muted-foreground">· {new Date(m.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                                                    </span>
                                                    <span className="font-semibold tabular-nums">{fc(m.amount)}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <SectionCard title={t("pos:drawer.closeShift")} className="gap-2.5 py-3.5 shadow-none" contentClassName="flex flex-col gap-2.5 px-3.5">
                                <FormField label={t("pos:drawer.counted")} htmlFor="pos-counted-cash">
                                    <Input id="pos-counted-cash" type="number" min={0} step="0.01" placeholder="0.00" value={counted} onChange={(e) => { setCounted(e.target.value); setErr("") }} />
                                </FormField>
                                {diff !== null && (
                                    <Alert variant={diff === 0 ? "default" : "destructive"} className="font-semibold tabular-nums">
                                        <AlertDescription>{diff === 0 ? t("pos:drawer.matches") : t(diff > 0 ? "pos:drawer.overBy" : "pos:drawer.shortBy", { amount: fc(Math.abs(diff)) })}</AlertDescription>
                                    </Alert>
                                )}
                                <Input aria-label={t("pos:drawer.closingNote")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("pos:drawer.notePlaceholder")} />
                                <Button type="button" variant="destructive" onClick={doClose} disabled={busy}>
                                    {t("pos:drawer.closeShift")}
                                </Button>
                            </SectionCard>
                        </>
                    )}

                    {history.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <SectionTitle as="h3">{t("pos:drawer.recent")}</SectionTitle>
                            {history.map((h) => {
                                const v = h.variance ?? 0
                                return (
                                    <Fragment key={h.id}>
                                        <Separator />
                                        <div className="flex justify-between gap-3 py-2 text-sm">
                                            <span>{regLabel(h.register)} · {h.no}<br /><span className="text-xs text-muted-foreground">{h.closedAt ? new Date(h.closedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></span>
                                            <span className="text-right tabular-nums">{t("pos:drawer.countedAmount", { amount: fc(h.countedCash ?? 0) })}<br />
                                                <StatusBadge status={v === 0 ? "matched" : "short"} variant={v === 0 ? "default" : "destructive"} label={v === 0 ? t("pos:drawer.matched") : t(v > 0 ? "pos:drawer.over" : "pos:drawer.short", { amount: fc(Math.abs(v)) })} />
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
