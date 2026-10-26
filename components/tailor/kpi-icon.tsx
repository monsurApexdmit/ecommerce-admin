import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, Layers, Package, PackageCheck, Scissors, ShoppingBag, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react"

const ICONS: [RegExp, LucideIcon][] = [
  [/overdue/i, AlertTriangle], [/due this week|due soon/i, CalendarClock], [/ready/i, Package], [/deliver/i, PackageCheck],
  [/dorji/i, Users], [/open|pieces|stitch/i, Scissors], [/fabric|stock/i, Layers], [/owe|unpaid|balance|commission/i, Wallet],
  [/revenue|income|collected|sales|value/i, TrendingUp], [/order/i, ShoppingBag], [/average|avg/i, BarChart3],
]

/** Glyph for a tailor KPI tile, chosen from its label. */
export function KpiIcon({ label, className = "size-4" }: { label: string; className?: string }) {
  const Icon = ICONS.find(([re]) => re.test(label))?.[1] ?? CheckCircle2
  return <Icon className={className} aria-hidden />
}
