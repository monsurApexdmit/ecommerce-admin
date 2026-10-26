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

const STATUS_ICON: Record<string, any> = {
  active:    CheckCircle2,
  trial:     Clock,
  inactive:  XCircle,
  suspended: XCircle,
}

export default function CompaniesPage() {
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
      setError("Failed to load companies")
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
      alert("Failed to update status")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Companies" description="All registered businesses on the platform." />

      {/* Filters */}
      <Toolbar>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or email…"
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
            <SelectItem value="__all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
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
          <EmptyState icon={Building2} title="No companies found" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          label={<><StatusIcon />{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</>}
                        />
                      </TableCell>
                      <TableCell>
                        {c.subscription?.planName ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{c.usersCount}</TableCell>
                      <TableCell>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/platform/companies/${c.id}`}>
                              <Eye /> View
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant={c.status === "inactive" || c.status === "suspended" ? "ghost" : "destructive"}
                            onClick={() => toggleStatus(c)}
                            disabled={togglingId === c.id}
                          >
                            {togglingId === c.id ? "…" : (c.status === "inactive" || c.status === "suspended" ? "Activate" : "Deactivate")}
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
            Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
              disabled={page === pagination.last_page}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
