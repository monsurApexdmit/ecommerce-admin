"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useCompanySettings } from "@/contexts/company-settings-context"
import financeApi, { financeError, type AccountType, type Direction, type EntryKind, type FinanceAccount, type MethodOption } from "@/lib/financeApi"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { todayStr } from "./finance-ui"
import { ACCOUNT_TYPE_CODES, FIN_NS, METHOD_CODES, accountTypeText, methodText } from "./i18n"
import { DatePicker } from "./date-picker"

const Err = ({ msg }: { msg: string }) => (msg ? <p className="text-sm font-medium text-destructive" role="alert">{msg}</p> : null)

function AccountSelect({ id, value, onChange, accounts, exclude, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; accounts: FinanceAccount[]; exclude?: string; placeholder?: string
}) {
  const { t } = useTranslation(FIN_NS)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder ?? t("finance:account.choose")} /></SelectTrigger>
      <SelectContent>
        {accounts.filter((a) => (a.isActive || String(a.id) === value) && String(a.id) !== exclude).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

// ─── Account ─────────────────────────────────────────────────────────────────

/** Create / edit an account. `account === null` closes; `"new"` creates. */
export function AccountDialog({ account, accounts, methodOptions, onClose, onSaved }: {
  account: FinanceAccount | "new" | null
  accounts: FinanceAccount[]
  methodOptions: MethodOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation(FIN_NS)
  const editing = account && account !== "new" ? account : null
  const [name, setName] = useState("")
  const [type, setType] = useState<AccountType>("cash")
  const [methods, setMethods] = useState<string[]>([])
  const [opening, setOpening] = useState("0")
  const [isDefault, setIsDefault] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!account) return
    setErr(""); setBusy(false)
    setName(editing?.name ?? ""); setType(editing?.type ?? "cash"); setMethods(editing?.methodKeys ?? [])
    setOpening(String(editing?.openingBalance ?? 0)); setIsDefault(editing?.isDefault ?? false); setIsActive(editing?.isActive ?? true); setNote(editing?.note ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  // Known keys first (server list, else the contract list), then any custom keys already on the account.
  const options: { key: string; label: string; accountId: number | null }[] = methodOptions.length
    ? methodOptions
    : METHOD_CODES.map((key) => ({ key, label: methodText(t, key), accountId: null }))
  const extra = methods.filter((m) => !options.some((o) => o.key === m)).map((key) => ({ key, label: key, accountId: editing?.id ?? null }))
  const ownerName = (id: number | null) => (id == null || id === editing?.id ? null : accounts.find((a) => a.id === id)?.name ?? null)

  const toggle = (m: string) => setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))

  const submit = async () => {
    if (!name.trim()) { setErr(t("finance:account.nameRequired")); return }
    const ob = Number(opening || 0)
    if (!Number.isFinite(ob)) { setErr(t("finance:account.openingNumber")); return }
    if (isDefault && !isActive) { setErr(t("finance:account.defaultInactive")); return }
    setBusy(true); setErr("")
    try {
      const body = { name: name.trim(), type, methodKeys: methods, openingBalance: ob, isActive, note: note.trim() || null }
      if (editing) {
        await financeApi.updateAccount(editing.id, body)
        if (isDefault && !editing.isDefault) await financeApi.setDefaultAccount(editing.id)
      } else {
        await financeApi.createAccount({ ...body, isDefault })
      }
      toast.success(editing ? t("finance:account.updated") : t("finance:account.created"))
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, t("finance:account.saveFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("finance:account.edit") : t("finance:account.add")}</DialogTitle>
          <DialogDescription>{t("finance:account.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label={t("common:fields.name")} htmlFor="acc-name" required>
            <Input id="acc-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={t("finance:account.namePh")} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("common:fields.type")} htmlFor="acc-type">
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger id="acc-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPE_CODES.map((v) => <SelectItem key={v} value={v}>{accountTypeText(t, v)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("finance:account.opening")} htmlFor="acc-opening" description={t("finance:account.openingHelp")}>
              <Input id="acc-opening" type="number" inputMode="decimal" step="0.01" className="tabular-nums" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </FormField>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("finance:account.methods")}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...options, ...extra].map((m) => {
                const owner = ownerName(m.accountId)
                const checked = methods.includes(m.key)
                return (
                  <label key={m.key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(m.key)} />
                    <span>{methodText(t, m.key, m.label)}</span>
                    {owner && !checked && <span className="truncate text-xs text-muted-foreground">({owner})</span>}
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t("finance:account.methodsHelp")}</p>
          </fieldset>
          <FormField label={t("common:fields.note")} htmlFor="acc-note">
            <Input id="acc-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t("finance:account.notePh")} />
          </FormField>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch id="acc-default" checked={isDefault} disabled={!!editing?.isDefault} onCheckedChange={(v) => { setIsDefault(v); if (v) setIsActive(true) }} />
              <Label htmlFor="acc-default" className="font-normal">{t("finance:account.isDefault")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="acc-active" checked={isActive} onCheckedChange={setIsActive} disabled={isDefault} />
              <Label htmlFor="acc-active" className="font-normal">{t("common:status.active")}</Label>
            </div>
          </div>
          <Err msg={err} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? t("common:actions.saving") : editing ? t("common:actions.save") : t("finance:account.add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Manual entry ────────────────────────────────────────────────────────────

const CATEGORY_HINTS: Record<EntryKind, string[]> = {
  income: ["Owner investment", "Loan received", "Interest", "Other income"],
  expense: ["Owner drawing", "Loan repayment", "Bank charges", "Other expense"],
  adjustment: ["Opening correction", "Cash count difference", "Correction"],
}

/** Add (`"new"`) or edit (entry id) a manual income / expense / adjustment entry. */
export function EntryDialog({ entry, accounts, onClose, onSaved }: {
  entry: "new" | number | null; accounts: FinanceAccount[]; onClose: () => void; onSaved: () => void
}) {
  const { timezone } = useCompanySettings()
  const { t } = useTranslation(FIN_NS)
  const editingId = typeof entry === "number" ? entry : null
  const [kind, setKind] = useState<EntryKind>("income")
  const [direction, setDirection] = useState<Direction>("in")
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayStr(timezone))
  const [category, setCategory] = useState("")
  const [party, setParty] = useState("")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (entry == null) return
    setErr(""); setBusy(false)
    const def = accounts.find((a) => a.isDefault) ?? accounts.find((a) => a.isActive)
    setKind("income"); setDirection("in"); setAccountId(def ? String(def.id) : ""); setAmount(""); setDate(todayStr(timezone))
    setCategory(""); setParty(""); setReference(""); setNote("")
    if (editingId) {
      setBusy(true)
      financeApi.getEntry(editingId)
        .then((e) => {
          setKind(e.kind); setDirection(e.direction); setAccountId(String(e.accountId)); setAmount(String(e.amount)); setDate(e.date)
          setCategory(e.category ?? ""); setParty(e.party ?? ""); setReference(e.reference ?? ""); setNote(e.note ?? "")
        })
        .catch((e) => setErr(financeError(e, t("finance:entry.loadFailed"))))
        .finally(() => setBusy(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry])

  const submit = async () => {
    const amt = Number(amount)
    if (!accountId) { setErr(t("finance:entry.chooseAccount")); return }
    if (!(amt > 0)) { setErr(t("finance:form.amountPositive")); return }
    if (!date) { setErr(t("finance:form.pickDate")); return }
    if (date > todayStr(timezone)) { setErr(t("finance:form.dateFuture")); return }
    setBusy(true); setErr("")
    try {
      const body = {
        accountId: Number(accountId), kind, direction: kind === "adjustment" ? direction : kind === "income" ? "in" as const : "out" as const, amount: amt, date,
        category: category.trim() || undefined, party: party.trim() || undefined, reference: reference.trim() || undefined, note: note.trim() || undefined,
      }
      if (editingId) await financeApi.updateEntry(editingId, body)
      else await financeApi.createEntry(body)
      toast.success(editingId ? t("finance:entry.updated") : t("finance:entry.added"))
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, t("finance:entry.saveFailed")))
    } finally {
      setBusy(false)
    }
  }

  const partyLabel = kind === "income" || (kind === "adjustment" && direction === "in") ? t("finance:entry.receivedFrom") : t("finance:entry.paidTo")

  return (
    <Dialog open={entry != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? t("finance:entry.edit") : t("finance:entry.add")}</DialogTitle>
          <DialogDescription>{t("finance:entry.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <SegmentedControl aria-label={t("finance:entry.kind")} value={kind} onValueChange={(v) => setKind(v as EntryKind)}
            options={[{ value: "income", label: t("finance:entry.income") }, { value: "expense", label: t("finance:entry.expense") }, { value: "adjustment", label: t("finance:entry.adjustment") }]} />
          {kind === "adjustment" && (
            <SegmentedControl aria-label={t("finance:entry.adjDirection")} value={direction} onValueChange={(v) => setDirection(v as Direction)}
              options={[{ value: "in", label: t("finance:entry.addsMoney") }, { value: "out", label: t("finance:entry.removesMoney") }]} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("finance:col.account")} htmlFor="entry-account" required>
              <AccountSelect id="entry-account" value={accountId} onChange={setAccountId} accounts={accounts} />
            </FormField>
            <FormField label={t("common:money.amount")} htmlFor="entry-amount" required>
              <Input id="entry-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label={t("common:fields.date")} htmlFor="entry-date" required>
              <DatePicker id="entry-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label={t("common:fields.category")} htmlFor="entry-category">
              <Input id="entry-category" list="entry-category-list" value={category} maxLength={100} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="entry-category-list">{CATEGORY_HINTS[kind].map((c) => <option key={c} value={c} />)}</datalist>
            </FormField>
            <FormField label={partyLabel} htmlFor="entry-party">
              <Input id="entry-party" value={party} maxLength={100} onChange={(e) => setParty(e.target.value)} />
            </FormField>
            <FormField label={t("common:extra.reference")} htmlFor="entry-reference">
              <Input id="entry-reference" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
            </FormField>
          </div>
          <FormField label={t("common:fields.note")} htmlFor="entry-note">
            <Textarea id="entry-note" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <Err msg={err} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? t("common:actions.saving") : editingId ? t("common:actions.save") : t("finance:entry.add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Transfer ────────────────────────────────────────────────────────────────

/** Move money between two accounts (`"new"` or a transfer id to edit). */
export function TransferDialog({ transfer, accounts, onClose, onSaved }: {
  transfer: "new" | number | null; accounts: FinanceAccount[]; onClose: () => void; onSaved: () => void
}) {
  const { formatCurrency, timezone } = useCompanySettings()
  const { t } = useTranslation(FIN_NS)
  const editingId = typeof transfer === "number" ? transfer : null
  const [fromId, setFromId] = useState("")
  const [toId, setToId] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayStr(timezone))
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (transfer == null) return
    setErr(""); setBusy(false); setAmount(""); setDate(todayStr(timezone)); setReference(""); setNote("")
    const active = accounts.filter((a) => a.isActive)
    const def = active.find((a) => a.isDefault) ?? active[0]
    setFromId(def ? String(def.id) : ""); setToId(String(active.find((a) => a.id !== def?.id)?.id ?? ""))
    if (editingId) {
      setBusy(true)
      financeApi.getTransfer(editingId)
        .then((t) => { setFromId(String(t.fromAccountId)); setToId(String(t.toAccountId)); setAmount(String(t.amount)); setDate(t.date); setReference(t.reference ?? ""); setNote(t.note ?? "") })
        .catch((e) => setErr(financeError(e, t("finance:transfer.loadFailed"))))
        .finally(() => setBusy(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfer])

  const from = accounts.find((a) => String(a.id) === fromId)

  const submit = async () => {
    const amt = Number(amount)
    if (!fromId) { setErr(t("finance:transfer.chooseFrom")); return }
    if (!toId) { setErr(t("finance:transfer.chooseTo")); return }
    if (fromId === toId) { setErr(t("finance:transfer.different")); return }
    if (!(amt > 0)) { setErr(t("finance:form.amountPositive")); return }
    if (!date) { setErr(t("finance:form.pickDate")); return }
    if (date > todayStr(timezone)) { setErr(t("finance:form.dateFuture")); return }
    setBusy(true); setErr("")
    try {
      const body = { fromAccountId: Number(fromId), toAccountId: Number(toId), amount: amt, date, reference: reference.trim() || undefined, note: note.trim() || undefined }
      if (editingId) await financeApi.updateTransfer(editingId, body)
      else await financeApi.createTransfer(body)
      toast.success(editingId ? t("finance:transfer.updated") : t("finance:transfer.recorded"))
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, t("finance:transfer.saveFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={transfer != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingId ? t("finance:transfer.edit") : t("finance:transfer.title")}</DialogTitle>
          <DialogDescription>{t("finance:transfer.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("common:extra.from")} htmlFor="transfer-from" required description={from ? t("finance:transfer.balance", { amount: formatCurrency(from.balance) }) : undefined}>
              <AccountSelect id="transfer-from" value={fromId} onChange={setFromId} accounts={accounts} exclude={toId} />
            </FormField>
            <FormField label={t("common:extra.to")} htmlFor="transfer-to" required>
              <AccountSelect id="transfer-to" value={toId} onChange={setToId} accounts={accounts} exclude={fromId} />
            </FormField>
            <FormField label={t("common:money.amount")} htmlFor="transfer-amount" required>
              <Input id="transfer-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label={t("common:fields.date")} htmlFor="transfer-date" required>
              <DatePicker id="transfer-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label={t("common:extra.reference")} htmlFor="transfer-reference">
              <Input id="transfer-reference" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder={t("finance:transfer.referencePh")} />
            </FormField>
            <FormField label={t("common:fields.note")} htmlFor="transfer-note">
              <Input id="transfer-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </div>
          <Err msg={err} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? t("common:actions.saving") : editingId ? t("common:actions.save") : t("finance:transfer.button")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
