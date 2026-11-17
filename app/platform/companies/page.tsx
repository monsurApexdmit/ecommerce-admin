"use client"

import { useEffect, useState, useCallback } from "react"
import { platformApi, PlatformCompany } from "@/lib/platformApi"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/common/PageHeader"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Toolbar } from "@/components/common/Toolbar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Search, AlertCircle, Building2, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, XCircle, Eye,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"

const STATUS_LABEL: Record<string, "auth:platform.status.active" | "auth:platform.status.trial" | "auth:platform.status.inactive" | "auth:platform.status.suspended"> = {
  active:    "auth:platform.status.active",
  trial:     "auth:platform.status.trial",
  inactive:  "auth:platform.status.inactive",
  suspended: "auth:platform.status.suspended",
}

const STATUS_ICON: Record<string, any> = {
  active:    CheckCircle2,
  trial:     Clock,
  inactive:  XCircle,
  suspended: XCircle,
}

export default function CompaniesPage() {
  const { t, i18n } = useTranslation(["auth", "common"])
  const [companies, setCompanies] = useState<PlatformCompany[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await platformApi.listCompanies({
        search: search || undefined,
        status: statusFilter || undefined,
        per_page: 15,
        page,
      })
      setCompanies(res.data)
      setPagination(res.pagination)
    } catch {
      setError(t("auth:platform.companies.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { load() }, [load])

  const toggleStatus = async (company: PlatformCompany) => {
    const next = company.status === "inactive" || company.status === "suspended" ? "active" : "inactive"
    setTogglingId(company.id)
    try {
      await platformApi.updateCompanyStatus(company.id, next)
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: next } : c))
    } catch {
      alert(t("auth:platform.companies.updateFailed"))
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title={t("auth:platform.companies.title")} description={t("auth:platform.companies.description")} />

      {/* Filters */}
      <Toolbar>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("auth:platform.companies.searchPlaceholder")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 w-72"
          />
        </div>
        <Select
          value={statusFilter || "__all"}
          onValueChange={v => { setStatusFilter(v === "__all" ? "" : v); setPage(1) }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("auth:platform.status.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("auth:platform.status.active")}</SelectItem>
            <SelectItem value="trial">{t("auth:platform.status.trial")}</SelectItem>
            <SelectItem value="inactive">{t("auth:platform.status.inactive")}</SelectItem>
            <SelectItem value="suspended">{t("auth:platform.status.suspended")}</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>

      {/* Table */}
      <Card className="gap-0 overflow-hidden py-0">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner className="size-5" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-4 w-auto">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : companies.length === 0 ? (
          <EmptyState icon={Building2} title={t("auth:platform.companies.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("auth:platform.companies.company")}</TableHead>
                  <TableHead>{t("common:fields.status")}</TableHead>
                  <TableHead>{t("auth:platform.companies.plan")}</TableHead>
                  <TableHead>{t("auth:platform.companies.users")}</TableHead>
                  <TableHead>{t("auth:platform.companies.joined")}</TableHead>
                  <TableHead className="text-right">{t("common:fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => {
                  const StatusIcon = STATUS_ICON[c.status] ?? XCircle
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={c.status}
                          label={<><StatusIcon />{STATUS_LABEL[c.status] ? t(STATUS_LABEL[c.status]) : c.status.charAt(0).toUpperCase() + c.status.slice(1)}</>}
                        />
                      </TableCell>
                      <TableCell>
                        {c.subscription?.planName ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{c.usersCount}</TableCell>
                      <TableCell>
                        {new Date(c.createdAt).toLocaleDateString(localeTag(i18n.language))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/platform/companies/${c.id}`}>
                              <Eye /> {t("common:actions.view")}
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant={c.status === "inactive" || c.status === "suspended" ? "ghost" : "destructive"}
                            onClick={() => toggleStatus(c)}
                            disabled={togglingId === c.id}
                          >
                            {togglingId === c.id ? "…" : (c.status === "inactive" || c.status === "suspended" ? t("auth:platform.companies.activate") : t("auth:platform.companies.deactivate"))}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {t("common:table.showing", { from: ((page - 1) * 15) + 1, to: Math.min(page * 15, pagination.total), total: pagination.total })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" /> {t("common:actions.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
              disabled={page === pagination.last_page}
            >
              {t("common:actions.next")} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
