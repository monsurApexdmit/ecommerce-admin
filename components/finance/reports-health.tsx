"use client"

import { CheckCircle2, Info, XCircle } from "lucide-react"
import type { HealthResult } from "@/lib/financeApi"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { useFinanceFormat } from "./finance-ui"

/** "addedValue" → "Added value". */
const humanise = (k: string) => {
  const t = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const STATUS = {
  pass: { label: "Pass", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", variant: "secondary" as const },
  fail: { label: "Fail", icon: XCircle, cls: "text-destructive", variant: "destructive" as const },
  info: { label: "Explained", icon: Info, cls: "text-amber-600", variant: "outline" as const },
}

/** Reconciliation checks R2–R11 (GET /finance/health) for the selected period and channel. */
export function HealthChecks({ report }: { report: HealthResult }) {
  const f = useFinanceFormat()
  const isCount = (k: string) => /count|orders|lines|products|parties/i.test(k)
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Checks passed" value={<span className="text-emerald-600 dark:text-emerald-400">{report.passed}</span>} hint={`of ${report.checks.length}`} />
        <StatTile label="Checks failed" value={<span className={report.failed ? "text-destructive" : ""}>{report.failed}</span>} hint={report.failed ? "Figures disagree between pages — see below" : "Every page agrees"} />
        <StatTile label="Overall" value={report.ok ? "Books tie out" : "Needs a look"} hint={report.context.period?.label ? `${report.context.period.label} · ${report.context.channelLabel}` : report.context.channelLabel} />
      </section>
      <SectionCard title="Health checks" description="Cross-page checks that catch figures disagreeing between Overview, Payments, Transactions, Receivables, Inventory and Reports.">
        <ul className="flex flex-col divide-y">
          {report.checks.map((c) => {
            const s = STATUS[(c.status as keyof typeof STATUS)] ?? STATUS.info
            const Icon = s.icon
            const numbers = Object.entries(c.numbers)
            return (
              <li key={c.id} className="flex gap-3 py-3">
                <Icon className={cn("mt-0.5 size-5 flex-none", s.cls)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{c.id}</span>
                    <span className="font-medium">{c.title}</span>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                  {c.explanation && <p className="mt-1 text-sm text-muted-foreground">{c.explanation}</p>}
                  {(c.expected != null || c.actual != null || numbers.length > 0) && (
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {c.expected != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Expected</dt><dd className="tabular-nums">{f.money(c.expected)}</dd></div>}
                      {c.actual != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Actual</dt><dd className="tabular-nums">{f.money(c.actual)}</dd></div>}
                      {c.difference != null && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Difference</dt><dd className={cn("tabular-nums", Math.abs(c.difference) >= 0.005 && c.status === "fail" && "text-destructive")}>{f.money(c.difference)}</dd></div>}
                      {numbers.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{humanise(k)}</dt><dd className="tabular-nums">{isCount(k) ? f.number(v) : f.money(v)}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            )
          })}
          {report.checks.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No checks returned.</li>}
        </ul>
      </SectionCard>
    </div>
  )
}
