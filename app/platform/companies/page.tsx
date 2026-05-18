"use client"

import { useEffect, useState, useCallback } from "react"
import { platformApi, PlatformCompany } from "@/lib/platformApi"
import Link from "next/link"
import {
  Search, Loader, AlertCircle, Building2, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, XCircle, Eye,
} from "lucide-react"

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  inactive:  "bg-gray-100 text-gray-500 border-gray-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
}

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 text-sm mt-0.5">All registered businesses on the platform.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader className="w-5 h-5 animate-spin text-emerald-600" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 p-6">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Building2 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No companies found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((c) => {
                  const StatusIcon = STATUS_ICON[c.status] ?? XCircle
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLE[c.status] ?? STATUS_STYLE.inactive}`}>
                          <StatusIcon className="w-3 h-3" />
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {c.subscription?.planName ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-gray-600">{c.usersCount}</td>
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/platform/companies/${c.id}`}
                            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </Link>
                          <button
                            onClick={() => toggleStatus(c)}
                            disabled={togglingId === c.id}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                              c.status === "inactive" || c.status === "suspended"
                                ? "text-emerald-700 hover:bg-emerald-50"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                          >
                            {togglingId === c.id ? "…" : (c.status === "inactive" || c.status === "suspended" ? "Activate" : "Deactivate")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
              disabled={page === pagination.last_page}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
