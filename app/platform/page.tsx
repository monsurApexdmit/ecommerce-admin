"use client"

import { useEffect, useState } from "react"
import { Building2, Users, CreditCard, TrendingUp, AlertCircle, Loader } from "lucide-react"
import { platformApi, PlatformStats } from "@/lib/platformApi"
import Link from "next/link"

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: any; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default function PlatformOverview() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    platformApi.getStats()
      .then(setStats)
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader className="w-6 h-6 animate-spin text-emerald-600" />
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-xl">
      <AlertCircle className="w-5 h-5" /> {error}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 text-sm mt-1">All companies and subscriptions across StockFlow.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Companies" value={stats!.totalCompanies} icon={Building2} color="bg-blue-50 text-blue-600" />
        <StatCard label="Active Companies" value={stats!.activeCompanies} sub={`${stats!.trialCompanies} on trial`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Users" value={stats!.totalUsers} icon={Users} color="bg-purple-50 text-purple-600" />
        <StatCard label="Monthly Revenue" value={`$${stats!.mrr.toFixed(2)}`} sub={`${stats!.activeSubscriptions} active subs`} icon={CreditCard} color="bg-orange-50 text-orange-600" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Link href="/platform/companies" className="block bg-white border border-gray-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Manage Companies</h3>
          </div>
          <p className="text-sm text-gray-500">View all companies, assign plans, activate or deactivate accounts.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{stats!.activeCompanies} active</span>
            <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">{stats!.trialCompanies} trial</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{stats!.inactiveCompanies} inactive</span>
          </div>
        </Link>

        <Link href="/platform/plans" className="block bg-white border border-gray-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Manage Plans</h3>
          </div>
          <p className="text-sm text-gray-500">Create, edit and toggle subscription plans. Changes reflect immediately on the signup page.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{stats!.activePlans} active plans</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{stats!.totalPlans} total</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{stats!.activeSubscriptions} paid subscriptions</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
