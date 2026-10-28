"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
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
import { ACCOUNT_TYPES, METHOD_KEYS, todayStr } from "./finance-ui"
import { DatePicker } from "./date-picker"

const Err = ({ msg }: { msg: string }) => (msg ? <p className="text-sm font-medium text-destructive" role="alert">{msg}</p> : null)

function AccountSelect({ id, value, onChange, accounts, exclude, placeholder = "Choose account" }: {
  id: string; value: string; onChange: (v: string) => void; accounts: FinanceAccount[]; exclude?: string; placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
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
    : METHOD_KEYS.map(([key, label]) => ({ key, label, accountId: null }))
  const extra = methods.filter((m) => !options.some((o) => o.key === m)).map((key) => ({ key, label: key, accountId: editing?.id ?? null }))
  const ownerName = (id: number | null) => (id == null || id === editing?.id ? null : accounts.find((a) => a.id === id)?.name ?? null)

  const toggle = (m: string) => setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))

  const submit = async () => {
    if (!name.trim()) { setErr("Account name is required."); return }
    const ob = Number(opening || 0)
    if (!Number.isFinite(ob)) { setErr("Opening balance must be a number."); return }
    if (isDefault && !isActive) { setErr("The default account cannot be inactive."); return }
    setBusy(true); setErr("")
    try {
      const body = { name: name.trim(), type, methodKeys: methods, openingBalance: ob, isActive, note: note.trim() || null }
      if (editing) {
        await financeApi.updateAccount(editing.id, body)
        if (isDefault && !editing.isDefault) await financeApi.setDefaultAccount(editing.id)
      } else {
        await financeApi.createAccount({ ...body, isDefault })
      }
      toast.success(editing ? "Account updated" : "Account created")
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, "Could not save the account."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "Add account"}</DialogTitle>
          <DialogDescription>Payments made with the ticked methods post to this account. Methods no account claims post to the default account.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label="Name" htmlFor="acc-name" required>
            <Input id="acc-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. City Bank current" />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Type" htmlFor="acc-type">
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger id="acc-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Opening balance" htmlFor="acc-opening" description="Balance before any recorded transaction.">
              <Input id="acc-opening" type="number" inputMode="decimal" step="0.01" className="tabular-nums" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </FormField>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Payment methods posted here</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...options, ...extra].map((m) => {
                const owner = ownerName(m.accountId)
                const checked = methods.includes(m.key)
                return (
                  <label key={m.key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(m.key)} />
                    <span>{m.label}</span>
                    {owner && !checked && <span className="truncate text-xs text-muted-foreground">({owner})</span>}
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">A method can belong to one account only. Moving it here takes it off the other account.</p>
          </fieldset>
          <FormField label="Note" htmlFor="acc-note">
            <Input id="acc-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. account number" />
          </FormField>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch id="acc-default" checked={isDefault} disabled={!!editing?.isDefault} onCheckedChange={(v) => { setIsDefault(v); if (v) setIsActive(true) }} />
              <Label htmlFor="acc-default" className="font-normal">Default account</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="acc-active" checked={isActive} onCheckedChange={setIsActive} disabled={isDefault} />
              <Label htmlFor="acc-active" className="font-normal">Active</Label>
            </div>
          </div>
          <Err msg={err} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : editing ? "Save" : "Add account"}</Button>
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
        .catch((e) => setErr(financeError(e, "Could not load this entry.")))
        .finally(() => setBusy(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry])

  const submit = async () => {
    const amt = Number(amount)
    if (!accountId) { setErr("Choose an account."); return }
    if (!(amt > 0)) { setErr("Amount must be greater than zero."); return }
    if (!date) { setErr("Pick a date."); return }
    if (date > todayStr(timezone)) { setErr("Date cannot be in the future."); return }
    setBusy(true); setErr("")
    try {
      const body = {
        accountId: Number(accountId), kind, direction: kind === "adjustment" ? direction : kind === "income" ? "in" as const : "out" as const, amount: amt, date,
        category: category.trim() || undefined, party: party.trim() || undefined, reference: reference.trim() || undefined, note: note.trim() || undefined,
      }
      if (editingId) await financeApi.updateEntry(editingId, body)
      else await financeApi.createEntry(body)
      toast.success(editingId ? "Entry updated" : "Entry added")
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, "Could not save the entry."))
    } finally {
      setBusy(false)
    }
  }

  const partyLabel = kind === "income" || (kind === "adjustment" && direction === "in") ? "Received from" : "Paid to"

  return (
    <Dialog open={entry != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit entry" : "Add entry"}</DialogTitle>
          <DialogDescription>
            Money that is not a sale, purchase or expense. Income and expense entries show in profit &amp; loss as other income / other expenses; adjustments only move the balance.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <SegmentedControl aria-label="Kind" value={kind} onValueChange={(v) => setKind(v as EntryKind)}
            options={[{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }, { value: "adjustment", label: "Adjustment" }]} />
          {kind === "adjustment" && (
            <SegmentedControl aria-label="Adjustment direction" value={direction} onValueChange={(v) => setDirection(v as Direction)}
              options={[{ value: "in", label: "Adds money (in)" }, { value: "out", label: "Removes money (out)" }]} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Account" htmlFor="entry-account" required>
              <AccountSelect id="entry-account" value={accountId} onChange={setAccountId} accounts={accounts} />
            </FormField>
            <FormField label="Amount" htmlFor="entry-amount" required>
              <Input id="entry-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label="Date" htmlFor="entry-date" required>
              <DatePicker id="entry-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label="Category" htmlFor="entry-category">
              <Input id="entry-category" list="entry-category-list" value={category} maxLength={100} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="entry-category-list">{CATEGORY_HINTS[kind].map((c) => <option key={c} value={c} />)}</datalist>
            </FormField>
            <FormField label={partyLabel} htmlFor="entry-party">
              <Input id="entry-party" value={party} maxLength={100} onChange={(e) => setParty(e.target.value)} />
            </FormField>
            <FormField label="Reference" htmlFor="entry-reference">
              <Input id="entry-reference" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Note" htmlFor="entry-note">
            <Textarea id="entry-note" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <Err msg={err} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Add entry"}</Button>
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
        .catch((e) => setErr(financeError(e, "Could not load this transfer.")))
        .finally(() => setBusy(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfer])

  const from = accounts.find((a) => String(a.id) === fromId)

  const submit = async () => {
    const amt = Number(amount)
    if (!fromId) { setErr("Choose the account the money leaves."); return }
    if (!toId) { setErr("Choose the account the money goes to."); return }
    if (fromId === toId) { setErr("Pick two different accounts."); return }
    if (!(amt > 0)) { setErr("Amount must be greater than zero."); return }
    if (!date) { setErr("Pick a date."); return }
    if (date > todayStr(timezone)) { setErr("Date cannot be in the future."); return }
    setBusy(true); setErr("")
    try {
      const body = { fromAccountId: Number(fromId), toAccountId: Number(toId), amount: amt, date, reference: reference.trim() || undefined, note: note.trim() || undefined }
      if (editingId) await financeApi.updateTransfer(editingId, body)
      else await financeApi.createTransfer(body)
      toast.success(editingId ? "Transfer updated" : "Transfer recorded")
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, "Could not save the transfer."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={transfer != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit transfer" : "Transfer between accounts"}</DialogTitle>
          <DialogDescription>For example a cash deposit to the bank, or a bKash cash-out. Shows as two lines in the ledger and never changes total cash.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="From" htmlFor="transfer-from" required description={from ? `Balance ${formatCurrency(from.balance)}` : undefined}>
              <AccountSelect id="transfer-from" value={fromId} onChange={setFromId} accounts={accounts} exclude={toId} />
            </FormField>
            <FormField label="To" htmlFor="transfer-to" required>
              <AccountSelect id="transfer-to" value={toId} onChange={setToId} accounts={accounts} exclude={fromId} />
            </FormField>
            <FormField label="Amount" htmlFor="transfer-amount" required>
              <Input id="transfer-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label="Date" htmlFor="transfer-date" required>
              <DatePicker id="transfer-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label="Reference" htmlFor="transfer-reference">
              <Input id="transfer-reference" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="e.g. deposit slip no" />
            </FormField>
            <FormField label="Note" htmlFor="transfer-note">
              <Input id="transfer-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </div>
          <Err msg={err} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
