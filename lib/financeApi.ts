/**
 * Finance API Service — proxied through the Next.js route.
 * Accounts, the computed money ledger (+ manual entries / transfers), overview, inventory valuation & movement
 * ledger, payouts, receivables, payments and finance reports. Contract: FINANCE_API_CONTRACT.md.
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Server message (first readable validation error) or the fallback. */
export function financeError(e: any, fallback: string): string {
  const d = e?.response?.data;
  if (d?.message && d.message !== 'Validation failed') return d.message;
  const errs = d?.errors;
  const first = errs && typeof errs === 'object' ? (Object.values(errs).flat()[0] as string | undefined) : undefined;
  return first || d?.message || fallback;
}

const num = (v: any) => (v == null || v === '' ? 0 : Number(v) || 0);
const numOrNull = (v: any) => (v == null || v === '' ? null : Number(v));
const arr = <T = any>(v: any): T[] => (Array.isArray(v) ? v : []);

// ─── Common ──────────────────────────────────────────────────────────────────

export type AccountType = 'cash' | 'bank' | 'mobile_wallet' | 'card' | 'other';
export type Direction = 'in' | 'out';
export type EntryKind = 'income' | 'expense' | 'adjustment';
export type SourceType =
  | 'sale' | 'cod' | 'refund' | 'supplier_payment' | 'supplier_refund' | 'expense' | 'salary'
  | 'dorji_payout' | 'tailor_payment' | 'manual' | 'transfer' | 'expense_void';

/** Period sent to the server: a preset (server works out the dates in the company time zone) or custom dates; plus the channel filter. */
export interface PeriodParams { from?: string; to?: string; preset?: string; channel?: string }

/** `context` every finance GET response carries (v2.0): what the figures cover. */
export interface FinanceContext {
  period: PeriodInfo | null;
  currency: { code: string; symbol: string } | null;
  channel: string;
  channelLabel: string;
  tz: string | null;
  asOf: string | null;
  /** Point-in-time figures ("As things stand now"), not affected by the period. */
  currentState: boolean;
}

export interface PeriodInfo {
  preset: string;
  label: string;
  from: string | null;
  to: string | null;
  previousFrom: string | null;
  previousTo: string | null;
}

export interface PageMeta { total: number; perPage: number; currentPage: number; lastPage: number }

export interface Link { type: string; id: number | null; href: string }

const toPeriod = (p: any): PeriodInfo | null => (p ? {
  preset: p.preset ?? '', label: p.label ?? '', from: p.from ?? null, to: p.to ?? null,
  previousFrom: p.previousFrom ?? null, previousTo: p.previousTo ?? null,
} : null);

const toMeta = (m: any, fallbackCount: number): PageMeta => ({
  total: num(m?.total ?? fallbackCount),
  perPage: num(m?.perPage) || 25,
  currentPage: num(m?.currentPage) || 1,
  lastPage: num(m?.lastPage) || 1,
});

const toLink = (l: any): Link | null => (l && typeof l === 'object' && l.href ? { type: l.type ?? '', id: l.id ?? null, href: l.href } : null);

/** Preset (incl. `custom` with from/to) or plain dates; empty → all time. Adds `channel` when set. */
const periodQuery = (p: PeriodParams) => {
  const ch = p.channel && p.channel !== 'all' ? { channel: p.channel } : {};
  if (p.preset === 'custom') return { from: p.from || undefined, to: p.to || undefined, ...(p.from || p.to ? {} : { preset: 'all_time' }), ...ch };
  if (p.preset) return { preset: p.preset, ...ch };
  return !p.from && !p.to ? { preset: 'all_time', ...ch } : { from: p.from || undefined, to: p.to || undefined, ...ch };
};

/** Reads `data.context` (falls back to v1 `period` / `currency` fields). */
export const toContext = (d: any): FinanceContext => {
  const x = d?.context ?? {};
  const c = x.currency ?? d?.currency;
  const currency = c && typeof c === 'object' ? { code: String(c.code ?? ''), symbol: String(c.symbol ?? '') } : typeof c === 'string' ? { code: c, symbol: '' } : null;
  return {
    period: toPeriod(x.period ?? d?.period),
    currency,
    channel: x.channel ?? 'all',
    channelLabel: x.channelLabel ?? 'All channels',
    tz: x.tz ?? null,
    asOf: x.asOf ?? d?.asOf ?? null,
    currentState: !!x.currentState,
  };
};

// ─── Accounts ────────────────────────────────────────────────────────────────

export interface FinanceAccount {
  id: number;
  name: string;
  type: AccountType;
  typeLabel: string;
  methodKeys: string[];
  methodLabels: string[];
  receivesUnmapped: boolean;
  openingBalance: number;
  isDefault: boolean;
  isActive: boolean;
  note: string | null;
  moneyIn: number;
  moneyOut: number;
  balance: number;
  transactionCount: number;
  lastActivityDate: string | null;
}

export interface MethodOption { key: string; label: string; accountId: number | null }

export interface AccountsResult {
  accounts: FinanceAccount[];
  totals: { balance: number; moneyIn: number; moneyOut: number; activeCount: number };
  asOf: string | null;
  methodOptions: MethodOption[];
  unmappedMethods: { key: string; label: string; amount: number; count: number }[];
  defaultAccountId: number | null;
}

export interface AccountInput {
  name?: string;
  type?: AccountType;
  methodKeys?: string[];
  openingBalance?: number;
  isDefault?: boolean;
  isActive?: boolean;
  note?: string | null;
}

export function toAccount(a: any): FinanceAccount {
  return {
    id: Number(a.id),
    name: a.name ?? '',
    type: (a.type ?? 'other') as AccountType,
    typeLabel: a.typeLabel ?? a.type ?? '',
    methodKeys: arr<string>(a.methodKeys),
    methodLabels: arr<string>(a.methodLabels),
    receivesUnmapped: !!a.receivesUnmapped,
    openingBalance: num(a.openingBalance),
    isDefault: !!a.isDefault,
    isActive: a.isActive !== false,
    note: a.note ?? null,
    moneyIn: num(a.moneyIn),
    moneyOut: num(a.moneyOut),
    balance: num(a.balance),
    transactionCount: num(a.transactionCount),
    lastActivityDate: a.lastActivityDate ?? null,
  };
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

export interface LedgerRow {
  id: string;
  sourceType: SourceType | string;
  sourceLabel: string;
  date: string;
  createdAt: string | null;
  direction: Direction;
  amount: number;
  signedAmount: number;
  accountId: number | null;
  accountName: string | null;
  method: string | null;
  methodKey: string | null;
  methodLabel: string | null;
  party: string | null;
  reference: string | null;
  category: string | null;
  note: string | null;
  link: Link | null;
  editable: boolean;
  entryId: number | null;
  transferId: number | null;
  runningBalance: number | null;
  /** v2.8: signed (money out negative), fee (estimated, money-in customer rows only), net = gross − fee. */
  gross: number;
  fee: number;
  net: number;
  currency: string | null;
  channel: string | null;
  sellId: number | null;
}

export function toLedgerRow(r: any): LedgerRow {
  const amount = Math.abs(num(r.amount));
  const direction: Direction = r.direction === 'out' ? 'out' : 'in';
  return {
    id: String(r.id),
    sourceType: r.sourceType ?? '',
    sourceLabel: r.sourceLabel ?? r.sourceType ?? '',
    date: String(r.date ?? '').slice(0, 10),
    createdAt: r.createdAt ?? null,
    direction,
    amount,
    signedAmount: r.signedAmount != null ? num(r.signedAmount) : direction === 'in' ? amount : -amount,
    accountId: r.accountId ?? null,
    accountName: r.accountName ?? null,
    method: r.method ?? null,
    methodKey: r.methodKey ?? null,
    methodLabel: r.methodLabel ?? r.method ?? null,
    party: r.party ?? r.payee ?? null,
    reference: r.reference ?? null,
    category: r.category ?? null,
    note: r.note ?? null,
    link: toLink(r.link),
    editable: !!r.editable,
    entryId: r.entryId ?? null,
    transferId: r.transferId ?? null,
    runningBalance: numOrNull(r.runningBalance),
    ...(() => {
      const signed = r.signedAmount != null ? num(r.signedAmount) : direction === 'in' ? amount : -amount;
      const gross = r.gross != null ? num(r.gross) : signed;
      const fee = num(r.fee);
      return { gross, fee, net: r.net != null ? num(r.net) : gross - fee };
    })(),
    currency: r.currency ?? null,
    channel: r.channel ?? null,
    sellId: r.sellId ?? null,
  };
}

export interface LedgerParams extends PeriodParams {
  format?: 'csv';
  accountId?: number;
  direction?: Direction;
  sourceType?: string;
  method?: string;
  search?: string;
  sort?: 'date_desc' | 'date_asc';
  page?: number;
  perPage?: number;
}

export interface LedgerResult {
  context: FinanceContext;
  rows: LedgerRow[];
  totals: { moneyIn: number; moneyOut: number; net: number; count: number; gross: number; fees: number; netAfterFees: number };
  account: FinanceAccount | null;
  openingBalance: number | null;
  closingBalance: number | null;
  period: PeriodInfo | null;
  meta: PageMeta;
}

export interface EntryInput {
  accountId: number;
  kind: EntryKind;
  direction?: Direction;
  amount: number;
  date: string;
  category?: string;
  party?: string;
  reference?: string;
  note?: string;
}
export interface FinanceEntry extends EntryInput { id: number; direction: Direction; accountName?: string | null }

export interface TransferInput {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  date: string;
  reference?: string;
  note?: string;
}
export interface FinanceTransfer extends TransferInput { id: number }

// ─── Overview ────────────────────────────────────────────────────────────────

export interface Kpi { value: number; previous: number | null; changePct: number | null }
export type KpiKey = 'revenue' | 'moneyIn' | 'moneyOut' | 'netCashFlow' | 'cogs' | 'grossProfit' | 'expenses' | 'netProfit' | 'cashOnHand' | 'receivables' | 'payables'
  | 'orderVolume' | 'paymentFees' | 'refunds';

export interface CashPoint { key: string; label: string; moneyIn: number; moneyOut: number; net: number }

export interface FinanceAlert {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  amount: number | null;
  count: number | null;
  href: string | null;
}

export interface Overview {
  period: PeriodInfo | null;
  context: FinanceContext;
  metrics: FinanceMetrics;
  kpis: Record<KpiKey, Kpi>;
  receivables: { customerDues: number; codWithCouriers: number; tailorBalances: number; total: number };
  payables: { supplierDues: number; unpaidSalaries: number; dorjiOwed: number; total: number; supplierCredits: number };
  storeCredit: { total: number; customers: number; href: string | null };
  profitCoverage: ProfitCoverage;
  pnl: { otherIncome: number; otherExpenses: number; paymentFees: number; voidedExpenses: number };
  closeStatus: CloseStatus | null;
  cashFlow: { granularity: 'day' | 'month'; points: CashPoint[] };
  expensesByCategory: { categoryId: number | null; name: string; color: string | null; amount: number; pct: number }[];
  accountBalances: { accountId: number; name: string; type: string; balance: number }[];
  recentTransactions: LedgerRow[];
  alerts: FinanceAlert[];
}

const KPI_KEYS: KpiKey[] = ['revenue', 'moneyIn', 'moneyOut', 'netCashFlow', 'cogs', 'grossProfit', 'expenses', 'netProfit', 'cashOnHand', 'receivables', 'payables', 'orderVolume', 'paymentFees', 'refunds'];
const toPoint = (p: any): CashPoint => ({ key: String(p.key ?? p.label), label: String(p.label ?? p.key), moneyIn: num(p.moneyIn), moneyOut: num(p.moneyOut), net: num(p.net) });

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface ValuationGroup { id: number | null; name: string; units: number; costValue: number; retailValue: number; potentialProfit: number }
export interface ValuationRow {
  productId: number; name: string; sku: string | null; categoryId: number | null; categoryName: string | null;
  units: number; unitCost: number; unitPrice: number; costValue: number; retailValue: number; potentialProfit: number;
}
export interface Valuation {
  totals: { productCount: number; units: number; costValue: number; retailValue: number; potentialProfit: number; marginPct: number | null };
  byLocation: ValuationGroup[];
  byCategory: ValuationGroup[];
  rows: ValuationRow[];
  meta: PageMeta;
}
export interface ValuationParams { locationId?: number; categoryId?: number; search?: string; sort?: 'cost_desc' | 'retail_desc' | 'qty_desc' | 'name_asc'; page?: number; perPage?: number }

export type MovementType = 'receive' | 'sell' | 'return' | 'transfer' | 'adjustment' | 'damage';
export interface InventoryMovement {
  id: number;
  date: string;
  productId: number | null;
  productName: string;
  sku: string | null;
  variantId: number | null;
  variantName: string | null;
  locationId: number | null;
  locationName: string | null;
  type: string;
  typeLabel: string;
  quantity: number;
  qtyIn: number;
  qtyOut: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  unitCost: number;
  value: number;
  reference: { type: string; id: number | null; label: string; href: string | null } | null;
  reason: string | null;
  notes: string | null;
  createdBy: string | null;
  runningQty: number | null;
  orderItemId: number | null;
  backfilled: boolean;
  isOpening: boolean;
  ledgerHref: string | null;
  orderHref: string | null;
}
export interface InventoryLedgerParams extends PeriodParams {
  productId?: number; variantId?: number; locationId?: number; type?: string; search?: string; direction?: Direction; page?: number; perPage?: number;
}
export interface InventoryLedgerResult {
  context: FinanceContext;
  rows: InventoryMovement[];
  totals: { count: number; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number };
  product: { id: number; name: string; sku: string | null; currentQty: number } | null;
  meta: PageMeta;
}
export interface CogsLine { id: number | null; name: string; units: number; revenue: number; cogs: number; grossProfit: number }
export interface CogsResult {
  context: FinanceContext;
  period: PeriodInfo | null;
  totals: { revenue: number; cogs: number; grossProfit: number; marginPct: number | null; units: number; orders: number };
  byCategory: CogsLine[];
  topProducts: CogsLine[];
}

// ─── Payouts / receivables / payments ───────────────────────────────────────

export type PayoutType = 'supplier' | 'salary' | 'dorji';
export interface PayoutRow {
  id: string; type: PayoutType | string; typeLabel: string; date: string; payee: string | null; payeeId: number | null; amount: number;
  accountId: number | null; accountName: string | null; method: string | null; methodLabel: string | null; reference: string | null; note: string | null; link: Link | null;
}
export interface PayoutsResult {
  context: FinanceContext;
  rows: PayoutRow[];
  totals: { total: number; count: number; byType: Record<string, number> };
  period: PeriodInfo | null;
  meta: PageMeta;
}
export interface PayoutSummary {
  total: number;
  supplierDues: {
    total: number; partyCount: number; overdueAmount: number; dueNext7Amount: number;
    rows: { vendorId: number; name: string; phone: string | null; due: number; docs: number; oldestDate: string | null; dueDate: string | null; overdue: boolean }[];
  };
  unpaidSalaries: { total: number; count: number; rows: { salaryPaymentId: number; staffId: number | null; name: string; month: string | null; monthLabel: string | null; net: number; method: string | null }[] };
  dorjiOwed: { total: number; count: number; rows: { dorjiId: number; name: string; phone: string | null; owed: number }[] };
}

export interface AgingBucket { key: number; label: string; amount: number; count: number }
export interface CustomerDueRow {
  partyId: number; name: string; phone: string | null; walkIn: boolean; docs: number; due: number; oldestDate: string | null; ageDays: number;
  oldestDocNo: string | null; lastPaymentDate: string | null; paidSoFar: number; hasPartial: boolean; lastDocNos: string[];
}
export interface ReceivablesResult {
  rows: CustomerDueRow[];
  aging: AgingBucket[];
  stats: Record<string, number>;
  meta: PageMeta;
}
export interface ReceivablesParams { search?: string; bucket?: number | 'all'; payment?: 'all' | 'partial' | 'unpaid'; sort?: 'age' | 'amount' | 'name'; page?: number; perPage?: number }
export interface ReceivableSummary {
  total: number;
  suppliers: { owed: number; credits: number; theyOweYou: number; net: number };
  customerDues: { total: number; excludingCod: number; partyCount: number; aging: AgingBucket[] };
  codWithCouriers: {
    total: number; count: number;
    byCourier: { carrier: string; amount: number; count: number }[];
    rows: { shipmentId: number; sellId: number | null; invoiceNo: string | null; customerName: string | null; carrier: string | null; trackingNumber: string | null; status: string | null; codState: string | null; amount: number; shippedAt: string | null; deliveredAt: string | null; ageDays: number }[];
  };
  tailorBalances: {
    total: number; count: number;
    rows: { orderId: number; orderNumber: string | null; customerName: string | null; orderDate: string | null; deliveryDate: string | null; status: string | null; total: number; paid: number; due: number }[];
  };
}

export interface PaymentsParams extends PeriodParams { type?: string; accountId?: number; method?: string; search?: string; page?: number; perPage?: number }
export interface PaymentsResult {
  context: FinanceContext;
  rows: LedgerRow[];
  totals: { received: number; refunded: number; net: number; count: number; fees: number; netAfterFees: number };
  period: PeriodInfo | null;
  meta: PageMeta;
}
export interface UnpaidSale {
  sellId: number; invoiceNo: string; customerName: string | null; customerPhone: string | null; orderDate: string | null;
  total: number; paid: number; due: number; method: string | null; status: string | null;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface PnlFigures {
  revenue: number; cogs: number; grossProfit: number; grossMarginPct: number | null;
  expenses: number; expensesByCategory: { categoryId: number | null; name: string; color: string | null; amount: number }[];
  otherIncome: number; otherExpenses: number; netProfit: number; netMarginPct: number | null;
  info: { orders: number; tax: number; shipping: number; discounts: number; refunds: number };
  paymentFees: number; voidedExpenses: number; productSales: ProfitCoverage | null;
}
export interface PnlReport {
  context: FinanceContext;
  period: PeriodInfo | null;
  current: PnlFigures;
  previous: PnlFigures | null;
  changes: Record<string, number | null> | null;
  months: { key: string; label: string; revenue: number; cogs: number; grossProfit: number; expenses: number; otherIncome: number; otherExpenses: number; netProfit: number; closed: boolean; netAtClose: number | null }[];
  closeStatus: CloseStatus | null;
}
export interface CashflowReport {
  context: FinanceContext;
  period: PeriodInfo | null;
  openingBalance: number; moneyIn: number; moneyOut: number; net: number; closingBalance: number;
  bySource: { sourceType: string; label: string; moneyIn: number; moneyOut: number; net: number; count: number }[];
  byAccount: { accountId: number; name: string; type: string; openingBalance: number; moneyIn: number; moneyOut: number; transfersIn: number; transfersOut: number; closingBalance: number }[];
  series: CashPoint[];
  granularity: 'day' | 'month';
}
export interface StatementReport {
  account: FinanceAccount | null;
  period: PeriodInfo | null;
  openingBalance: number; moneyIn: number; moneyOut: number; closingBalance: number;
  rows: LedgerRow[];
  truncated: boolean;
}
export interface TaxReport {
  context: FinanceContext;
  period: PeriodInfo | null;
  taxCollected: number; taxableSales: number; salesTotal: number; orders: number; taxedOrders: number; effectiveRatePct: number | null;
  byRate: { rate: number | null; name: string | null; label: string | null; orders: number; taxableAmount: number; tax: number }[];
  notBrokenDown: { label: string; orders: number; taxableAmount: number; tax: number } | null;
  reconciles: boolean | null;
  byMonth: { key: string; label: string; orders: number; taxableAmount: number; tax: number }[];
}
export interface AgingReport {
  asOf: string | null;
  receivables: { total: number; buckets: AgingBucket[]; customers: { partyId: number; name: string; due: number; ageDays: number; bucket: number }[]; codWithCouriers: number; tailorBalances: number };
  payables: { total: number; buckets: AgingBucket[]; suppliers: { partyId: number; name: string; due: number; ageDays: number; bucket: number; overdue: boolean }[]; unpaidSalaries: number; dorjiOwed: number };
}

const toBuckets = (b: any): AgingBucket[] => arr(b).map((x: any) => ({ key: num(x.key), label: x.label ?? '', amount: num(x.amount), count: num(x.count) }));

const toPnl = (c: any): PnlFigures => ({
  revenue: num(c?.revenue), cogs: num(c?.cogs), grossProfit: num(c?.grossProfit), grossMarginPct: numOrNull(c?.grossMarginPct),
  expenses: num(c?.expenses),
  expensesByCategory: arr(c?.expensesByCategory).map((e: any) => ({ categoryId: e.categoryId ?? null, name: e.name ?? '—', color: e.color ?? null, amount: num(e.amount) })),
  otherIncome: num(c?.otherIncome), otherExpenses: num(c?.otherExpenses), netProfit: num(c?.netProfit), netMarginPct: numOrNull(c?.netMarginPct),
  info: { orders: num(c?.info?.orders), tax: num(c?.info?.tax), shipping: num(c?.info?.shipping), discounts: num(c?.info?.discounts), refunds: num(c?.info?.refunds) },
  paymentFees: num(c?.paymentFees), voidedExpenses: num(c?.voidedExpenses), productSales: c?.productSales ? toCoverage(c.productSales) : null,
});


// ─── v2: metrics, coverage, close, fees, payables, receivables, payments summary, inventory, health ─────

export interface ProfitCoverage {
  productSales: number; costed: number; uncosted: number; excluded: number; costedPct: number | null;
  productsWithoutCost: number; uncostedLines: number; setCostsHref: string | null;
}
const toCoverage = (c: any): ProfitCoverage => ({
  productSales: num(c?.productSales ?? c?.total), costed: num(c?.costed), uncosted: num(c?.uncosted), excluded: num(c?.excluded),
  costedPct: numOrNull(c?.costedPct), productsWithoutCost: num(c?.productsWithoutCost), uncostedLines: num(c?.uncostedLines),
  setCostsHref: c?.setCostsHref ?? null,
});

export interface FinanceMetrics {
  orders: { count: number; volume: number };
  paid: { recorded: number; estimated: number; total: number; unpaid: number; estimatedCount: number };
  productSales: ProfitCoverage;
  refunds: { refunded: number; refundedCount: number; awaiting: number; awaitingCount: number; label: string };
  fees: { total: number; count: number; byMethod: { methodKey: string; label: string; gross: number; fee: number; count: number }[] };
  moneyIn: number; moneyOut: number;
  tax: { collected: number };
  storeCredit: { total: number; customers: number };
}
const toRefunds = (r: any) => ({ refunded: num(r?.refunded), refundedCount: num(r?.refundedCount), awaiting: num(r?.awaiting), awaitingCount: num(r?.awaitingCount), label: r?.label ?? 'Refunds' });
const toMetrics = (m: any): FinanceMetrics => ({
  orders: { count: num(m?.orders?.count), volume: num(m?.orders?.volume) },
  paid: { recorded: num(m?.paid?.recorded), estimated: num(m?.paid?.estimated), total: num(m?.paid?.total), unpaid: num(m?.paid?.unpaid), estimatedCount: num(m?.paid?.estimatedCount) },
  productSales: toCoverage(m?.productSales),
  refunds: toRefunds(m?.refunds),
  fees: { total: num(m?.fees?.total), count: num(m?.fees?.count), byMethod: arr(m?.fees?.byMethod).map((x: any) => ({ methodKey: x.methodKey ?? '', label: x.label ?? x.methodKey ?? '', gross: num(x.gross), fee: num(x.fee), count: num(x.count) })) },
  moneyIn: num(m?.moneyIn), moneyOut: num(m?.moneyOut),
  tax: { collected: num(m?.tax?.collected) },
  storeCredit: { total: num(m?.storeCredit?.total), customers: num(m?.storeCredit?.customers) },
});

export interface ProductWithoutCost { productId: number; name: string; sku: string | null; stock: number; unitsSold: number; uncostedSales: number; price: number; editHref: string | null }

// Month close (v2.6)
export interface CloseStatus {
  closedThrough: string | null; closedThroughLabel: string | null; text: string;
  suggestion: { month: string; label: string; text: string } | null;
  olderOpenMonth: { month: string; label: string; text: string } | null;
  lastClosedMonth: string | null;
}
const toSug = (x: any) => (x && x.month ? { month: String(x.month), label: x.label ?? x.month, text: x.text ?? `Close ${x.label ?? x.month}` } : null);
const toCloseStatus = (x: any): CloseStatus => ({
  closedThrough: x?.closedThrough ?? null, closedThroughLabel: x?.closedThroughLabel ?? null,
  text: x?.text ?? (x?.closedThroughLabel ? `Everything up to ${x.closedThroughLabel} is closed.` : 'No months closed yet.'),
  suggestion: toSug(x?.suggestion), olderOpenMonth: toSug(x?.olderOpenMonth), lastClosedMonth: x?.lastClosedMonth ?? null,
});
export interface CloseMonth {
  month: string; label: string; from: string | null; to: string | null; status: 'open' | 'closed' | string; canClose: boolean;
  closedAt: string | null; closedByName: string | null; note: string | null; netAtClose: number | null; liveNet: number | null; drift: number | null;
  reopenedAt: string | null; reopenedByName: string | null; reopenReason: string | null;
}
const toCloseMonth = (m: any): CloseMonth => ({
  month: String(m?.month ?? ''), label: m?.label ?? m?.month ?? '', from: m?.from ?? null, to: m?.to ?? null, status: m?.status ?? 'open', canClose: !!m?.canClose,
  closedAt: m?.closedAt ?? null, closedByName: m?.closedByName ?? null, note: m?.note ?? null, netAtClose: numOrNull(m?.netAtClose), liveNet: numOrNull(m?.liveNet), drift: numOrNull(m?.drift),
  reopenedAt: m?.reopenedAt ?? null, reopenedByName: m?.reopenedByName ?? null, reopenReason: m?.reopenReason ?? null,
});
export interface CloseState { context: FinanceContext; status: CloseStatus; months: CloseMonth[] }

// Fees (v2.7)
export interface MethodFee { methodKey: string; label: string; percent: number; fixed: number }
export interface FeesResult { fees: MethodFee[]; appliesTo: string[] }
const toFees = (d: any): FeesResult => ({
  fees: arr(d?.fees).map((f: any) => ({ methodKey: String(f.methodKey ?? ''), label: f.label ?? f.methodKey ?? '', percent: num(f.percent), fixed: num(f.fixed) })),
  appliesTo: arr<string>(d?.appliesTo),
});

// Payables per party (v2.9)
export type PayeeType = 'supplier' | 'dorji' | 'staff';
export interface PayableRow {
  type: PayeeType | string; id: number; name: string; displayName: string; deleted: boolean;
  owed: number; notYetDue: number; credits: number; payableNow: number;
  breakdown: { key: string; label: string; amount: number }[];
  nextDue: { date: string; amount: number } | null;
  status: 'payable' | 'nothing_payable' | 'they_owe_you' | string;
  payHref: string | null;
}
const toPayable = (r: any): PayableRow => ({
  type: r?.type ?? 'supplier', id: Number(r?.id), name: r?.name ?? '', displayName: r?.displayName ?? r?.name ?? '', deleted: !!r?.deleted,
  owed: num(r?.owed), notYetDue: num(r?.notYetDue), credits: num(r?.credits), payableNow: num(r?.payableNow),
  breakdown: arr(r?.breakdown).map((b: any) => ({ key: b.key ?? '', label: b.label ?? '', amount: num(b.amount) })),
  nextDue: r?.nextDue?.date ? { date: r.nextDue.date, amount: num(r.nextDue.amount) } : null,
  status: r?.status ?? (num(r?.payableNow) > 0 ? 'payable' : 'nothing_payable'), payHref: r?.payHref ?? null,
});
export interface PayableResult {
  context: FinanceContext; rows: PayableRow[]; payable: PayableRow[]; nothingPayable: PayableRow[];
  totals: { owed: number; notYetDue: number; credits: number; payableNow: number; theyOweYou: number; parties: number };
}
export interface PayableDocument {
  documentType: string; documentId: number | null; no: string; status: string | null; date: string | null; dueDate: string | null; due: number; notYetDue: boolean;
  /** Staff payslips: the id for POST /salary-payments/{id}/pay. */
  salaryPaymentId: number | null; month: string | null; monthLabel: string | null; method: string | null;
}

// Receivables (v2.10)
export interface SupplierReceivableRow {
  vendorId: number; name: string; displayName: string; deleted: boolean; fullId: string | null;
  owed: number; notYetDue: number; credits: number; payableNow: number; net: number;
  direction: 'we_owe' | 'they_owe' | string; directionLabel: string; action: 'pay' | 'collect' | string | null;
  payDisabledReason: string | null; payHref: string | null; collectHref: string | null;
}
export interface SupplierReceivables { context: FinanceContext; rows: SupplierReceivableRow[]; totals: { owed: number; credits: number; net: number; weOwe: number; theyOweYou: number; payableNow: number } }
export interface CustomerReceivableRow {
  sellId: number; invoiceNo: string; customerId: number | null; customerName: string | null; customerPhone: string | null; orderDate: string | null;
  ageDays: number; bucket: number; total: number; paid: number; due: number; method: string | null; methodKey: string | null; isCod: boolean;
  codState: string | null; channel: string | null; status: string | null; orderHref: string | null;
}
export interface CustomerReceivables {
  context: FinanceContext; rows: CustomerReceivableRow[]; aging: AgingBucket[];
  totals: { due: number; count: number; customers: number; codDue: number }; meta: PageMeta;
}
export interface SupplierReceiptInput { amount: number; date: string; accountId?: number; method?: string; reference?: string; note?: string }

// Payments summary (v2.11)
export interface LinkedCount { count: number; amount: number; label: string; href: string | null }
export interface PaymentsSummary {
  context: FinanceContext;
  orderVolume: { amount: number; count: number };
  paidVolume: { recorded: number; estimated: number; total: number; estimatedCount: number; estimatedNote: string | null };
  received: { amount: number; count: number; fees: number; net: number };
  refunds: FinanceMetrics['refunds'];
  needsALook: { asOf: string | null; label: string; onlineUnconfirmed: LinkedCount; codAwaitingCollection: LinkedCount; refundsAwaiting: LinkedCount };
  toSuppliers: { owed: number; payableNow: number; notYetDue: number; credits: number; paidInPeriod: number; payoutsHref: string | null; receivablesHref: string | null };
}
const toLinked = (x: any, fallback: string): LinkedCount => ({ count: num(x?.count), amount: num(x?.amount), label: x?.label ?? fallback, href: x?.href ?? null });

// Inventory (v2.4)
export interface OpeningStockRow { productId: number; name: string; sku: string | null; quantity: number; unitCost: number | null; value: number; needsCost: boolean; locationId: number | null }
export interface OpeningStockPreview {
  context: FinanceContext; cutoverDate: string | null; cutoverReason: string | null; rows: OpeningStockRow[];
  totals: { products: number; ready: number; needsCost: number; quantity: number; value: number }; alreadyMovedIn: number; meta: PageMeta;
}
export interface OpeningStockInput { cutoverDate: string; items?: { productId: number; unitCost: number }[]; productIds?: number[]; setProductCost?: boolean }
export interface OpeningStockResult { posted: number; quantity: number; value: number; skipped: { productId: number; name: string; reason: string; label: string }[]; remaining: number; message: string }
export interface MissingSaleMovements { lines: number; sales: number; quantity: number; value: number; sample: { sellId: number; invoiceNo: string; orderDate: string | null; productId: number | null; productName: string; variantId: number | null; quantity: number; unitCost: number; value: number }[] }
export interface ReconciliationLine {
  kind: string; label: string; productId: number | null; name: string; quantity: number; value: number; explanation: string;
  action: { type: string; label: string; href: string | null } | null;
}
export interface Reconciliation {
  context: FinanceContext; stockValue: number; movementValue: number; difference: number; status: string; text: string;
  lines: ReconciliationLine[]; byKind: { kind: string; label: string; count: number; value: number }[];
  missingSaleMovements: { lines: number; value: number }; explained: number; unexplained: number;
}

// Expenses (v2.5)
export interface ExpenseActivity { id: number; action: 'created' | 'edited' | 'voided' | 'deleted' | string; label: string; at: string | null; byId: number | null; byName: string | null; changes: Record<string, { from: unknown; to: unknown }> | null; note: string | null }

// Health (v2.12)
export interface HealthCheck { id: string; title: string; status: 'pass' | 'fail' | 'info' | string; expected: number | null; actual: number | null; difference: number | null; numbers: Record<string, number>; explanation: string }
export interface HealthResult { context: FinanceContext; passed: number; failed: number; ok: boolean; checks: HealthCheck[] }

// ─── API ─────────────────────────────────────────────────────────────────────

export const financeApi = {
  // Overview
  getOverview: async (p: PeriodParams): Promise<Overview> => {
    const d = (await api.get('/finance/overview', { params: periodQuery(p) })).data.data ?? {};
    const k = d.kpis ?? {};
    const kpis = Object.fromEntries(KPI_KEYS.map((key) => [key, { value: num(k[key]?.value), previous: numOrNull(k[key]?.previous), changePct: numOrNull(k[key]?.changePct) }])) as Record<KpiKey, Kpi>;
    const context = toContext(d);
    return {
      period: context.period,
      context,
      metrics: toMetrics(d.metrics),
      kpis,
      receivables: { customerDues: num(d.receivables?.customerDues), codWithCouriers: num(d.receivables?.codWithCouriers), tailorBalances: num(d.receivables?.tailorBalances), total: num(d.receivables?.total) },
      payables: { supplierDues: num(d.payables?.supplierDues), unpaidSalaries: num(d.payables?.unpaidSalaries), dorjiOwed: num(d.payables?.dorjiOwed), total: num(d.payables?.total), supplierCredits: num(d.payables?.supplierCredits) },
      storeCredit: { total: num(d.storeCredit?.total ?? d.metrics?.storeCredit?.total), customers: num(d.storeCredit?.customers ?? d.metrics?.storeCredit?.customers), href: d.storeCredit?.href ?? null },
      profitCoverage: toCoverage(d.profitCoverage ?? d.metrics?.productSales),
      pnl: { otherIncome: num(d.pnl?.otherIncome), otherExpenses: num(d.pnl?.otherExpenses), paymentFees: num(d.pnl?.paymentFees), voidedExpenses: num(d.pnl?.voidedExpenses) },
      closeStatus: d.closeStatus ? toCloseStatus(d.closeStatus) : null,
      cashFlow: { granularity: d.charts?.cashFlow?.granularity === 'month' ? 'month' : 'day', points: arr(d.charts?.cashFlow?.points).map(toPoint) },
      expensesByCategory: arr(d.charts?.expensesByCategory).map((c: any) => ({ categoryId: c.categoryId ?? null, name: c.name ?? '—', color: c.color ?? null, amount: num(c.amount), pct: num(c.pct) })),
      accountBalances: arr(d.charts?.accountBalances).map((a: any) => ({ accountId: Number(a.accountId), name: a.name ?? '', type: a.type ?? '', balance: num(a.balance) })),
      recentTransactions: arr(d.recentTransactions).map(toLedgerRow),
      alerts: arr(d.alerts).map((a: any) => ({ type: a.type ?? '', severity: a.severity ?? 'warning', title: a.title ?? '', message: a.message ?? '', amount: numOrNull(a.amount), count: numOrNull(a.count), href: a.href ?? null })),
    };
  },

  // Accounts
  getAccounts: async (params?: { asOf?: string; includeInactive?: boolean }): Promise<AccountsResult> => {
    const d = (await api.get('/finance/accounts', { params })).data.data ?? {};
    return {
      accounts: arr(d.accounts).map(toAccount),
      totals: { balance: num(d.totals?.balance), moneyIn: num(d.totals?.moneyIn), moneyOut: num(d.totals?.moneyOut), activeCount: num(d.totals?.activeCount) },
      asOf: d.asOf ?? null,
      methodOptions: arr(d.methodOptions).map((m: any) => ({ key: m.key, label: m.label ?? m.key, accountId: m.accountId ?? null })),
      unmappedMethods: arr(d.unmappedMethods).map((m: any) => ({ key: m.key, label: m.label ?? m.key, amount: num(m.amount), count: num(m.count) })),
      defaultAccountId: d.defaultAccountId ?? null,
    };
  },
  createAccount: async (body: AccountInput): Promise<FinanceAccount> => toAccount((await api.post('/finance/accounts', body)).data.data),
  updateAccount: async (id: number, body: AccountInput): Promise<FinanceAccount> => toAccount((await api.put(`/finance/accounts/${id}`, body)).data.data),
  setDefaultAccount: async (id: number): Promise<FinanceAccount> => toAccount((await api.post(`/finance/accounts/${id}/default`)).data.data),
  deleteAccount: async (id: number) => (await api.delete(`/finance/accounts/${id}`)).data,

  // Ledger
  getTransactions: async (p: LedgerParams): Promise<LedgerResult> => {
    const { from, to, preset, ...rest } = p;
    const res = (await api.get('/finance/transactions', { params: { ...periodQuery({ from, to, preset }), ...rest } })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map(toLedgerRow);
    const t = d.totals ?? {};
    return {
      context: toContext(d),
      rows,
      totals: {
        moneyIn: num(t.moneyIn), moneyOut: num(t.moneyOut), net: num(t.net), count: num(t.count),
        gross: t.gross != null ? num(t.gross) : num(t.moneyIn) - num(t.moneyOut), fees: num(t.fees),
        netAfterFees: t.netAfterFees != null ? num(t.netAfterFees) : num(t.moneyIn) - num(t.moneyOut) - num(t.fees),
      },
      account: d.account ? toAccount(d.account) : null,
      openingBalance: numOrNull(d.openingBalance),
      closingBalance: numOrNull(d.closingBalance),
      period: toPeriod(d.period),
      meta: toMeta(res.meta, rows.length),
    };
  },
  getEntry: async (id: number): Promise<FinanceEntry> => {
    const e = (await api.get(`/finance/entries/${id}`)).data.data ?? {};
    return {
      id: e.id, accountId: num(e.accountId), accountName: e.accountName ?? null, kind: e.kind ?? 'income', direction: e.direction === 'out' ? 'out' : 'in',
      amount: num(e.amount), date: String(e.date ?? '').slice(0, 10), category: e.category ?? '', party: e.party ?? '', reference: e.reference ?? '', note: e.note ?? '',
    };
  },
  createEntry: async (body: EntryInput) => (await api.post('/finance/entries', body)).data.data,
  updateEntry: async (id: number, body: Partial<EntryInput>) => (await api.put(`/finance/entries/${id}`, body)).data.data,
  deleteEntry: async (id: number) => (await api.delete(`/finance/entries/${id}`)).data,
  getTransfer: async (id: number): Promise<FinanceTransfer> => {
    const t = (await api.get(`/finance/transfers/${id}`)).data.data ?? {};
    return { id: t.id, fromAccountId: num(t.fromAccountId), toAccountId: num(t.toAccountId), amount: num(t.amount), date: String(t.date ?? '').slice(0, 10), reference: t.reference ?? '', note: t.note ?? '' };
  },
  createTransfer: async (body: TransferInput) => (await api.post('/finance/transfers', body)).data.data,
  updateTransfer: async (id: number, body: Partial<TransferInput>) => (await api.put(`/finance/transfers/${id}`, body)).data.data,
  deleteTransfer: async (id: number) => (await api.delete(`/finance/transfers/${id}`)).data,

  // Inventory
  getValuation: async (params: ValuationParams): Promise<Valuation> => {
    const res = (await api.get('/finance/inventory/valuation', { params })).data;
    const d = res.data ?? {};
    const t = d.totals ?? {};
    const group = (idKey: string) => (g: any): ValuationGroup => ({
      id: g[idKey] ?? null, name: g.name ?? '—', units: num(g.units), costValue: num(g.costValue), retailValue: num(g.retailValue), potentialProfit: num(g.potentialProfit),
    });
    const rows = arr(d.rows).map((r: any): ValuationRow => ({
      productId: Number(r.productId), name: r.name ?? '—', sku: r.sku ?? null, categoryId: r.categoryId ?? null, categoryName: r.categoryName ?? null,
      units: num(r.units), unitCost: num(r.unitCost), unitPrice: num(r.unitPrice), costValue: num(r.costValue), retailValue: num(r.retailValue), potentialProfit: num(r.potentialProfit),
    }));
    return {
      totals: { productCount: num(t.productCount), units: num(t.units), costValue: num(t.costValue), retailValue: num(t.retailValue), potentialProfit: num(t.potentialProfit), marginPct: numOrNull(t.marginPct) },
      byLocation: arr(d.byLocation).map(group('locationId')),
      byCategory: arr(d.byCategory).map(group('categoryId')),
      rows,
      meta: toMeta(res.meta, rows.length),
    };
  },
  getInventoryLedger: async (p: InventoryLedgerParams): Promise<InventoryLedgerResult> => {
    const { from, to, preset, ...rest } = p;
    const res = (await api.get('/finance/inventory/ledger', { params: { ...periodQuery({ from, to, preset }), ...rest } })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map((r: any): InventoryMovement => ({
      id: Number(r.id), date: r.date ?? '', productId: r.productId ?? null, productName: r.productName ?? '—', sku: r.sku ?? null,
      variantId: r.variantId ?? null, variantName: r.variantName ?? null, locationId: r.locationId ?? null, locationName: r.locationName ?? null,
      type: r.type ?? '', typeLabel: r.typeLabel ?? r.type ?? '', quantity: num(r.quantity), qtyIn: num(r.qtyIn), qtyOut: num(r.qtyOut),
      quantityBefore: numOrNull(r.quantityBefore), quantityAfter: numOrNull(r.quantityAfter), unitCost: num(r.unitCost), value: num(r.value),
      reference: r.reference ? { type: r.reference.type ?? '', id: r.reference.id ?? null, label: r.reference.label ?? '', href: r.reference.href ?? null } : null,
      reason: r.reason ?? null, notes: r.notes ?? null, createdBy: r.createdBy ?? null, runningQty: numOrNull(r.runningQty),
      orderItemId: r.orderItemId ?? null, backfilled: !!r.backfilled, isOpening: !!r.isOpening, ledgerHref: r.ledgerHref ?? null, orderHref: r.orderHref ?? null,
    }));
    const t = d.totals ?? {};
    return {
      context: toContext(d),
      rows,
      totals: { count: num(t.count), qtyIn: num(t.qtyIn), qtyOut: num(t.qtyOut), valueIn: num(t.valueIn), valueOut: num(t.valueOut) },
      product: d.product ? { id: d.product.id, name: d.product.name, sku: d.product.sku ?? null, currentQty: num(d.product.currentQty) } : null,
      meta: toMeta(res.meta, rows.length),
    };
  },
  getCogs: async (p: PeriodParams & { locationId?: number }): Promise<CogsResult> => {
    const { locationId, ...period } = p;
    const d = (await api.get('/finance/inventory/cogs', { params: { ...periodQuery(period), locationId } })).data.data ?? {};
    const line = (idKey: string) => (x: any): CogsLine => ({ id: x[idKey] ?? null, name: x.name ?? '—', units: num(x.units), revenue: num(x.revenue), cogs: num(x.cogs), grossProfit: num(x.grossProfit) });
    const t = d.totals ?? {};
    return {
      context: toContext(d),
      period: toPeriod(d.period),
      totals: { revenue: num(t.revenue), cogs: num(t.cogs), grossProfit: num(t.grossProfit), marginPct: numOrNull(t.marginPct), units: num(t.units), orders: num(t.orders) },
      byCategory: arr(d.byCategory).map(line('categoryId')),
      topProducts: arr(d.topProducts).map(line('productId')),
    };
  },

  // Payouts
  getPayouts: async (p: PeriodParams & { type?: string; accountId?: number; method?: string; search?: string; page?: number; perPage?: number }): Promise<PayoutsResult> => {
    const { from, to, preset, ...rest } = p;
    const res = (await api.get('/finance/payouts', { params: { ...periodQuery({ from, to, preset }), ...rest } })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map((r: any): PayoutRow => ({
      id: String(r.id), type: r.type ?? '', typeLabel: r.typeLabel ?? r.type ?? '', date: String(r.date ?? '').slice(0, 10), payee: r.payee ?? null, payeeId: r.payeeId ?? null,
      amount: num(r.amount), accountId: r.accountId ?? null, accountName: r.accountName ?? null, method: r.method ?? null, methodLabel: r.methodLabel ?? r.method ?? null,
      reference: r.reference ?? null, note: r.note ?? null, link: toLink(r.link),
    }));
    return {
      context: toContext(d),
      rows,
      totals: { total: num(d.totals?.total), count: num(d.totals?.count), byType: Object.fromEntries(Object.entries(d.totals?.byType ?? {}).map(([k, v]) => [k, num(v)])) },
      period: toPeriod(d.period),
      meta: toMeta(res.meta, rows.length),
    };
  },
  getPayoutSummary: async (): Promise<PayoutSummary> => {
    const d = (await api.get('/finance/payouts/summary')).data.data ?? {};
    const s = d.supplierDues ?? {}, u = d.unpaidSalaries ?? {}, o = d.dorjiOwed ?? {};
    return {
      total: num(d.total),
      supplierDues: {
        total: num(s.total), partyCount: num(s.partyCount), overdueAmount: num(s.overdueAmount), dueNext7Amount: num(s.dueNext7Amount),
        rows: arr(s.rows).map((r: any) => ({ vendorId: Number(r.vendorId), name: r.name ?? '—', phone: r.phone ?? null, due: num(r.due), docs: num(r.docs), oldestDate: r.oldestDate ?? null, dueDate: r.dueDate ?? null, overdue: !!r.overdue })),
      },
      unpaidSalaries: {
        total: num(u.total), count: num(u.count),
        rows: arr(u.rows).map((r: any) => ({ salaryPaymentId: Number(r.salaryPaymentId), staffId: r.staffId ?? null, name: r.name ?? '—', month: r.month ?? null, monthLabel: r.monthLabel ?? r.month ?? null, net: num(r.net), method: r.method ?? null })),
      },
      dorjiOwed: {
        total: num(o.total), count: num(o.count),
        rows: arr(o.rows).map((r: any) => ({ dorjiId: Number(r.dorjiId), name: r.name ?? '—', phone: r.phone ?? null, owed: num(r.owed) })),
      },
    };
  },

  // Receivables
  getReceivables: async (params: ReceivablesParams): Promise<ReceivablesResult> => {
    const res = (await api.get('/finance/receivables', { params })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map((r: any): CustomerDueRow => ({
      partyId: Number(r.partyId), name: r.name ?? '—', phone: r.phone ?? null, walkIn: !!r.walkIn, docs: num(r.docs), due: num(r.due),
      oldestDate: r.oldestDate ?? null, ageDays: num(r.ageDays), oldestDocNo: r.oldestDocNo ?? null, lastPaymentDate: r.lastPaymentDate ?? null,
      paidSoFar: num(r.paidSoFar), hasPartial: !!r.hasPartial, lastDocNos: arr<string>(r.lastDocNos),
    }));
    return {
      rows, aging: toBuckets(d.aging),
      stats: Object.fromEntries(Object.entries(d.stats ?? {}).map(([k, v]) => [k, num(v)])),
      meta: toMeta(res.meta, rows.length),
    };
  },
  getReceivableSummary: async (): Promise<ReceivableSummary> => {
    const d = (await api.get('/finance/receivables/summary')).data.data ?? {};
    const c = d.customerDues ?? {}, cod = d.codWithCouriers ?? {}, t = d.tailorBalances ?? {};
    return {
      total: num(d.total),
      suppliers: { owed: num(d.suppliers?.owed), credits: num(d.suppliers?.credits), theyOweYou: num(d.suppliers?.theyOweYou), net: num(d.suppliers?.net) },
      customerDues: { total: num(c.total), excludingCod: num(c.excludingCod), partyCount: num(c.partyCount), aging: toBuckets(c.aging) },
      codWithCouriers: {
        total: num(cod.total), count: num(cod.count),
        byCourier: arr(cod.byCourier).map((x: any) => ({ carrier: x.carrier ?? 'Unknown', amount: num(x.amount), count: num(x.count) })),
        rows: arr(cod.rows).map((r: any) => ({
          shipmentId: Number(r.shipmentId), sellId: r.sellId ?? null, invoiceNo: r.invoiceNo ?? null, customerName: r.customerName ?? null, carrier: r.carrier ?? null,
          trackingNumber: r.trackingNumber ?? null, status: r.status ?? null, codState: r.codState ?? null, amount: num(r.amount),
          shippedAt: r.shippedAt ?? null, deliveredAt: r.deliveredAt ?? null, ageDays: num(r.ageDays),
        })),
      },
      tailorBalances: {
        total: num(t.total), count: num(t.count),
        rows: arr(t.rows).map((r: any) => ({
          orderId: Number(r.orderId), orderNumber: r.orderNumber ?? null, customerName: r.customerName ?? null, orderDate: r.orderDate ?? null,
          deliveryDate: r.deliveryDate ?? null, status: r.status ?? null, total: num(r.total), paid: num(r.paid), due: num(r.due),
        })),
      },
    };
  },

  // Payments received
  getPayments: async (p: PaymentsParams): Promise<PaymentsResult> => {
    const { from, to, preset, ...rest } = p;
    const res = (await api.get('/finance/payments', { params: { ...periodQuery({ from, to, preset }), ...rest } })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map(toLedgerRow);
    return {
      context: toContext(d),
      rows,
      totals: {
        received: num(d.totals?.received), refunded: num(d.totals?.refunded), net: num(d.totals?.net), count: num(d.totals?.count),
        fees: num(d.totals?.fees), netAfterFees: d.totals?.netAfterFees != null ? num(d.totals.netAfterFees) : num(d.totals?.net) - num(d.totals?.fees),
      },
      period: toPeriod(d.period),
      meta: toMeta(res.meta, rows.length),
    };
  },
  getUnpaidSales: async (params: { search?: string; limit?: number }): Promise<UnpaidSale[]> => {
    const d = (await api.get('/finance/payments/unpaid-sales', { params })).data.data;
    return arr(d).map((s: any) => ({
      sellId: Number(s.sellId), invoiceNo: s.invoiceNo ?? '', customerName: s.customerName ?? null, customerPhone: s.customerPhone ?? null, orderDate: s.orderDate ?? null,
      total: num(s.total), paid: num(s.paid), due: num(s.due), method: s.method ?? null, status: s.status ?? null,
    }));
  },

  // Reports
  getPnl: async (p: PeriodParams & { compare?: 'previous' | 'none' }): Promise<PnlReport> => {
    const { compare, ...period } = p;
    const d = (await api.get('/finance/reports/pnl', { params: { ...periodQuery(period), compare } })).data.data ?? {};
    return {
      context: toContext(d),
      closeStatus: d.closeStatus ? toCloseStatus(d.closeStatus) : null,
      period: toPeriod(d.period),
      current: toPnl(d.current),
      previous: d.previous ? toPnl(d.previous) : null,
      changes: d.changes ? Object.fromEntries(Object.entries(d.changes).map(([k, v]) => [k, numOrNull(v)])) : null,
      months: arr(d.months).map((m: any) => ({
        key: String(m.key), label: String(m.label ?? m.key), revenue: num(m.revenue), cogs: num(m.cogs), grossProfit: num(m.grossProfit), expenses: num(m.expenses),
        otherIncome: num(m.otherIncome), otherExpenses: num(m.otherExpenses), netProfit: num(m.netProfit),
        closed: !!m.closed, netAtClose: numOrNull(m.netAtClose),
      })),
    };
  },
  getCashflow: async (p: PeriodParams): Promise<CashflowReport> => {
    const d = (await api.get('/finance/reports/cashflow', { params: periodQuery(p) })).data.data ?? {};
    return {
      context: toContext(d),
      period: toPeriod(d.period),
      openingBalance: num(d.openingBalance), moneyIn: num(d.moneyIn), moneyOut: num(d.moneyOut), net: num(d.net), closingBalance: num(d.closingBalance),
      bySource: arr(d.bySource).map((s: any) => ({ sourceType: s.sourceType ?? '', label: s.label ?? s.sourceType ?? '', moneyIn: num(s.moneyIn), moneyOut: num(s.moneyOut), net: num(s.net), count: num(s.count) })),
      byAccount: arr(d.byAccount).map((a: any) => ({
        accountId: Number(a.accountId), name: a.name ?? '—', type: a.type ?? '', openingBalance: num(a.openingBalance), moneyIn: num(a.moneyIn), moneyOut: num(a.moneyOut),
        transfersIn: num(a.transfersIn), transfersOut: num(a.transfersOut), closingBalance: num(a.closingBalance),
      })),
      series: arr(d.series).map(toPoint),
      granularity: d.granularity === 'month' ? 'month' : 'day',
    };
  },
  getStatement: async (p: PeriodParams & { accountId: number }): Promise<StatementReport> => {
    const { accountId, ...period } = p;
    const d = (await api.get('/finance/reports/statement', { params: { ...periodQuery(period), accountId } })).data.data ?? {};
    return {
      account: d.account ? toAccount(d.account) : null,
      period: toPeriod(d.period),
      openingBalance: num(d.openingBalance), moneyIn: num(d.moneyIn), moneyOut: num(d.moneyOut), closingBalance: num(d.closingBalance),
      rows: arr(d.rows).map(toLedgerRow),
      truncated: !!d.truncated,
    };
  },
  getTax: async (p: PeriodParams): Promise<TaxReport> => {
    const d = (await api.get('/finance/reports/tax', { params: periodQuery(p) })).data.data ?? {};
    const nb = d.notBrokenDown;
    return {
      context: toContext(d),
      notBrokenDown: nb ? { label: nb.label ?? 'Not broken down (orders before line tax was recorded)', orders: num(nb.orders), taxableAmount: num(nb.taxableAmount), tax: num(nb.tax) } : null,
      reconciles: d.reconciles == null ? null : !!d.reconciles,
      period: toPeriod(d.period),
      taxCollected: num(d.taxCollected), taxableSales: num(d.taxableSales), salesTotal: num(d.salesTotal), orders: num(d.orders), taxedOrders: num(d.taxedOrders),
      effectiveRatePct: numOrNull(d.effectiveRatePct),
      byRate: arr(d.byRate).map((r: any) => ({ rate: numOrNull(r.rate), name: r.name ?? null, label: r.label ?? null, orders: num(r.orders), taxableAmount: num(r.taxableAmount), tax: num(r.tax) })),
      byMonth: arr(d.byMonth).map((m: any) => ({ key: String(m.key), label: String(m.label ?? m.key), orders: num(m.orders), taxableAmount: num(m.taxableAmount), tax: num(m.tax) })),
    };
  },
  getAging: async (): Promise<AgingReport> => {
    const d = (await api.get('/finance/reports/aging')).data.data ?? {};
    const r = d.receivables ?? {}, p = d.payables ?? {};
    return {
      asOf: d.asOf ?? null,
      receivables: {
        total: num(r.total), buckets: toBuckets(r.buckets),
        customers: arr(r.customers).map((c: any) => ({ partyId: Number(c.partyId), name: c.name ?? '—', due: num(c.due), ageDays: num(c.ageDays), bucket: num(c.bucket) })),
        codWithCouriers: num(r.codWithCouriers), tailorBalances: num(r.tailorBalances),
      },
      payables: {
        total: num(p.total), buckets: toBuckets(p.buckets),
        suppliers: arr(p.suppliers).map((s: any) => ({ partyId: Number(s.partyId), name: s.name ?? '—', due: num(s.due), ageDays: num(s.ageDays), bucket: num(s.bucket), overdue: !!s.overdue })),
        unpaidSalaries: num(p.unpaidSalaries), dorjiOwed: num(p.dorjiOwed),
      },
    };
  },

  // ── v2 ──
  getMetrics: async (p: PeriodParams): Promise<FinanceMetrics & { context: FinanceContext }> => {
    const d = (await api.get('/finance/metrics', { params: periodQuery(p) })).data.data ?? {};
    return { ...toMetrics(d), context: toContext(d) };
  },
  getProductsWithoutCost: async (p: PeriodParams & { search?: string; page?: number; perPage?: number }): Promise<{ context: FinanceContext; rows: ProductWithoutCost[]; totals: { products: number; uncostedSales: number }; meta: PageMeta }> => {
    const { from, to, preset, channel, ...rest } = p;
    const res = (await api.get('/finance/products/without-cost', { params: { ...periodQuery({ from, to, preset: preset ?? 'all_time', channel }), ...rest } })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map((r: any): ProductWithoutCost => ({
      productId: Number(r.productId), name: r.name ?? '—', sku: r.sku ?? null, stock: num(r.stock), unitsSold: num(r.unitsSold), uncostedSales: num(r.uncostedSales), price: num(r.price), editHref: r.editHref ?? null,
    }));
    return { context: toContext(d), rows, totals: { products: num(d.totals?.products), uncostedSales: num(d.totals?.uncostedSales) }, meta: toMeta(res.meta, rows.length) };
  },

  // Inventory v2
  getOpeningStock: async (params: { cutoverDate?: string; search?: string; page?: number; perPage?: number }): Promise<OpeningStockPreview> => {
    const res = (await api.get('/finance/inventory/opening-stock', { params })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map((r: any): OpeningStockRow => ({
      productId: Number(r.productId), name: r.name ?? '—', sku: r.sku ?? null, quantity: num(r.quantity), unitCost: r.unitCost == null || num(r.unitCost) <= 0 ? null : num(r.unitCost),
      value: num(r.value), needsCost: !!r.needsCost, locationId: r.locationId ?? null,
    }));
    const t = d.totals ?? {};
    return {
      context: toContext(d), cutoverDate: d.cutoverDate ?? null, cutoverReason: d.cutoverReason ?? null, rows,
      totals: { products: num(t.products), ready: num(t.ready), needsCost: num(t.needsCost), quantity: num(t.quantity), value: num(t.value) },
      alreadyMovedIn: num(d.alreadyMovedIn), meta: toMeta(res.meta, rows.length),
    };
  },
  postOpeningStock: async (body: OpeningStockInput): Promise<OpeningStockResult> => {
    const res = (await api.post('/finance/inventory/opening-stock', body)).data;
    const d = res.data ?? {};
    return {
      posted: num(d.posted), quantity: num(d.quantity), value: num(d.value), remaining: num(d.remaining), message: res.message ?? 'Opening stock moved in',
      skipped: arr(d.skipped).map((x: any) => ({ productId: Number(x.productId), name: x.name ?? '', reason: x.reason ?? '', label: x.label ?? x.reason ?? '' })),
    };
  },
  getMissingSaleMovements: async (): Promise<MissingSaleMovements> => {
    const d = (await api.get('/finance/inventory/sale-movements/missing')).data.data ?? {};
    return {
      lines: num(d.lines), sales: num(d.sales), quantity: num(d.quantity), value: num(d.value),
      sample: arr(d.sample).map((x: any) => ({ sellId: Number(x.sellId), invoiceNo: x.invoiceNo ?? '', orderDate: x.orderDate ?? null, productId: x.productId ?? null, productName: x.productName ?? '—', variantId: x.variantId ?? null, quantity: num(x.quantity), unitCost: num(x.unitCost), value: num(x.value) })),
    };
  },
  backfillSaleMovements: async (dryRun = false): Promise<{ created: number; lines: number; sales: number; skipped: number; message: string }> => {
    const res = (await api.post('/finance/inventory/sale-movements/backfill', { dryRun })).data;
    const d = res.data ?? {};
    return { created: num(d.created), lines: num(d.lines), sales: num(d.sales), skipped: num(d.skipped), message: res.message ?? 'Missing sale movements created' };
  },
  getReconciliation: async (): Promise<Reconciliation> => {
    const d = (await api.get('/finance/inventory/reconciliation')).data.data ?? {};
    return {
      context: toContext(d), stockValue: num(d.stockValue), movementValue: num(d.movementValue), difference: num(d.difference), status: d.status ?? (num(d.difference) === 0 ? 'ok' : 'gap'), text: d.text ?? '',
      lines: arr(d.lines).map((l: any): ReconciliationLine => ({
        kind: l.kind ?? '', label: l.label ?? l.kind ?? '', productId: l.productId ?? null, name: l.name ?? '—', quantity: num(l.quantity), value: num(l.value), explanation: l.explanation ?? '',
        action: l.action ? { type: l.action.type ?? '', label: l.action.label ?? 'Fix', href: l.action.href ?? null } : null,
      })),
      byKind: arr(d.byKind).map((k: any) => ({ kind: k.kind ?? '', label: k.label ?? k.kind ?? '', count: num(k.count), value: num(k.value) })),
      missingSaleMovements: { lines: num(d.missingSaleMovements?.lines), value: num(d.missingSaleMovements?.value) },
      explained: num(d.explained), unexplained: num(d.unexplained),
    };
  },

  // Expenses v2
  voidExpense: async (id: number, body: { reason: string; date?: string }) => (await api.post(`/finance/expenses/${id}/void`, body)).data,
  getExpenseActivity: async (id: number): Promise<ExpenseActivity[]> => {
    const d = (await api.get(`/finance/expenses/${id}/activity`)).data.data ?? {};
    return arr(d.rows ?? d).map((r: any) => ({
      id: Number(r.id), action: r.action ?? '', label: r.label ?? r.action ?? '', at: r.at ?? null, byId: r.byId ?? null, byName: r.byName ?? null,
      changes: r.changes && typeof r.changes === 'object' ? r.changes : null, note: r.note ?? null,
    }));
  },

  // Month close v2
  getClose: async (): Promise<CloseState> => {
    const d = (await api.get('/finance/close')).data.data ?? {};
    return { context: toContext(d), status: toCloseStatus(d.status ?? {}), months: arr(d.months).map(toCloseMonth) };
  },
  closeMonth: async (month: string, note?: string): Promise<{ month: CloseMonth; message: string }> => {
    const res = (await api.post('/finance/close', { month, note: note || undefined })).data;
    return { month: toCloseMonth(res.data), message: res.message ?? 'Month closed' };
  },
  reopenMonth: async (month: string, reason: string): Promise<{ month: CloseMonth; message: string }> => {
    const res = (await api.post(`/finance/close/${month}/reopen`, { reason })).data;
    return { month: toCloseMonth(res.data), message: res.message ?? 'Month reopened' };
  },

  // Fees v2
  getFees: async (): Promise<FeesResult> => toFees((await api.get('/finance/fees')).data.data),
  saveFees: async (fees: { methodKey: string; percent: number; fixed: number }[]): Promise<FeesResult> => toFees((await api.put('/finance/fees', { fees })).data.data),

  // Payables v2
  getPayable: async (params?: { type?: string; search?: string }): Promise<PayableResult> => {
    const d = (await api.get('/finance/payouts/payable', { params })).data.data ?? {};
    const rows = arr(d.rows).map(toPayable);
    const t = d.totals ?? {};
    const payable = d.groups?.payable ? arr(d.groups.payable).map(toPayable) : rows.filter((r) => r.payableNow > 0).sort((a, b) => b.payableNow - a.payableNow);
    const nothingPayable = d.groups?.nothingPayable ? arr(d.groups.nothingPayable).map(toPayable) : rows.filter((r) => r.payableNow <= 0);
    return {
      context: toContext(d), rows, payable, nothingPayable,
      totals: { owed: num(t.owed), notYetDue: num(t.notYetDue), credits: num(t.credits), payableNow: num(t.payableNow), theyOweYou: num(t.theyOweYou), parties: num(t.parties) },
    };
  },
  getPayableParty: async (type: string, id: number): Promise<PayableRow & { documents: PayableDocument[] }> => {
    const d = (await api.get(`/finance/payouts/payable/${type}/${id}`)).data.data ?? {};
    const row = d.row ?? d;
    return {
      ...toPayable(row),
      documents: arr(d.documents ?? row.documents).map((x: any) => ({
        documentType: x.documentType ?? '', documentId: x.documentId ?? null, no: x.no ?? '', status: x.status ?? null, date: x.date ?? null, dueDate: x.dueDate ?? null, due: num(x.due), notYetDue: !!x.notYetDue,
        salaryPaymentId: x.salaryPaymentId ?? (x.documentType === 'payslip' ? x.documentId ?? null : null), month: x.month ?? null, monthLabel: x.monthLabel ?? null, method: x.method ?? null,
      })),
    };
  },

  // Receivables v2
  getSupplierReceivables: async (params?: { search?: string; direction?: 'all' | 'we_owe' | 'they_owe' }): Promise<SupplierReceivables> => {
    const d = (await api.get('/finance/receivables/suppliers', { params })).data.data ?? {};
    const t = d.totals ?? {};
    return {
      context: toContext(d),
      rows: arr(d.rows).map((r: any): SupplierReceivableRow => ({
        vendorId: Number(r.vendorId), name: r.name ?? '', displayName: r.displayName ?? r.name ?? 'Supplier', deleted: !!r.deleted, fullId: r.fullId != null ? String(r.fullId) : null,
        owed: num(r.owed), notYetDue: num(r.notYetDue), credits: num(r.credits), payableNow: num(r.payableNow), net: num(r.net),
        direction: r.direction ?? (num(r.net) < 0 ? 'they_owe' : 'we_owe'), directionLabel: r.directionLabel ?? (num(r.net) < 0 ? 'They owe you' : 'You owe'),
        action: r.action ?? null, payDisabledReason: r.payDisabledReason ?? null, payHref: r.payHref ?? null, collectHref: r.collectHref ?? null,
      })),
      totals: { owed: num(t.owed), credits: num(t.credits), net: num(t.net), weOwe: num(t.weOwe), theyOweYou: num(t.theyOweYou), payableNow: num(t.payableNow) },
    };
  },
  receiveFromSupplier: async (vendorId: number, body: SupplierReceiptInput) => (await api.post(`/finance/receivables/suppliers/${vendorId}/receive`, body)).data,
  getCustomerReceivables: async (params: { search?: string; bucket?: number | 'all'; channel?: string; cod?: boolean; sort?: 'age' | 'amount' | 'name'; page?: number; perPage?: number }): Promise<CustomerReceivables> => {
    const q: Record<string, unknown> = { ...params };
    if (params.channel === 'all') delete q.channel;
    if (params.cod == null) delete q.cod; else q.cod = params.cod ? 'true' : 'false';
    const res = (await api.get('/finance/receivables/customers', { params: q })).data;
    const d = res.data ?? {};
    const rows = arr(d.rows).map((r: any): CustomerReceivableRow => ({
      sellId: Number(r.sellId), invoiceNo: r.invoiceNo ?? '', customerId: r.customerId ?? null, customerName: r.customerName ?? null, customerPhone: r.customerPhone ?? null,
      orderDate: r.orderDate ?? null, ageDays: num(r.ageDays), bucket: num(r.bucket), total: num(r.total), paid: num(r.paid), due: num(r.due),
      method: r.method ?? null, methodKey: r.methodKey ?? null, isCod: !!r.isCod, codState: r.codState ?? null, channel: r.channel ?? null, status: r.status ?? null, orderHref: r.orderHref ?? null,
    }));
    const t = d.totals ?? {};
    return { context: toContext(d), rows, aging: toBuckets(d.aging), totals: { due: num(t.due), count: num(t.count), customers: num(t.customers), codDue: num(t.codDue) }, meta: toMeta(res.meta, rows.length) };
  },

  // Payments v2
  getPaymentsSummary: async (p: PeriodParams): Promise<PaymentsSummary> => {
    const d = (await api.get('/finance/payments/summary', { params: periodQuery(p) })).data.data ?? {};
    const n = d.needsALook ?? {}, ts = d.toSuppliers ?? {};
    return {
      context: toContext(d),
      orderVolume: { amount: num(d.orderVolume?.amount), count: num(d.orderVolume?.count) },
      paidVolume: { recorded: num(d.paidVolume?.recorded), estimated: num(d.paidVolume?.estimated), total: num(d.paidVolume?.total), estimatedCount: num(d.paidVolume?.estimatedCount), estimatedNote: d.paidVolume?.estimatedNote ?? null },
      received: { amount: num(d.received?.amount), count: num(d.received?.count), fees: num(d.received?.fees), net: num(d.received?.net) },
      refunds: toRefunds(d.refunds),
      needsALook: {
        asOf: n.asOf ?? null, label: n.label ?? 'As things stand now',
        onlineUnconfirmed: toLinked(n.onlineUnconfirmed, 'Online payments not confirmed'),
        codAwaitingCollection: toLinked(n.codAwaitingCollection, 'COD orders awaiting collection'),
        refundsAwaiting: toLinked(n.refundsAwaiting, 'Refunds awaiting settlement'),
      },
      toSuppliers: { owed: num(ts.owed), payableNow: num(ts.payableNow), notYetDue: num(ts.notYetDue), credits: num(ts.credits), paidInPeriod: num(ts.paidInPeriod), payoutsHref: ts.payoutsHref ?? null, receivablesHref: ts.receivablesHref ?? null },
    };
  },

  // Health v2
  getHealth: async (p: PeriodParams): Promise<HealthResult> => {
    const d = (await api.get('/finance/health', { params: periodQuery(p) })).data.data ?? {};
    const checks = arr(d.checks).map((c: any): HealthCheck => ({
      id: String(c.id ?? ''), title: c.title ?? '', status: c.status ?? 'info', expected: numOrNull(c.expected), actual: numOrNull(c.actual), difference: numOrNull(c.difference),
      numbers: Object.fromEntries(Object.entries(c.numbers ?? {}).map(([k, v]) => [k, num(v)])), explanation: c.explanation ?? '',
    }));
    return { context: toContext(d), passed: num(d.passed), failed: num(d.failed), ok: d.ok ?? checks.every((c) => c.status !== 'fail'), checks };
  },

  /** CSV straight from the server (respects every filter) → browser download. */
  downloadCsv: async (path: string, params: Record<string, unknown>, filename: string) => {
    const res = await api.get(path, { params: { ...params, format: 'csv', page: undefined, perPage: undefined }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export default financeApi;
