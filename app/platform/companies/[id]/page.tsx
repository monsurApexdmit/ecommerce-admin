"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { platformApi, PlatformCompany, PlatformPlan } from "@/lib/platformApi"
import Link from "next/link"
import {
  ArrowLeft, Loader, AlertCircle, Users, CreditCard, CheckCircle2,
  Clock, XCircle, Calendar, Globe, Phone, Mail,
} from "lucide-react"

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  inactive:  "bg-gray-100 text-gray-500 border-gray-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  unverified:"bg-blue-50 text-blue-600 border-blue-200",
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const companyId = parseInt(id)

  const [company, setCompany] = useState<PlatformCompany | null>(null)
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedPlanId, setSelectedPlanId] = useState<number | "">("")
  const [selectedMonths, setSelectedMonths] = useState(1)
  const [assigning, setAssigning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [actionMsg, setActionMsg] = useState("")
  const [subdomain, setSubdomain] = useState("")
  const [savingSubdomain, setSavingSubdomain] = useState(false)

  useEffect(() => {
    Promise.all([
      platformApi.getCompany(companyId),
      platformApi.listPlans(),
    ]).then(([c, p]) => {
      setCompany(c)
      setSubdomain(c.subdomain ?? "")
      setPlans(p)
    }).catch(() => setError("Failed to load company"))
      .finally(() => setLoading(false))
  }, [companyId])

  const flash = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(""), 3000)
  }

  const handleAssign = async () => {
    if (!selectedPlanId) return
    setAssigning(true)
    try {
      const sub = await platformApi.assignSubscription(companyId, Number(selectedPlanId), selectedMonths)
      setCompany(prev => prev ? { ...prev, status: "active", subscription: sub } : prev)
      setSelectedPlanId("")
      flash("Subscription assigned successfully.")
    } catch {
      flash("Failed to assign subscription.")
    } finally {
      setAssigning(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm("Cancel this company's subscription?")) return
    setCancelling(true)
    try {
      await platformApi.cancelSubscription(companyId)
      setCompany(prev => prev ? { ...prev, subscription: prev.subscription ? { ...prev.subscription, status: "cancelled" } : null } : prev)
      flash("Subscription cancelled.")
    } catch {
      flash("Failed to cancel subscription.")
    } finally {
      setCancelling(false)
    }
  }

  const handleSaveSubdomain = async () => {
    setSavingSubdomain(true)
    try {
      const updated = await platformApi.updateCompany(companyId, { subdomain: subdomain.trim() || undefined })
      setCompany(prev => prev ? { ...prev, subdomain: updated.subdomain } : prev)
      flash("Store subdomain saved.")
    } catch {
      flash("Failed to save subdomain.")
    } finally {
      setSavingSubdomain(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!company) return
    const next = company.status === "inactive" || company.status === "suspended" ? "active" : "inactive"
    if (!confirm(`${next === "inactive" ? "Deactivate" : "Activate"} this company?`)) return
    setToggling(true)
    try {
      await platformApi.updateCompanyStatus(companyId, next)
      setCompany(prev => prev ? { ...prev, status: next } : prev)
      flash(`Company ${next === "active" ? "activated" : "deactivated"}.`)
    } catch {
      flash("Failed to update status.")
    } finally {
      setToggling(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 animate-spin text-emerald-600" /></div>
  )
  if (error || !company) return (
    <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-xl">
      <AlertCircle className="w-5 h-5" /> {error || "Company not found"}
    </div>
  )

  const activeSub = company.subscription?.status === "active" ? company.subscription : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/platform/companies" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Companies
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLE[company.status] ?? STATUS_STYLE.inactive}`}>
          {company.status}
        </span>
      </div>

      {actionMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Company Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Mail, label: "Email", value: company.email },
                { icon: Phone, label: "Phone", value: company.phone },
                { icon: Globe, label: "Country", value: company.country },
                { icon: Calendar, label: "Joined", value: new Date(company.createdAt).toLocaleDateString() },
                { icon: Users, label: "Team Size", value: `${company.usersCount} users` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Store subdomain */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Aura Store Subdomain</h2>
            <p className="text-xs text-gray-400 mb-4">Used to route <code className="bg-gray-100 px-1 rounded">subdomain.yourstore.com</code> to this company's store.</p>
            <div className="flex gap-2 items-center">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-1">
                <input
                  type="text"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g. acme"
                  className="flex-1 px-3 py-2 text-sm outline-none bg-white"
                />
                <span className="px-3 py-2 bg-gray-50 text-gray-400 text-xs border-l border-gray-200">.localhost:8080</span>
              </div>
              <button
                onClick={handleSaveSubdomain}
                disabled={savingSubdomain}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {savingSubdomain ? "Saving…" : "Save"}
              </button>
            </div>
            {company.subdomain && (
              <p className="mt-2 text-xs text-gray-500">
                Current: <code className="bg-gray-100 px-1 rounded text-emerald-700">{company.subdomain}.localhost:8080</code>
                {" — add "}<code className="bg-gray-100 px-1 rounded">127.0.0.1 {company.subdomain}.localhost</code>{" to /etc/hosts"}
              </p>
            )}
          </div>

          {/* Users table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Team Members</h2>
              <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{company.users?.length ?? 0}</span>
            </div>
            {!company.users?.length ? (
              <div className="text-center py-10 text-gray-400 text-sm">No users found</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase">Name</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase">Role</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase">Status</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {company.users!.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{u.fullName}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full capitalize">{u.role}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[u.status] ?? STATUS_STYLE.inactive}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Subscription card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Subscription</h2>
            </div>
            {activeSub ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Plan</span>
                  <span className="text-sm font-semibold text-gray-900">{activeSub.planName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Price</span>
                  <span className="text-sm text-gray-700">${activeSub.planPrice}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Expires</span>
                  <span className="text-sm text-gray-700">
                    {activeSub.currentPeriodEnd ? new Date(activeSub.currentPeriodEnd).toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-3 w-full text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 rounded-lg py-2 transition-colors"
                >
                  {cancelling ? "Cancelling…" : "Cancel Subscription"}
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-3">No active subscription</p>
              </div>
            )}
          </div>

          {/* Assign plan */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">
              {activeSub ? "Change Plan" : "Assign Plan"}
            </h2>
            <div className="space-y-3">
              <select
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(Number(e.target.value) || "")}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select a plan…</option>
                {plans.filter(p => p.isActive).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-16">Months</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={selectedMonths}
                  onChange={e => setSelectedMonths(parseInt(e.target.value) || 1)}
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleAssign}
                disabled={!selectedPlanId || assigning}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40"
              >
                {assigning ? "Assigning…" : activeSub ? "Change Plan" : "Assign & Activate"}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-xl border border-red-100 p-5">
            <h2 className="font-semibold text-red-700 mb-3 text-sm">Danger Zone</h2>
            <button
              onClick={handleToggleStatus}
              disabled={toggling}
              className={`w-full text-sm font-medium py-2.5 rounded-lg transition-colors ${
                company.status === "inactive" || company.status === "suspended"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "border border-red-300 text-red-600 hover:bg-red-50"
              }`}
            >
              {toggling ? "Updating…" : (company.status === "inactive" || company.status === "suspended" ? "Activate Company" : "Deactivate Company")}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              {company.status === "inactive" || company.status === "suspended"
                ? "Re-enables all users of this company."
                : "Blocks all users from logging in."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
