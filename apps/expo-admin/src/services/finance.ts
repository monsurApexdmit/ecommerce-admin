import { api } from "@/lib/api";
import type {
  FinanceAccount,
  FinanceAccountDraft,
  FinanceAccountsResult,
  FinanceAgingBucket,
  FinanceAgingReport,
  FinanceAlert,
  FinanceCashflow,
  FinanceCategoryAmount,
  FinanceCogs,
  FinanceEntryDraft,
  FinanceKpi,
  FinanceLink,
  FinanceMeta,
  FinanceMovement,
  FinanceMovementList,
  FinanceOverview,
  FinancePaymentList,
  FinancePayout,
  FinancePayoutList,
  FinancePayoutSummary,
  FinancePeriod,
  FinancePeriodQuery,
  FinancePnl,
  FinancePnlFigures,
  FinanceReceivableCustomer,
  FinanceReceivableList,
  FinanceReceivableSummary,
  FinanceSeriesPoint,
  FinanceTaxReport,
  FinanceTransaction,
  FinanceTransactionList,
  FinanceTransactionParams,
  FinanceTransferDraft,
  FinanceUnpaidSale,
  FinanceValuation,
  FinanceValuationGroup,
  FinanceCloseStatus,
  FinanceCountAmount,
  FinanceCustomerReceivable,
  FinanceCustomerReceivables,
  FinanceHealth,
  FinanceHealthCheck,
  FinanceInventoryReconciliation,
  FinanceMonthClose,
  FinanceOpeningStockPreview,
  FinanceOpeningStockResult,
  FinanceOpeningStockRow,
  FinanceOverviewV2,
  FinancePartyType,
  FinancePayableDocument,
  FinancePayableParty,
  FinancePayablesSummary,
  FinancePaymentsSummary,
  FinanceProductWithoutCost,
  FinanceProfitCoverage,
  FinanceRefundsMetric,
  FinanceSupplierBalance,
  FinanceSupplierBalances,
  FinanceTaxV2,
} from "@/types/finance";

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? fallback : n;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** Contract envelope: `{ success, message, data, meta? }`. */
function dataOf(body: any): any {
  return body && typeof body === "object" && "data" in body ? body.data : body;
}

type Meta = { total: number; page: number; totalPages: number };

function metaOf(body: any, fallbackCount: number, page = 1): Meta {
  const m = body?.meta ?? {};
  const total = num(m.total, fallbackCount);
  const perPage = Math.max(1, num(m.perPage ?? m.per_page, 25));
  return {
    total,
    page: num(m.currentPage ?? m.current_page, page),
    totalPages: Math.max(1, num(m.lastPage ?? m.last_page, Math.ceil(total / perPage))),
  };
}

/** Period chips/inputs → query params (`preset` or explicit dates). */
export function periodParams(p?: FinancePeriodQuery) {
  if (!p) return {};
  const channel = p.channel || undefined;
  if (p.preset && p.preset !== "custom") return { preset: p.preset, channel };
  return { from: p.from || undefined, to: p.to || undefined, channel };
}

function normalizePeriod(raw: any): FinancePeriod | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    preset: String(raw.preset ?? "custom"),
    label: String(raw.label ?? ""),
    from: str(raw.from),
    to: str(raw.to),
    previousFrom: str(raw.previousFrom),
    previousTo: str(raw.previousTo),
  };
}

/** v2 `data.context` (period, currency, channel, tz, currentState). */
export function normalizeMeta(d: any): FinanceMeta {
  const ctx = d?.context && typeof d.context === "object" ? d.context : {};
  const c = ctx.currency ?? d?.currency;
  return {
    currency:
      c && typeof c === "object"
        ? { code: String(c.code ?? ""), symbol: str(c.symbol) }
        : typeof c === "string" && c
          ? { code: c, symbol: null }
          : null,
    channel: str(ctx.channel),
    channelLabel: str(ctx.channelLabel),
    tz: str(ctx.tz),
    asOf: str(ctx.asOf),
    currentState: bool(ctx.currentState),
    channelScope: str(d?.channelScope ?? ctx.channelScope),
  };
}

function normalizeLink(raw: any): FinanceLink | null {
  if (!raw || typeof raw !== "object") return null;
  return { type: String(raw.type ?? ""), id: numOrNull(raw.id), href: str(raw.href) };
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function normalizeAccount(raw: any): FinanceAccount {
  return {
    id: num(raw?.id),
    name: String(raw?.name ?? "Account"),
    type: (raw?.type ?? "other") as FinanceAccount["type"],
    typeLabel: String(raw?.typeLabel ?? raw?.type ?? ""),
    methodKeys: arr(raw?.methodKeys).map(String),
    methodLabels: arr(raw?.methodLabels).map(String),
    receivesUnmapped: bool(raw?.receivesUnmapped),
    openingBalance: num(raw?.openingBalance),
    isDefault: bool(raw?.isDefault),
    isActive: raw?.isActive === undefined ? true : bool(raw.isActive),
    note: str(raw?.note),
    moneyIn: num(raw?.moneyIn),
    moneyOut: num(raw?.moneyOut),
    balance: num(raw?.balance),
    transactionCount: num(raw?.transactionCount),
    lastActivityDate: str(raw?.lastActivityDate),
  };
}

export async function getFinanceAccounts(params?: { asOf?: string; includeInactive?: boolean }): Promise<FinanceAccountsResult> {
  const response = await api.get("/finance/accounts", {
    params: {
      asOf: params?.asOf,
      includeInactive: params?.includeInactive === undefined ? undefined : String(params.includeInactive),
    },
  });
  const d = dataOf(response.data) ?? {};
  const t = d.totals ?? {};
  return {
    accounts: arr(d.accounts ?? d).map(normalizeAccount),
    totals: {
      balance: num(t.balance),
      moneyIn: num(t.moneyIn),
      moneyOut: num(t.moneyOut),
      activeCount: num(t.activeCount),
    },
    asOf: str(d.asOf),
    methodOptions: arr(d.methodOptions).map((m: any) => ({
      key: String(m.key),
      label: String(m.label ?? m.key),
      accountId: numOrNull(m.accountId),
    })),
    unmappedMethods: arr(d.unmappedMethods).map((m: any) => ({
      key: String(m.key),
      label: String(m.label ?? m.key),
      amount: num(m.amount),
      count: num(m.count),
    })),
    defaultAccountId: numOrNull(d.defaultAccountId),
  };
}

export async function createFinanceAccount(draft: FinanceAccountDraft): Promise<FinanceAccount> {
  const response = await api.post("/finance/accounts", draft);
  return normalizeAccount(dataOf(response.data));
}

export async function updateFinanceAccount(id: number, draft: FinanceAccountDraft): Promise<FinanceAccount> {
  const response = await api.put(`/finance/accounts/${id}`, draft);
  return normalizeAccount(dataOf(response.data));
}

export async function setDefaultFinanceAccount(id: number): Promise<FinanceAccount> {
  const response = await api.post(`/finance/accounts/${id}/default`);
  return normalizeAccount(dataOf(response.data));
}

export async function deleteFinanceAccount(id: number): Promise<void> {
  await api.delete(`/finance/accounts/${id}`);
}

// ---------------------------------------------------------------------------
// Transactions (ledger), entries, transfers
// ---------------------------------------------------------------------------

export function normalizeTransaction(raw: any): FinanceTransaction {
  const amount = Math.abs(num(raw?.amount));
  const direction = raw?.direction === "out" ? "out" : "in";
  return {
    id: String(raw?.id ?? ""),
    sourceType: String(raw?.sourceType ?? "manual"),
    sourceLabel: String(raw?.sourceLabel ?? raw?.sourceType ?? ""),
    date: String(raw?.date ?? ""),
    createdAt: str(raw?.createdAt),
    direction,
    amount,
    signedAmount: num(raw?.signedAmount, direction === "out" ? -amount : amount),
    accountId: numOrNull(raw?.accountId),
    accountName: str(raw?.accountName),
    method: str(raw?.method),
    methodKey: str(raw?.methodKey),
    methodLabel: str(raw?.methodLabel ?? raw?.method),
    party: str(raw?.party),
    partyId: numOrNull(raw?.partyId),
    reference: str(raw?.reference),
    category: str(raw?.category),
    note: str(raw?.note),
    link: normalizeLink(raw?.link),
    editable: bool(raw?.editable),
    entryId: numOrNull(raw?.entryId),
    transferId: numOrNull(raw?.transferId),
    runningBalance: numOrNull(raw?.runningBalance),
    ...feeFields(raw, direction === "out" ? -amount : amount),
  };
}

/** Gross is signed (money out / refunds negative); fee is ≥ 0 and reduces net. */
function feeFields(raw: any, signedFallback: number) {
  const gross = num(raw?.gross ?? raw?.signedAmount, signedFallback);
  const fee = Math.abs(num(raw?.fee));
  return {
    gross,
    fee,
    net: num(raw?.net, gross - fee),
    channel: str(raw?.channel),
  };
}

export async function getFinanceTransactions(params: FinanceTransactionParams): Promise<FinanceTransactionList> {
  const response = await api.get("/finance/transactions", {
    params: {
      ...periodParams(params),
      accountId: params.accountId,
      direction: params.direction,
      sourceType: params.sourceType,
      method: params.method,
      search: params.search || undefined,
      sort: params.sort,
      page: params.page,
      perPage: params.perPage,
    },
  });
  const d = dataOf(response.data) ?? {};
  const rows = arr(d.rows).map(normalizeTransaction);
  const t = d.totals ?? {};
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    totals: {
      moneyIn: num(t.moneyIn),
      moneyOut: num(t.moneyOut),
      net: num(t.net),
      count: num(t.count, rows.length),
      gross: numOrNull(t.gross),
      fees: numOrNull(t.fees),
      netAfterFees: numOrNull(t.netAfterFees),
    },
    account: d.account ? normalizeAccount(d.account) : null,
    openingBalance: numOrNull(d.openingBalance),
    closingBalance: numOrNull(d.closingBalance),
    period: normalizePeriod(d.period),
    meta: normalizeMeta(d),
  };
}

export async function getFinanceEntry(id: number) {
  const response = await api.get(`/finance/entries/${id}`);
  return dataOf(response.data);
}

export async function createFinanceEntry(draft: FinanceEntryDraft) {
  const response = await api.post("/finance/entries", draft);
  return dataOf(response.data);
}

export async function updateFinanceEntry(id: number, draft: Partial<FinanceEntryDraft>) {
  const response = await api.put(`/finance/entries/${id}`, draft);
  return dataOf(response.data);
}

export async function deleteFinanceEntry(id: number) {
  await api.delete(`/finance/entries/${id}`);
}

export async function getFinanceTransfer(id: number) {
  const response = await api.get(`/finance/transfers/${id}`);
  return dataOf(response.data);
}

export async function createFinanceTransfer(draft: FinanceTransferDraft) {
  const response = await api.post("/finance/transfers", draft);
  return dataOf(response.data);
}

export async function updateFinanceTransfer(id: number, draft: Partial<FinanceTransferDraft>) {
  const response = await api.put(`/finance/transfers/${id}`, draft);
  return dataOf(response.data);
}

export async function deleteFinanceTransfer(id: number) {
  await api.delete(`/finance/transfers/${id}`);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function normalizeKpi(raw: any): FinanceKpi {
  if (raw && typeof raw === "object") {
    return { value: num(raw.value), previous: numOrNull(raw.previous), changePct: numOrNull(raw.changePct) };
  }
  return { value: num(raw), previous: null, changePct: null };
}

function normalizeSeries(raw: any): FinanceSeriesPoint {
  const moneyIn = num(raw?.moneyIn);
  const moneyOut = num(raw?.moneyOut);
  return {
    key: String(raw?.key ?? raw?.label ?? ""),
    label: String(raw?.label ?? raw?.key ?? ""),
    moneyIn,
    moneyOut,
    net: num(raw?.net, moneyIn - moneyOut),
  };
}

function normalizeCategory(raw: any): FinanceCategoryAmount {
  return {
    categoryId: numOrNull(raw?.categoryId),
    name: String(raw?.name ?? "Uncategorised"),
    color: str(raw?.color),
    amount: num(raw?.amount),
    pct: numOrNull(raw?.pct),
  };
}

function normalizeAlert(raw: any): FinanceAlert {
  const sev = raw?.severity;
  return {
    type: String(raw?.type ?? "info"),
    severity: sev === "danger" || sev === "warning" ? sev : "info",
    title: String(raw?.title ?? ""),
    message: String(raw?.message ?? ""),
    amount: numOrNull(raw?.amount),
    count: numOrNull(raw?.count),
    href: str(raw?.href),
  };
}

export async function getFinanceOverview(period: FinancePeriodQuery): Promise<FinanceOverview> {
  const response = await api.get("/finance/overview", { params: periodParams(period) });
  return normalizeOverviewBody(response.data);
}

function normalizeOverviewBody(body: any): FinanceOverview {
  const d = dataOf(body) ?? {};
  const k = d.kpis ?? {};
  const r = d.receivables ?? {};
  const p = d.payables ?? {};
  const charts = d.charts ?? {};
  return {
    period: normalizePeriod(d.period),
    kpis: {
      revenue: normalizeKpi(k.revenue),
      moneyIn: normalizeKpi(k.moneyIn),
      moneyOut: normalizeKpi(k.moneyOut),
      netCashFlow: normalizeKpi(k.netCashFlow),
      cogs: normalizeKpi(k.cogs),
      grossProfit: normalizeKpi(k.grossProfit),
      expenses: normalizeKpi(k.expenses),
      netProfit: normalizeKpi(k.netProfit),
      cashOnHand: normalizeKpi(k.cashOnHand),
      receivables: normalizeKpi(k.receivables),
      payables: normalizeKpi(k.payables),
    },
    receivables: {
      customerDues: num(r.customerDues),
      codWithCouriers: num(r.codWithCouriers),
      tailorBalances: num(r.tailorBalances),
      total: num(r.total),
    },
    payables: {
      supplierDues: num(p.supplierDues),
      unpaidSalaries: num(p.unpaidSalaries),
      dorjiOwed: num(p.dorjiOwed),
      total: num(p.total),
    },
    cashFlow: {
      granularity: String(charts.cashFlow?.granularity ?? "day"),
      points: arr(charts.cashFlow?.points).map(normalizeSeries),
    },
    expensesByCategory: arr(charts.expensesByCategory).map(normalizeCategory),
    accountBalances: arr(charts.accountBalances).map((a: any) => ({
      accountId: num(a.accountId ?? a.id),
      name: String(a.name ?? ""),
      type: String(a.type ?? "other"),
      balance: num(a.balance),
    })),
    recentTransactions: arr(d.recentTransactions).map(normalizeTransaction),
    alerts: arr(d.alerts).map(normalizeAlert),
  };
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

function normalizePayout(raw: any): FinancePayout {
  return {
    id: String(raw?.id ?? ""),
    type: String(raw?.type ?? ""),
    typeLabel: String(raw?.typeLabel ?? raw?.type ?? ""),
    date: String(raw?.date ?? ""),
    payee: str(raw?.payee),
    payeeId: numOrNull(raw?.payeeId),
    amount: Math.abs(num(raw?.amount)),
    accountName: str(raw?.accountName),
    methodLabel: str(raw?.methodLabel ?? raw?.method),
    reference: str(raw?.reference),
    note: str(raw?.note),
  };
}

export async function getFinancePayouts(
  params: FinancePeriodQuery & { type?: string; accountId?: number; method?: string; search?: string; page?: number; perPage?: number },
): Promise<FinancePayoutList> {
  const { preset, from, to, ...rest } = params;
  const response = await api.get("/finance/payouts", {
    params: { ...periodParams({ preset, from, to }), ...rest, search: rest.search || undefined },
  });
  const d = dataOf(response.data) ?? {};
  const rows = arr(d.rows).map(normalizePayout);
  const t = d.totals ?? {};
  const byType: Record<string, number> = {};
  Object.entries((t.byType ?? {}) as Record<string, unknown>).forEach(([k, v]) => {
    byType[k] = num(v);
  });
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    totals: { total: num(t.total), count: num(t.count, rows.length), byType },
    meta: normalizeMeta(d),
  };
}

export async function getFinancePayoutSummary(): Promise<FinancePayoutSummary> {
  const response = await api.get("/finance/payouts/summary");
  const d = dataOf(response.data) ?? {};
  const s = d.supplierDues ?? {};
  const u = d.unpaidSalaries ?? {};
  const o = d.dorjiOwed ?? {};
  return {
    total: num(d.total),
    supplierDues: {
      total: num(s.total),
      partyCount: num(s.partyCount),
      overdueAmount: num(s.overdueAmount),
      dueNext7Amount: num(s.dueNext7Amount),
      rows: arr(s.rows).map((r: any) => ({
        vendorId: num(r.vendorId),
        name: String(r.name ?? "Supplier"),
        phone: str(r.phone),
        due: num(r.due),
        docs: num(r.docs),
        oldestDate: str(r.oldestDate),
        dueDate: str(r.dueDate),
        overdue: bool(r.overdue),
      })),
    },
    unpaidSalaries: {
      total: num(u.total),
      count: num(u.count),
      rows: arr(u.rows).map((r: any) => ({
        salaryPaymentId: num(r.salaryPaymentId),
        staffId: num(r.staffId),
        name: String(r.name ?? "Staff"),
        month: str(r.month),
        monthLabel: str(r.monthLabel ?? r.month),
        net: num(r.net),
        method: str(r.method),
      })),
    },
    dorjiOwed: {
      total: num(o.total),
      count: num(o.count),
      rows: arr(o.rows).map((r: any) => ({
        dorjiId: num(r.dorjiId),
        name: String(r.name ?? "Dorji"),
        phone: str(r.phone),
        owed: num(r.owed),
      })),
    },
  };
}

/** Existing dues endpoint (permission Dues.write). */
export async function paySupplierDue(
  vendorId: number,
  data: { amount: number; method: string; date: string; reference?: string; notes?: string },
) {
  const response = await api.post(`/dues/vendors/${vendorId}/pay`, data);
  return dataOf(response.data);
}

/** Existing salary endpoint (permission Salary Management.edit). */
export async function paySalary(salaryPaymentId: number, data: { method?: string; date?: string }) {
  const response = await api.post(`/salary-payments/${salaryPaymentId}/pay`, data);
  return dataOf(response.data);
}

/** Existing tailor ledger endpoint (permission TailorPayments.write). */
export async function payDorji(
  dorjiId: number,
  data: { amount: number; method: string; date: string; reference?: string; notes?: string; expectedBalance?: number },
) {
  const response = await api.post("/tailor/payments/record", {
    kind: "dorji",
    dorji_id: dorjiId,
    amount: data.amount,
    payment_method: data.method,
    payment_date: data.date,
    reference: data.reference || undefined,
    notes: data.notes || undefined,
    expected_balance: data.expectedBalance,
  });
  return dataOf(response.data);
}

// ---------------------------------------------------------------------------
// Receivables
// ---------------------------------------------------------------------------

function normalizeAging(raw: unknown): FinanceAgingBucket[] {
  return arr(raw).map((b: any) => ({
    key: num(b.key),
    label: String(b.label ?? b.key),
    amount: num(b.amount),
    count: num(b.count),
  }));
}

function normalizeReceivable(raw: any): FinanceReceivableCustomer {
  return {
    partyId: num(raw?.partyId),
    name: String(raw?.name ?? (raw?.walkIn ? "Walk-in customers" : "Customer")),
    phone: str(raw?.phone),
    walkIn: bool(raw?.walkIn),
    docs: num(raw?.docs),
    due: num(raw?.due),
    oldestDate: str(raw?.oldestDate),
    ageDays: numOrNull(raw?.ageDays),
    oldestDocNo: str(raw?.oldestDocNo),
    paidSoFar: num(raw?.paidSoFar),
    hasPartial: bool(raw?.hasPartial),
  };
}

export async function getFinanceReceivables(params: {
  search?: string;
  bucket?: number | "all";
  payment?: "all" | "partial" | "unpaid";
  sort?: "age" | "amount" | "name";
  page?: number;
  perPage?: number;
}): Promise<FinanceReceivableList> {
  const response = await api.get("/finance/receivables", {
    params: { ...params, search: params.search || undefined },
  });
  const d = dataOf(response.data) ?? {};
  const rows = arr(d.rows).map(normalizeReceivable);
  const s = d.stats;
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    aging: normalizeAging(d.aging),
    stats: s
      ? {
          totalDue: num(s.totalDue),
          partyCount: num(s.partyCount),
          overdue30Amount: num(s.overdue30Amount),
          collectedThisMonth: num(s.collectedThisMonth),
          openInvoices: num(s.openInvoices),
        }
      : null,
  };
}

export async function getFinanceReceivableSummary(): Promise<FinanceReceivableSummary> {
  const response = await api.get("/finance/receivables/summary");
  const d = dataOf(response.data) ?? {};
  const c = d.customerDues ?? {};
  const cod = d.codWithCouriers ?? {};
  const t = d.tailorBalances ?? {};
  return {
    total: num(d.total),
    customerDues: {
      total: num(c.total),
      excludingCod: num(c.excludingCod),
      partyCount: num(c.partyCount),
      aging: normalizeAging(c.aging),
    },
    codWithCouriers: {
      total: num(cod.total),
      count: num(cod.count),
      byCourier: arr(cod.byCourier).map((b: any) => ({ carrier: String(b.carrier ?? "Courier"), amount: num(b.amount), count: num(b.count) })),
      rows: arr(cod.rows).map((r: any) => ({
        shipmentId: num(r.shipmentId),
        sellId: numOrNull(r.sellId),
        invoiceNo: str(r.invoiceNo),
        customerName: str(r.customerName),
        carrier: str(r.carrier),
        trackingNumber: str(r.trackingNumber),
        status: str(r.status),
        codState: str(r.codState),
        amount: num(r.amount),
        ageDays: numOrNull(r.ageDays),
      })),
    },
    tailorBalances: {
      total: num(t.total),
      count: num(t.count),
      rows: arr(t.rows).map((r: any) => ({
        orderId: num(r.orderId),
        orderNumber: str(r.orderNumber),
        customerName: str(r.customerName),
        orderDate: str(r.orderDate),
        deliveryDate: str(r.deliveryDate),
        status: str(r.status),
        total: num(r.total),
        paid: num(r.paid),
        due: num(r.due),
      })),
    },
    suppliers: d.suppliers
      ? { owed: num(d.suppliers.owed), credits: num(d.suppliers.credits), theyOweYou: num(d.suppliers.theyOweYou), net: num(d.suppliers.net) }
      : null,
  };
}

/** Existing dues endpoint (permission Dues.write). */
export async function collectCustomerDue(
  partyId: number,
  data: { amount: number; method: string; date: string; reference?: string; notes?: string },
) {
  const response = await api.post(`/dues/customers/${partyId}/collect`, data);
  return dataOf(response.data);
}

/** Existing shipments endpoint (permission Shipments.write). */
export async function recordCodCollection(shipmentId: number, data?: { paymentMethod?: string; notes?: string }) {
  const response = await api.post(`/shipments/${shipmentId}/cod-payment`, data ?? {});
  return dataOf(response.data);
}

/** Existing tailor ledger endpoint (permission TailorPayments.write). */
export async function collectTailorBalance(
  orderId: number,
  data: { amount: number; method: string; date: string; notes?: string },
) {
  const response = await api.post("/tailor/payments/record", {
    kind: "customer",
    order_id: orderId,
    amount: data.amount,
    payment_method: data.method,
    payment_date: data.date,
    notes: data.notes || undefined,
  });
  return dataOf(response.data);
}

// ---------------------------------------------------------------------------
// Payments (money received)
// ---------------------------------------------------------------------------

export async function getFinancePayments(
  params: FinancePeriodQuery & { type?: string; accountId?: number; method?: string; search?: string; page?: number; perPage?: number },
): Promise<FinancePaymentList> {
  const { preset, from, to, ...rest } = params;
  const response = await api.get("/finance/payments", {
    params: { ...periodParams({ preset, from, to }), ...rest, search: rest.search || undefined },
  });
  const d = dataOf(response.data) ?? {};
  const rows = arr(d.rows).map(normalizeTransaction);
  const t = d.totals ?? {};
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    totals: {
      received: num(t.received),
      refunded: num(t.refunded),
      net: num(t.net),
      count: num(t.count, rows.length),
      fees: numOrNull(t.fees),
      netAfterFees: numOrNull(t.netAfterFees),
    },
    meta: normalizeMeta(d),
  };
}

export async function getUnpaidSales(params: { search?: string; limit?: number }): Promise<FinanceUnpaidSale[]> {
  const response = await api.get("/finance/payments/unpaid-sales", {
    params: { search: params.search || undefined, limit: params.limit ?? 20 },
  });
  return arr(dataOf(response.data)).map((r: any) => ({
    sellId: num(r.sellId),
    invoiceNo: String(r.invoiceNo ?? `#${r.sellId}`),
    customerName: str(r.customerName),
    customerPhone: str(r.customerPhone),
    orderDate: str(r.orderDate),
    total: num(r.total),
    paid: num(r.paid),
    due: num(r.due),
    method: str(r.method),
    status: str(r.status),
  }));
}

/** Existing record-payment endpoint (permission Dues.write). */
export async function recordSalePayment(
  sellId: number,
  data: { amount: number; method: string; date: string; reference?: string; notes?: string },
) {
  const response = await api.post(`/payments/sells/${sellId}`, {
    amount: data.amount,
    payment_method: data.method,
    payment_date: data.date,
    reference: data.reference || undefined,
    notes: data.notes || undefined,
  });
  return dataOf(response.data);
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

function normalizeValuationGroup(raw: any, idKey: string): FinanceValuationGroup {
  return {
    id: numOrNull(raw?.[idKey]),
    name: String(raw?.name ?? (idKey === "locationId" ? "No location" : "Uncategorised")),
    units: num(raw?.units),
    costValue: num(raw?.costValue),
    retailValue: num(raw?.retailValue),
    potentialProfit: num(raw?.potentialProfit, num(raw?.retailValue) - num(raw?.costValue)),
  };
}

export async function getInventoryValuation(params?: { locationId?: number; categoryId?: number }): Promise<FinanceValuation> {
  const response = await api.get("/finance/inventory/valuation", { params: { ...params, perPage: 1 } });
  const d = dataOf(response.data) ?? {};
  const t = d.totals ?? {};
  return {
    totals: {
      productCount: num(t.productCount),
      units: num(t.units),
      costValue: num(t.costValue),
      retailValue: num(t.retailValue),
      potentialProfit: num(t.potentialProfit),
      marginPct: numOrNull(t.marginPct),
    },
    byLocation: arr(d.byLocation).map((r) => normalizeValuationGroup(r, "locationId")),
    byCategory: arr(d.byCategory).map((r) => normalizeValuationGroup(r, "categoryId")),
  };
}

function normalizeMovement(raw: any): FinanceMovement {
  const ref = raw?.reference;
  return {
    id: num(raw?.id),
    date: String(raw?.date ?? ""),
    productId: numOrNull(raw?.productId),
    productName: String(raw?.productName ?? "Product"),
    sku: str(raw?.sku),
    variantName: str(raw?.variantName),
    locationId: numOrNull(raw?.locationId),
    locationName: str(raw?.locationName),
    type: String(raw?.type ?? ""),
    typeLabel: String(raw?.typeLabel ?? raw?.type ?? ""),
    quantity: num(raw?.quantity),
    qtyIn: num(raw?.qtyIn),
    qtyOut: num(raw?.qtyOut),
    unitCost: num(raw?.unitCost),
    value: num(raw?.value),
    referenceLabel: ref && typeof ref === "object" ? str(ref.label) : str(ref),
    reason: str(raw?.reason),
    runningQty: numOrNull(raw?.runningQty),
    isOpening: bool(raw?.isOpening),
    backfilled: bool(raw?.backfilled),
    orderHref: str(raw?.orderHref),
  };
}

export async function getInventoryLedger(
  params: FinancePeriodQuery & {
    productId?: number;
    locationId?: number;
    type?: string;
    direction?: "in" | "out";
    search?: string;
    page?: number;
    perPage?: number;
  },
): Promise<FinanceMovementList> {
  const { preset, from, to, ...rest } = params;
  const response = await api.get("/finance/inventory/ledger", {
    params: { ...periodParams({ preset, from, to }), ...rest, search: rest.search || undefined },
  });
  const d = dataOf(response.data) ?? {};
  const rows = arr(d.rows).map(normalizeMovement);
  const t = d.totals;
  const p = d.product;
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    totals: t
      ? { count: num(t.count), qtyIn: num(t.qtyIn), qtyOut: num(t.qtyOut), valueIn: num(t.valueIn), valueOut: num(t.valueOut) }
      : null,
    product: p ? { id: num(p.id), name: String(p.name ?? ""), sku: str(p.sku), currentQty: num(p.currentQty) } : null,
    meta: normalizeMeta(d),
  };
}

export async function getInventoryCogs(period: FinancePeriodQuery & { locationId?: number }): Promise<FinanceCogs> {
  const { locationId, ...p } = period;
  const response = await api.get("/finance/inventory/cogs", { params: { ...periodParams(p), locationId } });
  const d = dataOf(response.data) ?? {};
  const t = d.totals ?? {};
  return {
    totals: {
      revenue: num(t.revenue),
      cogs: num(t.cogs),
      grossProfit: num(t.grossProfit),
      marginPct: numOrNull(t.marginPct),
      units: num(t.units),
      orders: num(t.orders),
    },
    byCategory: arr(d.byCategory).map((r: any) => ({
      categoryId: numOrNull(r.categoryId),
      name: String(r.name ?? "Uncategorised"),
      units: num(r.units),
      revenue: num(r.revenue),
      cogs: num(r.cogs),
      grossProfit: num(r.grossProfit),
    })),
  };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function normalizePnlFigures(raw: any): FinancePnlFigures {
  const info = raw?.info;
  return {
    revenue: num(raw?.revenue),
    cogs: num(raw?.cogs),
    grossProfit: num(raw?.grossProfit),
    grossMarginPct: numOrNull(raw?.grossMarginPct),
    expenses: num(raw?.expenses),
    expensesByCategory: arr(raw?.expensesByCategory).map(normalizeCategory),
    otherIncome: num(raw?.otherIncome),
    otherExpenses: num(raw?.otherExpenses),
    netProfit: num(raw?.netProfit),
    netMarginPct: numOrNull(raw?.netMarginPct),
    info: info
      ? {
          orders: num(info.orders),
          tax: num(info.tax),
          shipping: num(info.shipping),
          discounts: num(info.discounts),
          refunds: num(info.refunds),
        }
      : null,
    paymentFees: num(raw?.paymentFees),
    voidedExpenses: num(raw?.voidedExpenses),
  };
}

export async function getPnlReport(period: FinancePeriodQuery & { compare?: "previous" | "none" }): Promise<FinancePnl> {
  const { compare, ...p } = period;
  const response = await api.get("/finance/reports/pnl", { params: { ...periodParams(p), compare } });
  const d = dataOf(response.data) ?? {};
  const changes: Record<string, number | null> | null =
    d.changes && typeof d.changes === "object"
      ? Object.fromEntries(Object.entries(d.changes as Record<string, unknown>).map(([k, v]) => [k, numOrNull(v)]))
      : null;
  return {
    meta: normalizeMeta(d),
    closeText: str(d.closeStatus?.text),
    period: normalizePeriod(d.period),
    current: normalizePnlFigures(d.current ?? {}),
    previous: d.previous ? normalizePnlFigures(d.previous) : null,
    changes,
  };
}

export async function getCashflowReport(period: FinancePeriodQuery): Promise<FinanceCashflow> {
  const response = await api.get("/finance/reports/cashflow", { params: periodParams(period) });
  const d = dataOf(response.data) ?? {};
  return {
    meta: normalizeMeta(d),
    period: normalizePeriod(d.period),
    openingBalance: num(d.openingBalance),
    moneyIn: num(d.moneyIn),
    moneyOut: num(d.moneyOut),
    net: num(d.net),
    closingBalance: num(d.closingBalance),
    bySource: arr(d.bySource).map((r: any) => ({
      sourceType: String(r.sourceType ?? ""),
      label: String(r.label ?? r.sourceType ?? ""),
      moneyIn: num(r.moneyIn),
      moneyOut: num(r.moneyOut),
      net: num(r.net),
      count: num(r.count),
    })),
    byAccount: arr(d.byAccount).map((r: any) => ({
      accountId: num(r.accountId),
      name: String(r.name ?? ""),
      type: String(r.type ?? "other"),
      openingBalance: num(r.openingBalance),
      moneyIn: num(r.moneyIn),
      moneyOut: num(r.moneyOut),
      transfersIn: num(r.transfersIn),
      transfersOut: num(r.transfersOut),
      closingBalance: num(r.closingBalance),
    })),
  };
}

export async function getTaxReport(period: FinancePeriodQuery): Promise<FinanceTaxReport> {
  const response = await api.get("/finance/reports/tax", { params: periodParams(period) });
  const d = dataOf(response.data) ?? {};
  return {
    meta: normalizeMeta(d),
    period: normalizePeriod(d.period),
    taxCollected: num(d.taxCollected),
    taxableSales: num(d.taxableSales),
    salesTotal: num(d.salesTotal),
    orders: num(d.orders),
    taxedOrders: num(d.taxedOrders),
    effectiveRatePct: numOrNull(d.effectiveRatePct),
    byRate: arr(d.byRate).map((r: any) => ({
      rate: num(r.rate),
      orders: num(r.orders),
      taxableAmount: num(r.taxableAmount),
      tax: num(r.tax),
    })),
    v2: normalizeTaxV2(d),
  };
}

export async function getAgingReport(): Promise<FinanceAgingReport> {
  const response = await api.get("/finance/reports/aging");
  const d = dataOf(response.data) ?? {};
  const r = d.receivables ?? {};
  const p = d.payables ?? {};
  return {
    asOf: str(d.asOf),
    receivables: {
      total: num(r.total),
      buckets: normalizeAging(r.buckets),
      codWithCouriers: num(r.codWithCouriers),
      tailorBalances: num(r.tailorBalances),
    },
    payables: {
      total: num(p.total),
      buckets: normalizeAging(p.buckets),
      unpaidSalaries: num(p.unpaidSalaries),
      dorjiOwed: num(p.dorjiOwed),
    },
  };
}

// ---------------------------------------------------------------------------
// Finance v2 (FINANCE_API_CONTRACT.md "v2 additions")
// ---------------------------------------------------------------------------

function normalizeCoverage(raw: any): FinanceProfitCoverage | null {
  if (!raw || typeof raw !== "object") return null;
  const costed = num(raw.costed);
  const uncosted = num(raw.uncosted);
  const excluded = num(raw.excluded);
  const productSales = num(raw.productSales ?? raw.total, costed + uncosted + excluded);
  return {
    productSales,
    costed,
    uncosted,
    excluded,
    costedPct: numOrNull(raw.costedPct) ?? (productSales ? (costed / productSales) * 100 : null),
    productsWithoutCost: num(raw.productsWithoutCost),
  };
}

function normalizeRefunds(raw: any): FinanceRefundsMetric | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    refunded: num(raw.refunded),
    refundedCount: num(raw.refundedCount),
    awaiting: num(raw.awaiting),
    awaitingCount: num(raw.awaitingCount),
    label: str(raw.label),
  };
}

/** `/finance/overview` with the v2 blocks (v1 shape kept in the base object). */
export async function getFinanceOverviewV2(period: FinancePeriodQuery): Promise<FinanceOverview & { v2: FinanceOverviewV2 }> {
  const response = await api.get("/finance/overview", { params: periodParams(period) });
  const base = normalizeOverviewBody(response.data);
  const d = dataOf(response.data) ?? {};
  const m = d.metrics ?? {};
  const sc = d.storeCredit ?? m.storeCredit;
  const fees = m.fees;
  const orders = m.orders;
  return {
    ...base,
    v2: {
      meta: normalizeMeta(d),
      coverage: normalizeCoverage(d.profitCoverage ?? m.productSales),
      storeCredit: sc && typeof sc === "object" ? { total: num(sc.total), customers: num(sc.customers) } : null,
      fees: fees && typeof fees === "object" ? { total: num(fees.total), count: num(fees.count) } : d.kpis?.paymentFees ? { total: num(d.kpis.paymentFees.value), count: 0 } : null,
      orderVolume: orders && typeof orders === "object" ? { amount: num(orders.volume), orders: num(orders.count) } : null,
      paid: m.paid ? { recorded: num(m.paid.recorded), estimated: num(m.paid.estimated), total: num(m.paid.total) } : null,
      refunds: normalizeRefunds(m.refunds),
      supplierCredits: num(d.payables?.supplierCredits),
      closeText: str(d.closeStatus?.text),
    },
  };
}

export async function getProductsWithoutCost(params: FinancePeriodQuery & { search?: string; page?: number; perPage?: number }) {
  const { preset, from, to, channel, ...rest } = params;
  const response = await api.get("/finance/products/without-cost", {
    params: { ...periodParams({ preset, from, to, channel }), ...rest, search: rest.search || undefined },
  });
  const d = dataOf(response.data) ?? {};
  const rows: FinanceProductWithoutCost[] = arr(d.rows).map((r: any) => ({
    productId: num(r.productId),
    name: String(r.name ?? "Product"),
    sku: str(r.sku),
    stock: num(r.stock),
    unitsSold: num(r.unitsSold),
    uncostedSales: num(r.uncostedSales),
    price: num(r.price),
  }));
  const t = d.totals ?? {};
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    totals: { products: num(t.products, rows.length), uncostedSales: num(t.uncostedSales) },
  };
}

// Inventory ---------------------------------------------------------------------

export async function getOpeningStockPreview(params?: { cutoverDate?: string; search?: string }): Promise<FinanceOpeningStockPreview> {
  const response = await api.get("/finance/inventory/opening-stock", {
    params: { cutoverDate: params?.cutoverDate || undefined, search: params?.search || undefined, perPage: 100 },
  });
  const d = dataOf(response.data) ?? {};
  const rows: FinanceOpeningStockRow[] = arr(d.rows).map((r: any) => {
    const unitCost = numOrNull(r.unitCost);
    const quantity = num(r.quantity);
    return {
      productId: num(r.productId),
      name: String(r.name ?? "Product"),
      sku: str(r.sku),
      quantity,
      unitCost: unitCost !== null && unitCost > 0 ? unitCost : null,
      value: num(r.value, quantity * (unitCost ?? 0)),
      needsCost: r.needsCost !== undefined ? bool(r.needsCost) : !(unitCost && unitCost > 0),
    };
  });
  const t = d.totals ?? {};
  return {
    rows,
    totals: {
      products: num(t.products, rows.length),
      ready: num(t.ready),
      needsCost: num(t.needsCost),
      quantity: num(t.quantity),
      value: num(t.value),
    },
    cutoverDate: str(d.cutoverDate),
    cutoverReason: str(d.cutoverReason),
    alreadyMovedIn: num(d.alreadyMovedIn),
    total: metaOf(response.data, rows.length).total,
  };
}

export async function postOpeningStock(payload: {
  cutoverDate: string;
  items: { productId: number; unitCost: number }[];
  productIds: number[];
  setProductCost?: boolean;
}): Promise<FinanceOpeningStockResult> {
  const response = await api.post("/finance/inventory/opening-stock", { setProductCost: true, ...payload });
  const d = dataOf(response.data) ?? {};
  return {
    posted: num(d.posted),
    quantity: num(d.quantity),
    value: num(d.value),
    skipped: arr(d.skipped).map((x: any) => ({
      productId: num(x.productId),
      name: String(x.name ?? ""),
      reason: String(x.reason ?? ""),
      label: String(x.label ?? x.reason ?? ""),
    })),
    remaining: num(d.remaining),
    message: str(response.data?.message),
  };
}

export async function getInventoryReconciliation(): Promise<FinanceInventoryReconciliation> {
  const response = await api.get("/finance/inventory/reconciliation");
  const d = dataOf(response.data) ?? {};
  const stockValue = num(d.stockValue);
  const movementValue = num(d.movementValue);
  const ms = d.missingSaleMovements ?? {};
  return {
    stockValue,
    movementValue,
    difference: num(d.difference, stockValue - movementValue),
    status: String(d.status ?? ""),
    text: str(d.text),
    lines: arr(d.lines).map((l: any, i: number) => ({
      key: `${l.kind ?? "line"}-${l.productId ?? i}-${i}`,
      kind: String(l.kind ?? ""),
      label: String(l.label ?? "Difference"),
      productId: numOrNull(l.productId),
      name: str(l.name),
      quantity: numOrNull(l.quantity),
      value: num(l.value),
      explanation: str(l.explanation),
      action: l.action && typeof l.action === "object"
        ? { type: String(l.action.type ?? ""), label: String(l.action.label ?? ""), href: str(l.action.href) }
        : null,
    })),
    byKind: arr(d.byKind).map((k: any) => ({ kind: String(k.kind ?? ""), label: String(k.label ?? k.kind ?? ""), count: num(k.count), value: num(k.value) })),
    missingSaleMovements: { lines: num(ms.lines), value: num(ms.value) },
    explained: num(d.explained),
    unexplained: num(d.unexplained),
  };
}

/** INV-2: create the `sell` movements missing for historic sale lines (idempotent). */
export async function backfillSaleMovements(dryRun = false) {
  const response = await api.post("/finance/inventory/sale-movements/backfill", { dryRun });
  const d = dataOf(response.data) ?? {};
  return { created: num(d.created), lines: num(d.lines), sales: num(d.sales), skipped: num(d.skipped), message: str(response.data?.message) };
}

// Payables per party ---------------------------------------------------------------

function normalizeParty(raw: any): FinancePayableParty {
  const type = (raw?.type === "dorji" || raw?.type === "staff" ? raw.type : "supplier") as FinancePartyType;
  const owed = num(raw?.owed);
  const notYetDue = num(raw?.notYetDue);
  const credits = num(raw?.credits);
  const payableNow = num(raw?.payableNow, owed - notYetDue - credits);
  const id = num(raw?.id);
  const nd = raw?.nextDue;
  const st = String(raw?.status ?? "");
  return {
    key: `${type}:${id}`,
    type,
    id,
    name: String(raw?.displayName ?? raw?.name ?? "—"),
    deleted: bool(raw?.deleted),
    owed,
    notYetDue,
    credits,
    payableNow,
    breakdown: arr(raw?.breakdown).map((b: any) => ({ key: String(b.key ?? ""), label: String(b.label ?? ""), amount: num(b.amount) })),
    nextDue: nd && typeof nd === "object" && nd.date ? { date: String(nd.date), amount: num(nd.amount) } : null,
    status: (st === "payable" || st === "they_owe_you" || st === "nothing_payable"
      ? st
      : payableNow > 0
        ? "payable"
        : payableNow < 0
          ? "they_owe_you"
          : "nothing_payable") as FinancePayableParty["status"],
  };
}

/** PO-1: everyone we owe, payable now high → low (zero / negative last). */
export async function getPayablesSummary(params?: { type?: string; search?: string }): Promise<FinancePayablesSummary> {
  const response = await api.get("/finance/payouts/payable", {
    params: { type: params?.type || undefined, search: params?.search || undefined },
  });
  const d = dataOf(response.data) ?? {};
  const parties = arr(d.rows).map(normalizeParty);
  parties.sort((a, b) => b.payableNow - a.payableNow || b.owed - a.owed || a.name.localeCompare(b.name));
  const t = d.totals ?? {};
  return {
    meta: normalizeMeta(d),
    totals: {
      owed: num(t.owed),
      notYetDue: num(t.notYetDue),
      credits: num(t.credits),
      payableNow: num(t.payableNow),
      theyOweYou: num(t.theyOweYou),
      parties: num(t.parties, parties.length),
    },
    parties,
  };
}

/** One payee with its open documents (supplier POs, staff payslips). */
export async function getPayableParty(type: FinancePartyType, id: number) {
  const response = await api.get(`/finance/payouts/payable/${type}/${id}`);
  const d = dataOf(response.data) ?? {};
  const row = d.row ?? d;
  return {
    party: normalizeParty(row),
    documents: arr(d.documents ?? row.documents).map((x: any): FinancePayableDocument => ({
      documentType: String(x.documentType ?? ""),
      documentId: num(x.documentId ?? x.salaryPaymentId ?? x.id),
      no: str(x.no),
      label: str(x.label ?? x.monthLabel ?? x.no),
      status: str(x.status),
      date: str(x.date ?? x.month),
      dueDate: str(x.dueDate),
      due: num(x.due ?? x.net ?? x.amount),
      notYetDue: bool(x.notYetDue),
    })),
  };
}

// Receivables -------------------------------------------------------------------

export async function getSupplierBalances(params?: { search?: string; direction?: "all" | "we_owe" | "they_owe" }): Promise<FinanceSupplierBalances> {
  const response = await api.get("/finance/receivables/suppliers", {
    params: { search: params?.search || undefined, direction: params?.direction && params.direction !== "all" ? params.direction : undefined },
  });
  const d = dataOf(response.data) ?? {};
  const rows: FinanceSupplierBalance[] = arr(d.rows).map((r: any) => {
    const owed = num(r.owed);
    const credits = num(r.credits);
    const net = num(r.net, owed - credits);
    const vendorId = num(r.vendorId);
    const deleted = bool(r.deleted);
    return {
      vendorId,
      name: String(r.displayName ?? r.name ?? (deleted ? `Deleted supplier · …${String(vendorId).slice(-4)}` : "Supplier")),
      fullId: str(r.fullId),
      deleted,
      owed,
      notYetDue: num(r.notYetDue),
      credits,
      payableNow: num(r.payableNow),
      net,
      direction: String(r.direction ?? (net < 0 ? "they_owe" : "we_owe")),
      directionLabel: str(r.directionLabel),
      action: r.action === "collect" || r.action === "pay" ? r.action : net < 0 ? "collect" : net > 0 ? "pay" : null,
      payDisabledReason: str(r.payDisabledReason),
    };
  });
  const t = d.totals ?? {};
  return {
    meta: normalizeMeta(d),
    rows,
    totals: {
      owed: num(t.owed),
      credits: num(t.credits),
      net: num(t.net),
      weOwe: num(t.weOwe),
      theyOweYou: num(t.theyOweYou),
      payableNow: num(t.payableNow),
    },
  };
}

/** RCV-2: record money a supplier paid back (their credit balance). */
export async function receiveFromSupplier(
  vendorId: number,
  data: { amount: number; method: string; date: string; reference?: string; note?: string; accountId?: number },
) {
  const response = await api.post(`/finance/receivables/suppliers/${vendorId}/receive`, data);
  return dataOf(response.data);
}

export async function getCustomerReceivables(params: {
  search?: string;
  bucket?: number | "all";
  channel?: string;
  cod?: boolean;
  sort?: "age" | "amount" | "name";
  page?: number;
  perPage?: number;
}): Promise<FinanceCustomerReceivables> {
  const response = await api.get("/finance/receivables/customers", {
    params: {
      search: params.search || undefined,
      bucket: params.bucket === undefined || params.bucket === "all" ? undefined : params.bucket,
      channel: params.channel || undefined,
      cod: params.cod === undefined ? undefined : String(params.cod),
      sort: params.sort,
      page: params.page,
      perPage: params.perPage,
    },
  });
  const d = dataOf(response.data) ?? {};
  const rows: FinanceCustomerReceivable[] = arr(d.rows).map((r: any) => ({
    sellId: num(r.sellId),
    invoiceNo: String(r.invoiceNo ?? `#${r.sellId}`),
    customerId: numOrNull(r.customerId),
    customerName: str(r.customerName),
    customerPhone: str(r.customerPhone),
    orderDate: str(r.orderDate),
    ageDays: numOrNull(r.ageDays),
    bucket: num(r.bucket),
    total: num(r.total),
    paid: num(r.paid),
    due: num(r.due),
    method: str(r.method),
    isCod: bool(r.isCod),
    codState: str(r.codState),
    channel: str(r.channel),
    status: str(r.status),
  }));
  const t = d.totals ?? {};
  return {
    data: rows,
    ...metaOf(response.data, rows.length, params.page),
    meta: normalizeMeta(d),
    aging: normalizeAging(d.aging),
    totals: { due: num(t.due), count: num(t.count), customers: num(t.customers), codDue: num(t.codDue) },
  };
}

// Payments summary ------------------------------------------------------------------

function countAmount(raw: any): FinanceCountAmount {
  return { count: num(raw?.count), amount: num(raw?.amount), label: str(raw?.label) };
}

export async function getPaymentsSummary(period: FinancePeriodQuery): Promise<FinancePaymentsSummary> {
  const response = await api.get("/finance/payments/summary", { params: periodParams(period) });
  const d = dataOf(response.data) ?? {};
  const ov = d.orderVolume ?? {};
  const pv = d.paidVolume ?? {};
  const rc = d.received ?? {};
  const nl = d.needsALook ?? {};
  const ts = d.toSuppliers ?? {};
  return {
    meta: normalizeMeta(d),
    orderVolume: { amount: num(ov.amount), count: num(ov.count) },
    paidVolume: {
      recorded: num(pv.recorded),
      estimated: num(pv.estimated),
      total: num(pv.total, num(pv.recorded) + num(pv.estimated)),
      estimatedCount: num(pv.estimatedCount),
      estimatedNote: str(pv.estimatedNote),
    },
    received: { amount: num(rc.amount), count: num(rc.count), fees: num(rc.fees), net: num(rc.net, num(rc.amount) - num(rc.fees)) },
    refunds: normalizeRefunds(d.refunds) ?? { refunded: 0, refundedCount: 0, awaiting: 0, awaitingCount: 0, label: null },
    needsALook: {
      label: str(nl.label),
      onlineUnconfirmed: countAmount(nl.onlineUnconfirmed),
      codAwaitingCollection: countAmount(nl.codAwaitingCollection),
      refundsAwaiting: countAmount(nl.refundsAwaiting),
    },
    toSuppliers: {
      owed: num(ts.owed),
      payableNow: num(ts.payableNow),
      notYetDue: num(ts.notYetDue),
      credits: num(ts.credits),
      paidInPeriod: num(ts.paidInPeriod),
    },
  };
}

// Reports ---------------------------------------------------------------------------

function normalizeClose(raw: any): FinanceMonthClose {
  return {
    month: String(raw?.month ?? ""),
    label: String(raw?.label ?? raw?.month ?? ""),
    status: String(raw?.status ?? (raw?.closedAt ? "closed" : "open")),
    canClose: bool(raw?.canClose),
    closedAt: str(raw?.closedAt),
    closedByName: str(raw?.closedByName),
    note: str(raw?.note),
    netAtClose: numOrNull(raw?.netAtClose),
    liveNet: numOrNull(raw?.liveNet),
    drift: numOrNull(raw?.drift),
    reopenedAt: str(raw?.reopenedAt),
    reopenedByName: str(raw?.reopenedByName),
    reopenReason: str(raw?.reopenReason),
  };
}

function monthRef(raw: any): { month: string; label: string; text: string | null } | null {
  if (!raw) return null;
  if (typeof raw === "string") return { month: raw, label: raw, text: null };
  if (typeof raw !== "object" || !raw.month) return null;
  return { month: String(raw.month), label: String(raw.label ?? raw.month), text: str(raw.text) };
}

export async function getCloseStatus(): Promise<FinanceCloseStatus> {
  const response = await api.get("/finance/close");
  const d = dataOf(response.data) ?? {};
  const st = d.status ?? {};
  return {
    closedThrough: str(st.closedThrough),
    closedThroughLabel: str(st.closedThroughLabel),
    text: str(st.text),
    suggestion: monthRef(st.suggestion),
    olderOpenMonth: monthRef(st.olderOpenMonth),
    months: arr(d.months).map(normalizeClose),
  };
}

export async function closeMonth(month: string, note?: string) {
  const response = await api.post("/finance/close", { month, note: note || undefined });
  return { month: normalizeClose(dataOf(response.data)), message: str(response.data?.message) };
}

export async function reopenMonth(month: string, reason: string) {
  const response = await api.post(`/finance/close/${month}/reopen`, { reason });
  return { month: normalizeClose(dataOf(response.data)), message: str(response.data?.message) };
}

export function normalizeTaxV2(d: any): FinanceTaxV2 {
  const rates = arr(d?.byRate).map((r: any, i: number) => {
    const rate = numOrNull(r.rate);
    return {
      key: `${rate ?? "x"}-${r.name ?? ""}-${i}`,
      name: String(r.label ?? r.name ?? (rate !== null ? `Tax ${rate}%` : "Tax")),
      rate,
      orders: num(r.orders),
      taxableAmount: num(r.taxableAmount),
      tax: num(r.tax),
    };
  });
  const nb = d?.notBrokenDown;
  return {
    rates,
    notBrokenDown:
      nb && typeof nb === "object"
        ? {
            label: String(nb.label ?? "Not broken down (orders before line tax was recorded)"),
            orders: num(nb.orders),
            taxableAmount: num(nb.taxableAmount),
            tax: num(nb.tax),
          }
        : null,
    reconciles: d?.reconciles === undefined ? null : bool(d.reconciles),
  };
}

export async function getHealthChecks(period: FinancePeriodQuery): Promise<FinanceHealth> {
  const response = await api.get("/finance/health", { params: periodParams(period) });
  const d = dataOf(response.data) ?? {};
  const checks: FinanceHealthCheck[] = arr(d.checks).map((c: any, i: number) => {
    const st = String(c.status ?? "info");
    return {
      id: String(c.id ?? i),
      title: String(c.title ?? c.id ?? "Check"),
      status: (st === "pass" || st === "fail" ? st : "info") as FinanceHealthCheck["status"],
      expected: numOrNull(c.expected),
      actual: numOrNull(c.actual),
      difference: numOrNull(c.difference),
      explanation: str(c.explanation),
    };
  });
  return {
    meta: normalizeMeta(d),
    passed: num(d.passed, checks.filter((c) => c.status === "pass").length),
    failed: num(d.failed, checks.filter((c) => c.status === "fail").length),
    ok: d.ok === undefined ? checks.every((c) => c.status !== "fail") : bool(d.ok),
    checks,
  };
}
