// Finance module — mirrors FINANCE_API_CONTRACT.md (camelCase JSON).

export type FinanceDirection = "in" | "out";

export type FinanceAccountType = "cash" | "bank" | "mobile_wallet" | "card" | "other";

export type FinanceSourceType =
  | "sale"
  | "cod"
  | "refund"
  | "supplier_payment"
  | "supplier_refund"
  | "expense"
  | "expense_void"
  | "salary"
  | "dorji_payout"
  | "tailor_payment"
  | "manual"
  | "transfer";

export type FinancePeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "all_time"
  | "custom";

/** Sales channel filter (sells.source). */
export type FinanceChannel = "all" | "pos" | "online" | "manual";

export const FINANCE_CHANNELS: { value: FinanceChannel; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "pos", label: "POS" },
  { value: "online", label: "Online store" },
  { value: "manual", label: "Manual" },
];

/** What screens send: a preset, or `custom` with typed dates (+ optional channel). */
export type FinancePeriodQuery = {
  preset?: FinancePeriodPreset;
  from?: string;
  to?: string;
  channel?: Exclude<FinanceChannel, "all">;
};

/** v2 `data.context` on every finance response. */
export type FinanceMeta = {
  currency: { code: string; symbol: string | null } | null;
  channel: string | null;
  channelLabel: string | null;
  tz: string | null;
  asOf: string | null;
  /** Point-in-time figures ("As things stand now"); the period picker doesn't apply. */
  currentState: boolean;
  /** "sales_only" when the channel narrows only sale-linked figures. */
  channelScope: string | null;
};

export type FinancePeriod = {
  preset: string;
  label: string;
  from: string | null;
  to: string | null;
  previousFrom: string | null;
  previousTo: string | null;
};

export const FINANCE_SOURCE_LABELS: Record<string, string> = {
  sale: "Sale payment",
  cod: "COD collection",
  refund: "Customer refund",
  supplier_payment: "Supplier payment",
  supplier_refund: "Supplier refund",
  expense: "Expense",
  expense_void: "Expense voided",
  salary: "Salary",
  dorji_payout: "Dorji payout",
  tailor_payment: "Tailor payment",
  manual: "Manual entry",
  transfer: "Transfer",
};

export const FINANCE_ACCOUNT_TYPES: { value: FinanceAccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "mobile_wallet", label: "Mobile wallet" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const FINANCE_METHODS: { key: string; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "bank", label: "Bank transfer" },
  { key: "card", label: "Card" },
  { key: "bkash", label: "bKash" },
  { key: "nagad", label: "Nagad" },
  { key: "rocket", label: "Rocket" },
  { key: "online", label: "Online" },
  { key: "cod", label: "Cash on delivery" },
  { key: "cheque", label: "Cheque" },
];

export type FinanceLink = { type: string; id: number | null; href: string | null };

export type FinanceAccount = {
  id: number;
  name: string;
  type: FinanceAccountType;
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
};

export type FinanceAccountsResult = {
  accounts: FinanceAccount[];
  totals: { balance: number; moneyIn: number; moneyOut: number; activeCount: number };
  asOf: string | null;
  methodOptions: { key: string; label: string; accountId: number | null }[];
  unmappedMethods: { key: string; label: string; amount: number; count: number }[];
  defaultAccountId: number | null;
};

export type FinanceAccountDraft = {
  name?: string;
  type?: FinanceAccountType;
  methodKeys?: string[];
  openingBalance?: number;
  isDefault?: boolean;
  isActive?: boolean;
  note?: string | null;
};

export type FinanceTransaction = {
  id: string;
  sourceType: string;
  sourceLabel: string;
  date: string;
  createdAt: string | null;
  direction: FinanceDirection;
  amount: number;
  signedAmount: number;
  accountId: number | null;
  accountName: string | null;
  method: string | null;
  methodKey: string | null;
  methodLabel: string | null;
  party: string | null;
  partyId: number | null;
  reference: string | null;
  category: string | null;
  note: string | null;
  link: FinanceLink | null;
  editable: boolean;
  entryId: number | null;
  transferId: number | null;
  runningBalance: number | null;
  /** TXN-1/2: signed gross (refunds negative), method fee, net = gross − fee. */
  gross: number;
  fee: number;
  net: number;
  channel: string | null;
};

export type FinancePage<T> = { data: T[]; total: number; page: number; totalPages: number; meta?: FinanceMeta | null };

export type FinanceTransactionList = FinancePage<FinanceTransaction> & {
  totals: { moneyIn: number; moneyOut: number; net: number; count: number; gross: number | null; fees: number | null; netAfterFees: number | null };
  account: FinanceAccount | null;
  openingBalance: number | null;
  closingBalance: number | null;
  period: FinancePeriod | null;
};

export type FinanceTransactionParams = FinancePeriodQuery & {
  accountId?: number;
  direction?: FinanceDirection;
  sourceType?: string;
  method?: string;
  search?: string;
  sort?: "date_desc" | "date_asc";
  page?: number;
  perPage?: number;
};

export type FinanceEntryKind = "income" | "expense" | "adjustment";

export type FinanceEntryDraft = {
  accountId: number;
  kind: FinanceEntryKind;
  direction?: FinanceDirection;
  amount: number;
  date: string;
  category?: string;
  party?: string;
  reference?: string;
  note?: string;
};

export type FinanceEntry = FinanceEntryDraft & {
  id: number;
  accountName: string | null;
  direction: FinanceDirection;
  createdByName: string | null;
};

export type FinanceTransferDraft = {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  date: string;
  reference?: string;
  note?: string;
};

export type FinanceTransfer = FinanceTransferDraft & {
  id: number;
  fromAccountName: string | null;
  toAccountName: string | null;
};

export type FinanceKpi = { value: number; previous: number | null; changePct: number | null };

export type FinanceSeriesPoint = { key: string; label: string; moneyIn: number; moneyOut: number; net: number };

export type FinanceCategoryAmount = { categoryId: number | null; name: string; color: string | null; amount: number; pct: number | null };

export type FinanceAlert = {
  type: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  amount: number | null;
  count: number | null;
  href: string | null;
};

export type FinanceOverview = {
  period: FinancePeriod | null;
  kpis: {
    revenue: FinanceKpi;
    moneyIn: FinanceKpi;
    moneyOut: FinanceKpi;
    netCashFlow: FinanceKpi;
    cogs: FinanceKpi;
    grossProfit: FinanceKpi;
    expenses: FinanceKpi;
    netProfit: FinanceKpi;
    cashOnHand: FinanceKpi;
    receivables: FinanceKpi;
    payables: FinanceKpi;
  };
  receivables: { customerDues: number; codWithCouriers: number; tailorBalances: number; total: number };
  payables: { supplierDues: number; unpaidSalaries: number; dorjiOwed: number; total: number };
  cashFlow: { granularity: string; points: FinanceSeriesPoint[] };
  expensesByCategory: FinanceCategoryAmount[];
  accountBalances: { accountId: number; name: string; type: string; balance: number }[];
  recentTransactions: FinanceTransaction[];
  alerts: FinanceAlert[];
};

// Payouts ---------------------------------------------------------------------

export type FinancePayoutType = "supplier" | "salary" | "dorji";

export type FinancePayout = {
  id: string;
  type: string;
  typeLabel: string;
  date: string;
  payee: string | null;
  payeeId: number | null;
  amount: number;
  accountName: string | null;
  methodLabel: string | null;
  reference: string | null;
  note: string | null;
};

export type FinancePayoutList = FinancePage<FinancePayout> & {
  totals: { total: number; count: number; byType: Record<string, number> };
};

export type FinanceSupplierDue = {
  vendorId: number;
  name: string;
  phone: string | null;
  due: number;
  docs: number;
  oldestDate: string | null;
  dueDate: string | null;
  overdue: boolean;
};

export type FinanceUnpaidSalary = {
  salaryPaymentId: number;
  staffId: number;
  name: string;
  month: string | null;
  monthLabel: string | null;
  net: number;
  method: string | null;
};

export type FinanceDorjiOwed = { dorjiId: number; name: string; phone: string | null; owed: number };

export type FinancePayoutSummary = {
  total: number;
  supplierDues: { total: number; partyCount: number; overdueAmount: number; dueNext7Amount: number; rows: FinanceSupplierDue[] };
  unpaidSalaries: { total: number; count: number; rows: FinanceUnpaidSalary[] };
  dorjiOwed: { total: number; count: number; rows: FinanceDorjiOwed[] };
};

// Receivables -----------------------------------------------------------------

export type FinanceAgingBucket = { key: number; label: string; amount: number; count: number };

export type FinanceReceivableCustomer = {
  partyId: number;
  name: string;
  phone: string | null;
  walkIn: boolean;
  docs: number;
  due: number;
  oldestDate: string | null;
  ageDays: number | null;
  oldestDocNo: string | null;
  paidSoFar: number;
  hasPartial: boolean;
};

export type FinanceReceivableList = FinancePage<FinanceReceivableCustomer> & {
  aging: FinanceAgingBucket[];
  stats: {
    totalDue: number;
    partyCount: number;
    overdue30Amount: number;
    collectedThisMonth: number;
    openInvoices: number;
  } | null;
};

export type FinanceCodRow = {
  shipmentId: number;
  sellId: number | null;
  invoiceNo: string | null;
  customerName: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  status: string | null;
  codState: string | null;
  amount: number;
  ageDays: number | null;
};

export type FinanceTailorBalance = {
  orderId: number;
  orderNumber: string | null;
  customerName: string | null;
  orderDate: string | null;
  deliveryDate: string | null;
  status: string | null;
  total: number;
  paid: number;
  due: number;
};

export type FinanceReceivableSummary = {
  total: number;
  customerDues: { total: number; excludingCod: number; partyCount: number; aging: FinanceAgingBucket[] };
  codWithCouriers: { total: number; count: number; byCourier: { carrier: string; amount: number; count: number }[]; rows: FinanceCodRow[] };
  tailorBalances: { total: number; count: number; rows: FinanceTailorBalance[] };
  suppliers: { owed: number; credits: number; theyOweYou: number; net: number } | null;
};

// Payments --------------------------------------------------------------------

export type FinancePaymentList = FinancePage<FinanceTransaction> & {
  totals: { received: number; refunded: number; net: number; count: number; fees: number | null; netAfterFees: number | null };
};

export type FinanceUnpaidSale = {
  sellId: number;
  invoiceNo: string;
  customerName: string | null;
  customerPhone: string | null;
  orderDate: string | null;
  total: number;
  paid: number;
  due: number;
  method: string | null;
  status: string | null;
};

// Inventory -------------------------------------------------------------------

export type FinanceValuationGroup = {
  id: number | null;
  name: string;
  units: number;
  costValue: number;
  retailValue: number;
  potentialProfit: number;
};

export type FinanceValuation = {
  totals: { productCount: number; units: number; costValue: number; retailValue: number; potentialProfit: number; marginPct: number | null };
  byLocation: FinanceValuationGroup[];
  byCategory: FinanceValuationGroup[];
};

export type FinanceMovement = {
  id: number;
  date: string;
  productId: number | null;
  productName: string;
  sku: string | null;
  variantName: string | null;
  locationId: number | null;
  locationName: string | null;
  type: string;
  typeLabel: string;
  quantity: number;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  value: number;
  referenceLabel: string | null;
  reason: string | null;
  runningQty: number | null;
  isOpening: boolean;
  backfilled: boolean;
  orderHref: string | null;
};

export type FinanceMovementList = FinancePage<FinanceMovement> & {
  totals: { count: number; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number } | null;
  product: { id: number; name: string; sku: string | null; currentQty: number } | null;
};

export type FinanceCogs = {
  totals: { revenue: number; cogs: number; grossProfit: number; marginPct: number | null; units: number; orders: number };
  byCategory: { categoryId: number | null; name: string; units: number; revenue: number; cogs: number; grossProfit: number }[];
};

// Reports ---------------------------------------------------------------------

export type FinancePnlFigures = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number | null;
  expenses: number;
  expensesByCategory: FinanceCategoryAmount[];
  otherIncome: number;
  otherExpenses: number;
  netProfit: number;
  netMarginPct: number | null;
  info: { orders: number; tax: number; shipping: number; discounts: number; refunds: number } | null;
  paymentFees: number;
  voidedExpenses: number;
};

export type FinancePnl = {
  meta?: FinanceMeta;
  closeText: string | null;
  period: FinancePeriod | null;
  current: FinancePnlFigures;
  previous: FinancePnlFigures | null;
  changes: Record<string, number | null> | null;
};

export type FinanceCashflow = {
  meta?: FinanceMeta;
  period: FinancePeriod | null;
  openingBalance: number;
  moneyIn: number;
  moneyOut: number;
  net: number;
  closingBalance: number;
  bySource: { sourceType: string; label: string; moneyIn: number; moneyOut: number; net: number; count: number }[];
  byAccount: {
    accountId: number;
    name: string;
    type: string;
    openingBalance: number;
    moneyIn: number;
    moneyOut: number;
    transfersIn: number;
    transfersOut: number;
    closingBalance: number;
  }[];
};

export type FinanceTaxReport = {
  meta?: FinanceMeta;
  period: FinancePeriod | null;
  taxCollected: number;
  taxableSales: number;
  salesTotal: number;
  orders: number;
  taxedOrders: number;
  effectiveRatePct: number | null;
  byRate: { rate: number; orders: number; taxableAmount: number; tax: number }[];
  v2: FinanceTaxV2;
};

export type FinanceAgingReport = {
  asOf: string | null;
  receivables: { total: number; buckets: FinanceAgingBucket[]; codWithCouriers: number; tailorBalances: number };
  payables: { total: number; buckets: FinanceAgingBucket[]; unpaidSalaries: number; dorjiOwed: number };
};

// ---------------------------------------------------------------------------
// Finance v2 (FINANCE_API_CONTRACT.md "v2 additions")
// ---------------------------------------------------------------------------

/** OV-1: costed + uncosted + excluded = product sales. */
export type FinanceProfitCoverage = {
  productSales: number;
  costed: number;
  uncosted: number;
  excluded: number;
  /** Percent (0–100) of product sales that have a cost. */
  costedPct: number | null;
  productsWithoutCost: number;
};

export type FinanceRefundsMetric = { refunded: number; refundedCount: number; awaiting: number; awaitingCount: number; label: string | null };

export type FinanceOverviewV2 = {
  meta: FinanceMeta;
  coverage: FinanceProfitCoverage | null;
  storeCredit: { total: number; customers: number } | null;
  fees: { total: number; count: number } | null;
  orderVolume: { amount: number; orders: number } | null;
  paid: { recorded: number; estimated: number; total: number } | null;
  refunds: FinanceRefundsMetric | null;
  supplierCredits: number;
  closeText: string | null;
};

export type FinanceProductWithoutCost = {
  productId: number;
  name: string;
  sku: string | null;
  stock: number;
  unitsSold: number;
  uncostedSales: number;
  price: number;
};

// Inventory (INV-1, INV-2, INV-3) ----------------------------------------------------

export type FinanceOpeningStockRow = {
  productId: number;
  name: string;
  sku: string | null;
  quantity: number;
  unitCost: number | null;
  value: number;
  needsCost: boolean;
};

export type FinanceOpeningStockPreview = {
  rows: FinanceOpeningStockRow[];
  totals: { products: number; ready: number; needsCost: number; quantity: number; value: number };
  cutoverDate: string | null;
  cutoverReason: string | null;
  alreadyMovedIn: number;
  total: number;
};

export type FinanceOpeningStockResult = {
  posted: number;
  quantity: number;
  value: number;
  skipped: { productId: number; name: string; reason: string; label: string }[];
  remaining: number;
  message: string | null;
};

export type FinanceReconLine = {
  key: string;
  kind: string;
  label: string;
  productId: number | null;
  name: string | null;
  quantity: number | null;
  value: number;
  explanation: string | null;
  action: { type: string; label: string; href: string | null } | null;
};

export type FinanceInventoryReconciliation = {
  stockValue: number;
  movementValue: number;
  difference: number;
  status: string;
  text: string | null;
  lines: FinanceReconLine[];
  byKind: { kind: string; label: string; count: number; value: number }[];
  missingSaleMovements: { lines: number; value: number };
  explained: number;
  unexplained: number;
};

// Payables per party (PO-1, PO-2, PO-4) ----------------------------------------------

/** API `type`: supplier | dorji | staff. */
export type FinancePartyType = "supplier" | "dorji" | "staff";

export type FinanceBreakdownLine = { key: string; label: string; amount: number };

export type FinancePayableParty = {
  key: string;
  type: FinancePartyType;
  id: number;
  name: string;
  deleted: boolean;
  owed: number;
  notYetDue: number;
  credits: number;
  payableNow: number;
  breakdown: FinanceBreakdownLine[];
  nextDue: { date: string; amount: number } | null;
  status: "payable" | "nothing_payable" | "they_owe_you";
};

export type FinancePayablesSummary = {
  meta: FinanceMeta;
  totals: { owed: number; notYetDue: number; credits: number; payableNow: number; theyOweYou: number; parties: number };
  parties: FinancePayableParty[];
};

export type FinancePayableDocument = {
  documentType: string;
  documentId: number;
  no: string | null;
  label: string | null;
  status: string | null;
  date: string | null;
  dueDate: string | null;
  due: number;
  notYetDue: boolean;
};

// Receivables (RCV-1, RCV-2, RCV-4) ---------------------------------------------------

export type FinanceSupplierBalance = {
  vendorId: number;
  name: string;
  fullId: string | null;
  deleted: boolean;
  owed: number;
  notYetDue: number;
  credits: number;
  payableNow: number;
  /** owed − credits; negative = they owe you → Collect. */
  net: number;
  direction: string;
  directionLabel: string | null;
  action: "pay" | "collect" | null;
  payDisabledReason: string | null;
};

export type FinanceSupplierBalances = {
  meta: FinanceMeta;
  rows: FinanceSupplierBalance[];
  totals: { owed: number; credits: number; net: number; weOwe: number; theyOweYou: number; payableNow: number };
};

export type FinanceCustomerReceivable = {
  sellId: number;
  invoiceNo: string;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  orderDate: string | null;
  ageDays: number | null;
  bucket: number;
  total: number;
  paid: number;
  due: number;
  method: string | null;
  isCod: boolean;
  codState: string | null;
  channel: string | null;
  status: string | null;
};

export type FinanceCustomerReceivables = FinancePage<FinanceCustomerReceivable> & {
  aging: FinanceAgingBucket[];
  totals: { due: number; count: number; customers: number; codDue: number };
};

// Payments summary (PAY-1…PAY-6) ------------------------------------------------------

export type FinanceCountAmount = { count: number; amount: number; label: string | null };

export type FinancePaymentsSummary = {
  meta: FinanceMeta;
  orderVolume: { amount: number; count: number };
  paidVolume: { recorded: number; estimated: number; total: number; estimatedCount: number; estimatedNote: string | null };
  received: { amount: number; count: number; fees: number; net: number };
  refunds: FinanceRefundsMetric;
  needsALook: {
    label: string | null;
    onlineUnconfirmed: FinanceCountAmount;
    codAwaitingCollection: FinanceCountAmount;
    refundsAwaiting: FinanceCountAmount;
  };
  toSuppliers: { owed: number; payableNow: number; notYetDue: number; credits: number; paidInPeriod: number };
};

// Reports (RPT-1/2/3, health checks) ---------------------------------------------------

export type FinanceMonthClose = {
  month: string;
  label: string;
  status: "open" | "closed" | string;
  canClose: boolean;
  closedAt: string | null;
  closedByName: string | null;
  note: string | null;
  netAtClose: number | null;
  liveNet: number | null;
  drift: number | null;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
};

export type FinanceCloseStatus = {
  closedThrough: string | null;
  closedThroughLabel: string | null;
  text: string | null;
  suggestion: { month: string; label: string; text: string | null } | null;
  olderOpenMonth: { month: string; label: string; text: string | null } | null;
  months: FinanceMonthClose[];
};

export type FinanceTaxRate = { key: string; name: string; rate: number | null; orders: number; taxableAmount: number; tax: number };

export type FinanceTaxV2 = {
  rates: FinanceTaxRate[];
  notBrokenDown: { label: string; orders: number; taxableAmount: number; tax: number } | null;
  reconciles: boolean | null;
};

export type FinanceHealthCheck = {
  id: string;
  title: string;
  status: "pass" | "fail" | "info";
  expected: number | null;
  actual: number | null;
  difference: number | null;
  explanation: string | null;
};

export type FinanceHealth = { meta: FinanceMeta; passed: number; failed: number; ok: boolean; checks: FinanceHealthCheck[] };
