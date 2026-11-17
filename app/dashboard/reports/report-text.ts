import type { ParseKeys, TFunction } from "i18next"

export const REPORTS_NS = ["commerce", "common"] as const
type ReportsNs = typeof REPORTS_NS
type ReportsT = TFunction<ReportsNs>
type ServerKey = Extract<ParseKeys<ReportsNs>, `commerce:reports.server.${string}`>

/**
 * The reports API (ReportService.php) sends its labels in English. Known fixed texts map to keys;
 * anything else (product, customer, supplier names…) is shown as sent.
 */
const EXACT: Record<string, ServerKey> = {
  "Revenue": "commerce:reports.server.revenue",
  "Invoice totals": "commerce:reports.server.invoiceTotals",
  "Orders": "commerce:reports.server.orders",
  "All paid": "commerce:reports.server.allPaid",
  "Avg. order value": "commerce:reports.server.avgOrderValue",
  "Revenue per order": "commerce:reports.server.revenuePerOrder",
  "Discounts": "commerce:reports.server.discounts",
  "Given in this period": "commerce:reports.server.givenInPeriod",
  "Tax collected": "commerce:reports.server.taxCollected",
  "Included in invoice totals": "commerce:reports.server.includedInTotals",
  "Gross profit": "commerce:reports.server.grossProfit",
  "No sales yet": "commerce:reports.server.noSalesYet",
  "Revenue per day": "commerce:reports.server.revenuePerDay",
  "Revenue per month": "commerce:reports.server.revenuePerMonth",
  "By payment method": "commerce:reports.server.byPaymentMethod",
  "By channel": "commerce:reports.server.byChannel",
  "Top 10 products by quantity": "commerce:reports.server.topByQty",
  "No products sold in this period.": "commerce:reports.server.noProductsSold",
  "Top 10 products by revenue": "commerce:reports.server.topByRevenue",
  "Top customers": "commerce:reports.server.topCustomers",
  "No customer sales in this period (walk-in sales are not listed).": "commerce:reports.server.noCustomerSales",
  "Product": "commerce:reports.server.product",
  "Qty sold": "commerce:reports.server.qtySold",
  "Customer": "commerce:reports.server.customer",
  "Due": "commerce:reports.server.due",
  "Revenue, profit and best sellers. Cancelled sales are excluded.": "commerce:reports.server.salesSubtitle",
  "Cash": "commerce:reports.server.cash",
  "Card": "commerce:reports.server.card",
  "Bank transfer": "commerce:reports.server.bankTransfer",
  "Cheque": "commerce:reports.server.cheque",
  "On account": "commerce:reports.server.onAccount",
  "COD": "commerce:reports.server.cod",
  "Online": "commerce:reports.server.online",
  "Other": "commerce:reports.server.other",
  "POS": "commerce:reports.server.pos",
  "Sales": "commerce:reports.server.sales",
  "Purchase orders": "commerce:reports.server.purchaseOrders",
  "Excluding cancelled": "commerce:reports.server.excludingCancelled",
  "Total value": "commerce:reports.server.totalValue",
  "No orders yet": "commerce:reports.server.noOrdersYet",
  "Paid": "commerce:reports.server.paid",
  "Due to suppliers": "commerce:reports.server.dueToSuppliers",
  "Unpaid balance": "commerce:reports.server.unpaidBalance",
  "All settled": "commerce:reports.server.allSettled",
  "Received": "commerce:reports.server.received",
  "Purchases per day": "commerce:reports.server.purchasesPerDay",
  "Purchases per month": "commerce:reports.server.purchasesPerMonth",
  "Status mix (orders)": "commerce:reports.server.statusMix",
  "Top suppliers by value": "commerce:reports.server.topSuppliers",
  "By supplier": "commerce:reports.server.bySupplier",
  "No purchase orders in this period.": "commerce:reports.server.noPurchaseOrders",
  "Supplier": "commerce:reports.server.supplier",
  "Total": "commerce:reports.server.total",
  "PO": "commerce:reports.server.po",
  "Date": "commerce:reports.server.date",
  "Status": "commerce:reports.server.status",
  "Draft": "commerce:reports.server.draft",
  "Ordered": "commerce:reports.server.ordered",
  "Cancelled": "commerce:reports.server.cancelled",
  "Partially received": "commerce:reports.server.partiallyReceived",
  "Unknown": "commerce:reports.server.unknown",
  "What was ordered from suppliers and how much is still owed.": "commerce:reports.server.purchasesSubtitle",
  "Units on hand": "commerce:reports.server.unitsOnHand",
  "Stock value (cost)": "commerce:reports.server.stockValueCost",
  "What it cost you": "commerce:reports.server.whatItCost",
  "Stock value (retail)": "commerce:reports.server.stockValueRetail",
  "At selling price": "commerce:reports.server.atSellingPrice",
  "Potential margin": "commerce:reports.server.potentialMargin",
  "Low stock": "commerce:reports.server.lowStock",
  "Stock is healthy": "commerce:reports.server.stockHealthy",
  "Out of stock": "commerce:reports.server.outOfStock",
  "Nothing is out": "commerce:reports.server.nothingOut",
  "Cost value by location": "commerce:reports.server.costByLocation",
  "Valuation by product and location": "commerce:reports.server.valuation",
  "No stock on hand yet.": "commerce:reports.server.noStock",
  "Location": "commerce:reports.server.location",
  "Qty": "commerce:reports.server.qty",
  "Cost value": "commerce:reports.server.costValue",
  "Retail value": "commerce:reports.server.retailValue",
  "SKU": "commerce:reports.server.sku",
  "On hand": "commerce:reports.server.onHand",
  "Reorder at": "commerce:reports.server.reorderAt",
  "No products are low on stock.": "commerce:reports.server.noLowStock",
  "Nothing is out of stock.": "commerce:reports.server.noOutOfStock",
  "Retail price": "commerce:reports.server.retailPrice",
  "Default": "commerce:reports.server.defaultLocation",
  "Current stock on hand valued at cost and at retail price. Not affected by the date range.": "commerce:reports.server.stockSubtitle",
  "Receivable": "commerce:reports.server.receivable",
  "Over 60 days": "commerce:reports.server.over60",
  "Receivable, needs chasing": "commerce:reports.server.receivableChase",
  "Payable": "commerce:reports.server.payable",
  "Payable, overdue": "commerce:reports.server.payableOverdue",
  "Net position": "commerce:reports.server.netPosition",
  "You are owed more than you owe": "commerce:reports.server.owedMore",
  "You owe more than you are owed": "commerce:reports.server.oweMore",
  "Receivable aging": "commerce:reports.server.receivableAging",
  "Payable aging": "commerce:reports.server.payableAging",
  "Receivables by customer": "commerce:reports.server.receivablesByCustomer",
  "No customer owes you anything.": "commerce:reports.server.noReceivables",
  "Total due": "commerce:reports.server.totalDue",
  "Payables by supplier": "commerce:reports.server.payablesBySupplier",
  "You do not owe any supplier.": "commerce:reports.server.noPayables",
  "Walk-in customers": "commerce:reports.server.walkIn",
  "0–30 days": "commerce:reports.server.age0",
  "31–60 days": "commerce:reports.server.age31",
  "61–90 days": "commerce:reports.server.age61",
  "90+ days": "commerce:reports.server.age90",
  "Open balances with customers and suppliers, aged from the document date. Not affected by the date range.": "commerce:reports.server.duesSubtitle",
  "Excluding tax": "commerce:reports.server.excludingTax",
  "Cost of goods": "commerce:reports.server.costOfGoods",
  "Cost of items sold": "commerce:reports.server.costOfItemsSold",
  "Expenses": "commerce:reports.server.expenses",
  "Net profit": "commerce:reports.server.netProfit",
  "Net profit per month": "commerce:reports.server.netProfitPerMonth",
  "Expenses by category": "commerce:reports.server.expensesByCategory",
  "Profit & loss by month": "commerce:reports.server.pnlByMonth",
  "No sales or expenses in this period.": "commerce:reports.server.noPnl",
  "Month": "commerce:reports.server.month",
  "COGS": "commerce:reports.server.cogs",
  "Margin": "commerce:reports.server.margin",
  "Uncategorised": "commerce:reports.server.uncategorised",
  "Revenue less cost of goods sold and recorded expenses, month by month.": "commerce:reports.server.pnlSubtitle",
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Translated text for an English label from the reports API; unknown text is returned unchanged. */
export function reportText(t: ReportsT, s: string, tag: string): string {
  if (!s) return s
  const key = EXACT[s]
  if (key) return t(key)
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d+) cancelled$/))) return t("commerce:reports.server.cancelledCount", { count: Number(m[1]) })
  if ((m = s.match(/^(-?\d+) not yet received$/))) return t("commerce:reports.server.notReceived", { count: Number(m[1]) })
  if ((m = s.match(/^(-?\d+%) of total$/))) return t("commerce:reports.server.pctOfTotal", { pct: m[1] })
  if ((m = s.match(/^(-?\d+%) of revenue$/))) return t("commerce:reports.server.pctOfRevenue", { pct: m[1] })
  if ((m = s.match(/^(-?\d+%) of retail$/))) return t("commerce:reports.server.pctOfRetail", { pct: m[1] })
  if ((m = s.match(/^(-?\d+%) net margin$/))) return t("commerce:reports.server.pctNetMargin", { pct: m[1] })
  if ((m = s.match(/^(-?\d+%) margin$/))) return t("commerce:reports.server.pctMargin", { pct: m[1] })
  if ((m = s.match(/^(\d+) products?$/))) return t("common:count.products", { count: Number(m[1]) })
  if ((m = s.match(/^(\d+) customers? owes? you$/))) return t("commerce:reports.server.customersOwe", { count: Number(m[1]) })
  if ((m = s.match(/^To (\d+) suppliers?$/))) return t("commerce:reports.server.toSuppliers", { count: Number(m[1]) })
  if ((m = s.match(/^(\d+) records?$/))) return t("commerce:reports.server.records", { count: Number(m[1]) })
  // Month labels: "Jan", "Jan 5", "Jan '25", "Jan 2026"
  if ((m = s.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( .+)?$/)) && tag !== "en-GB") {
    const month = new Date(2000, MONTHS.indexOf(m[1]), 1).toLocaleDateString(tag, { month: "short" })
    return month + (m[2] ?? "")
  }
  return s
}

/** KPI sub line built from [prefix, amount, suffix] (amount formatted by the caller). */
export function reportMoneySub(t: ReportsT, prefix: string, amount: string, suffix: string): string {
  if (!prefix && suffix === " still due") return t("commerce:reports.server.stillDue", { amount })
  if (prefix === "Avg " && !suffix) return t("commerce:reports.server.avg", { amount })
  return `${prefix}${amount}${suffix}`
}
