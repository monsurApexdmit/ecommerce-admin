import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { apiErrorMessage, apiFieldErrors } from "@/lib/format";
import {
  createFinanceAccount,
  createFinanceEntry,
  createFinanceTransfer,
  getFinanceEntry,
  getFinanceTransfer,
  updateFinanceAccount,
  updateFinanceEntry,
  updateFinanceTransfer,
} from "@/services/finance";
import {
  FINANCE_ACCOUNT_TYPES,
  FINANCE_METHODS,
  type FinanceAccount,
  type FinanceAccountType,
  type FinanceDirection,
  type FinanceEntryKind,
} from "@/types/finance";
import { Field, OptionField, PrimaryButton, Sheet, getFinanceTimezone, isIsoDate, todayIso } from "./ui";

function parseAmount(v: string): number {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

const accountOptions = (accounts: FinanceAccount[]) =>
  accounts.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name }));

// ---------------------------------------------------------------------------
// Manual entry (income / expense / adjustment)
// ---------------------------------------------------------------------------

export function EntrySheet({
  visible,
  entryId,
  accounts,
  defaultAccountId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  entryId?: number | null;
  accounts: FinanceAccount[];
  defaultAccountId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<FinanceEntryKind>("income");
  const [direction, setDirection] = useState<FinanceDirection>("in");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState("");
  const [party, setParty] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    if (!entryId) {
      setKind("income");
      setDirection("in");
      setAccountId(defaultAccountId ?? accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? null);
      setAmount("");
      setDate(todayIso());
      setCategory("");
      setParty("");
      setReference("");
      setNote("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFinanceEntry(entryId)
      .then((e: any) => {
        if (cancelled || !e) return;
        setKind((e.kind ?? "income") as FinanceEntryKind);
        setDirection(e.direction === "out" ? "out" : "in");
        setAccountId(Number(e.accountId) || null);
        setAmount(String(e.amount ?? ""));
        setDate(String(e.date ?? todayIso()).slice(0, 10));
        setCategory(e.category ?? "");
        setParty(e.party ?? "");
        setReference(e.reference ?? "");
        setNote(e.note ?? "");
      })
      .catch((err) => Alert.alert("Couldn't load entry", apiErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, entryId, accounts, defaultAccountId]);

  const save = async () => {
    const e: Record<string, string> = {};
    const amt = parseAmount(amount);
    if (!accountId) e.accountId = "Choose an account.";
    if (!(amt > 0)) e.amount = "Amount must be greater than zero.";
    if (!isIsoDate(date)) e.date = "Use YYYY-MM-DD.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      accountId: accountId!,
      kind,
      direction: kind === "adjustment" ? direction : kind === "income" ? ("in" as const) : ("out" as const),
      amount: amt,
      date,
      category: category.trim() || undefined,
      party: party.trim() || undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    };
    setSaving(true);
    try {
      if (entryId) await updateFinanceEntry(entryId, payload);
      else await createFinanceEntry(payload);
      onSaved();
    } catch (err) {
      const fe = apiFieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) Alert.alert("Couldn't save entry", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={entryId ? "Edit entry" : "Add entry"} onClose={onClose}>
      {loading ? (
        <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 30 }} />
      ) : (
        <>
          <OptionField<FinanceEntryKind>
            label="Type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "income", label: "Income (money in)" },
              { value: "expense", label: "Expense (money out)" },
              { value: "adjustment", label: "Adjustment" },
            ]}
            error={errors.kind}
          />
          {kind === "adjustment" ? (
            <OptionField<FinanceDirection>
              label="Adjustment"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "in", label: "Adds money (in)" },
                { value: "out", label: "Removes money (out)" },
              ]}
              error={errors.direction}
            />
          ) : null}
          <OptionField<number> label="Account" value={accountId} onChange={setAccountId} options={accountOptions(accounts)} error={errors.accountId} />
          <Field label="Amount" value={amount} onChange={setAmount} keyboardType="decimal-pad" placeholder="0.00" error={errors.amount} />
          <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} placeholder={todayIso()} error={errors.date} />
          <Field label="Category" value={category} onChange={setCategory} placeholder="e.g. Interest, Owner investment" error={errors.category} />
          <Field label="Party" value={party} onChange={setParty} placeholder="Who paid / who was paid" error={errors.party} />
          <Field label="Reference" value={reference} onChange={setReference} placeholder="Optional" error={errors.reference} />
          <Field label="Note" value={note} onChange={setNote} multiline placeholder="Optional" error={errors.note} />
          {kind !== "adjustment" ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Shows in Profit & loss as Other {kind === "income" ? "income" : "expenses"}. Adjustments only move balances.
            </Text>
          ) : null}
          <PrimaryButton label={entryId ? "Save changes" : "Add entry"} onPress={save} busy={saving} />
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Transfer between accounts
// ---------------------------------------------------------------------------

export function TransferSheet({
  visible,
  transferId,
  accounts,
  onClose,
  onSaved,
}: {
  visible: boolean;
  transferId?: number | null;
  accounts: FinanceAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    if (!transferId) {
      setFromId(accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? null);
      setToId(null);
      setAmount("");
      setDate(todayIso());
      setReference("");
      setNote("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFinanceTransfer(transferId)
      .then((t: any) => {
        if (cancelled || !t) return;
        setFromId(Number(t.fromAccountId) || null);
        setToId(Number(t.toAccountId) || null);
        setAmount(String(t.amount ?? ""));
        setDate(String(t.date ?? todayIso()).slice(0, 10));
        setReference(t.reference ?? "");
        setNote(t.note ?? "");
      })
      .catch((err) => Alert.alert("Couldn't load transfer", apiErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, transferId, accounts]);

  const { formatCurrency } = useCurrency();
  const from = accounts.find((a) => a.id === fromId);

  const save = async () => {
    const e: Record<string, string> = {};
    const amt = parseAmount(amount);
    if (!fromId) e.fromAccountId = "Choose the account the money leaves.";
    if (!toId) e.toAccountId = "Choose the account the money goes to.";
    if (fromId && toId && fromId === toId) e.toAccountId = "Pick two different accounts.";
    if (!(amt > 0)) e.amount = "Amount must be greater than zero.";
    if (!isIsoDate(date)) e.date = "Use YYYY-MM-DD.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      fromAccountId: fromId!,
      toAccountId: toId!,
      amount: amt,
      date,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    };
    setSaving(true);
    try {
      if (transferId) await updateFinanceTransfer(transferId, payload);
      else await createFinanceTransfer(payload);
      onSaved();
    } catch (err) {
      const fe = apiFieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) Alert.alert("Couldn't save transfer", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={transferId ? "Edit transfer" : "Transfer money"} onClose={onClose}>
      {loading ? (
        <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 30 }} />
      ) : (
        <>
          <OptionField<number> label="From account" value={fromId} onChange={setFromId} options={accountOptions(accounts)} error={errors.fromAccountId} />
          <OptionField<number>
            label="To account"
            value={toId}
            onChange={setToId}
            options={accountOptions(accounts).filter((o) => o.value !== fromId)}
            error={errors.toAccountId}
          />
          <Field label="Amount" value={amount} onChange={setAmount} keyboardType="decimal-pad" placeholder="0.00" error={errors.amount} />
          {from ? <Text style={{ color: colors.muted, fontSize: 12 }}>{from.name} balance: {formatCurrency(from.balance)}</Text> : null}
          <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} placeholder={todayIso()} error={errors.date} />
          <Field label="Reference" value={reference} onChange={setReference} placeholder="Optional" error={errors.reference} />
          <Field label="Note" value={note} onChange={setNote} multiline placeholder="e.g. Cash deposit to bank" error={errors.note} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Transfers move money between accounts; total cash stays the same.</Text>
          <PrimaryButton label={transferId ? "Save changes" : "Record transfer"} onPress={save} busy={saving} />
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Account add / edit
// ---------------------------------------------------------------------------

export function AccountSheet({
  visible,
  account,
  takenMethods,
  onClose,
  onSaved,
}: {
  visible: boolean;
  account: FinanceAccount | null;
  /** method key → account name already mapping it (excluding this account). */
  takenMethods: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FinanceAccountType>("cash");
  const [methods, setMethods] = useState<string[]>([]);
  const [opening, setOpening] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setName(account?.name ?? "");
    setType(account?.type ?? "cash");
    setMethods(account?.methodKeys ?? []);
    setOpening(String(account?.openingBalance ?? 0));
    setIsActive(account?.isActive ?? true);
    setNote(account?.note ?? "");
  }, [visible, account]);

  const toggleMethod = (key: string) =>
    setMethods((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  const save = async () => {
    const e: Record<string, string> = {};
    const ob = opening.trim() === "" ? 0 : parseAmount(opening);
    if (!name.trim()) e.name = "Account name is required.";
    if (!Number.isFinite(ob)) e.openingBalance = "Opening balance must be a number.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = { name: name.trim(), type, methodKeys: methods, openingBalance: ob, isActive, note: note.trim() || null };
    setSaving(true);
    try {
      if (account) await updateFinanceAccount(account.id, payload);
      else await createFinanceAccount(payload);
      onSaved();
    } catch (err) {
      const fe = apiFieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) Alert.alert("Couldn't save account", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={account ? "Edit account" : "New account"} onClose={onClose}>
      <Field label="Name" value={name} onChange={setName} placeholder="e.g. City Bank" error={errors.name} />
      <OptionField<FinanceAccountType> label="Type" value={type} onChange={setType} options={FINANCE_ACCOUNT_TYPES} error={errors.type} />
      <View style={{ gap: 5 }}>
        <OptionField<string>
          label="Payment methods that post here"
          value={null}
          onChange={toggleMethod}
          isSelected={(k) => methods.includes(k)}
          options={FINANCE_METHODS.map((m) => ({
            value: m.key,
            label: `${m.label}${takenMethods[m.key] && !methods.includes(m.key) ? ` · ${takenMethods[m.key]}` : ""}`,
          }))}
          error={errors.methodKeys}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Unmapped methods post to the default account. A method can belong to one account only.
        </Text>
      </View>
      <Field label="Opening balance" value={opening} onChange={setOpening} keyboardType="numbers-and-punctuation" error={errors.openingBalance} />
      {account && !account.isDefault ? (
        <OptionField<string>
          label="Status"
          value={isActive ? "active" : "inactive"}
          onChange={(v) => setIsActive(v === "active")}
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          error={errors.isActive}
        />
      ) : null}
      <Field label="Note" value={note} onChange={setNote} multiline placeholder="e.g. A/C number" error={errors.note} />
      <PrimaryButton label={account ? "Save account" : "Create account"} onPress={save} busy={saving} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Generic "pay / collect" sheet that calls an existing payment endpoint
// ---------------------------------------------------------------------------

export type PaymentSheetValues = { amount: number; method: string; date: string; reference?: string; notes?: string };

const PAY_METHODS = FINANCE_METHODS.filter((m) => ["cash", "bank", "bkash", "nagad", "card", "rocket", "cheque"].includes(m.key));

export function PaymentSheet({
  visible,
  title,
  subtitle,
  defaultAmount,
  maxAmount,
  withAmount = true,
  withReference = true,
  submitLabel,
  onClose,
  onSubmit,
  extra,
}: {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  /** Shown under the subtitle (e.g. the payable-now breakdown). */
  extra?: ReactNode;
  defaultAmount?: number;
  maxAmount?: number;
  withAmount?: boolean;
  withReference?: boolean;
  submitLabel: string;
  onClose: () => void;
  /** Throw to keep the sheet open; field errors from a 422 are shown inline. */
  onSubmit: (values: PaymentSheetValues) => Promise<void>;
}) {
  const { formatCurrency } = useCurrency();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmount(defaultAmount ? String(Math.round(defaultAmount * 100) / 100) : "");
    setMethod("cash");
    setDate(todayIso());
    setReference("");
    setNotes("");
    setErrors({});
  }, [visible, defaultAmount]);

  const save = async () => {
    const e: Record<string, string> = {};
    const amt = parseAmount(amount);
    if (withAmount && !(amt > 0)) e.amount = "Amount must be greater than zero.";
    if (withAmount && maxAmount !== undefined && amt > maxAmount + 0.001) e.amount = `Amount cannot exceed ${formatCurrency(maxAmount)}.`;
    if (!isIsoDate(date)) e.date = "Use YYYY-MM-DD.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSubmit({
        amount: withAmount ? amt : 0,
        method,
        date,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      const fe = apiFieldErrors(err);
      const mapped: Record<string, string> = {};
      Object.entries(fe).forEach(([k, v]) => {
        const key = /amount/i.test(k) ? "amount" : /date/i.test(k) ? "date" : /method/i.test(k) ? "method" : k;
        mapped[key] = v;
      });
      setErrors(mapped);
      if (!mapped.amount && !mapped.date && !mapped.method) Alert.alert("Couldn't save", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {subtitle ? <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800" }}>{subtitle}</Text> : null}
      {extra}
      {withAmount ? (
        <Field label="Amount" value={amount} onChange={setAmount} keyboardType="decimal-pad" placeholder="0.00" error={errors.amount} />
      ) : null}
      <OptionField<string>
        label="Method"
        value={method}
        onChange={setMethod}
        options={PAY_METHODS.map((m) => ({ value: m.key, label: m.label }))}
        error={errors.method}
      />
      <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} placeholder={todayIso()} error={errors.date} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Calendar date in {getFinanceTimezone()} (company time zone).</Text>
      {withReference ? (
        <>
          <Field label="Reference" value={reference} onChange={setReference} placeholder="Optional" error={errors.reference} />
          <Field label="Notes" value={notes} onChange={setNotes} multiline placeholder="Optional" error={errors.notes} />
        </>
      ) : null}
      <PrimaryButton label={submitLabel} onPress={save} busy={saving} />
    </Sheet>
  );
}
