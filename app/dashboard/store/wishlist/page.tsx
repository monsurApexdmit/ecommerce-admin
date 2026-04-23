"use client"

import { useState, useEffect } from "react"
import { Heart, Users, Package, TrendingUp, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCards } from "@/components/ui/stats-card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import wishlistApi, { type WishlistAnalytics } from "@/lib/wishlistApi"

function TrendBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className="bg-rose-400 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-6 text-right">{count}</span>
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export default function WishlistAnalyticsPage() {
  const [data, setData] = useState<WishlistAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    wishlistApi.getAnalytics()
      .then(setData)
      .catch(() => setError("Failed to load wishlist analytics"))
      .finally(() => setLoading(false))
  }, [])

  const maxProductCount = data?.topProducts[0]?.wishlistCount ?? 1
  const maxCustomerCount = data?.topCustomers[0]?.wishlistCount ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Wishlist Analytics</h1>
        <p className="text-gray-600 mt-1">Customer wishlist activity and most-wanted products</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data ? (
        <StatsCards stats={[
          {
            label: "Total Wishlist Items",
            value: data.summary.totalItems.toLocaleString(),
            icon: <Heart className="w-5 h-5" />,
            color: "red",
          },
          {
            label: "Customers with Wishlists",
            value: data.summary.uniqueCustomers.toLocaleString(),
            icon: <Users className="w-5 h-5" />,
            color: "blue",
          },
          {
            label: "Unique Products Wishlisted",
            value: data.summary.uniqueProducts.toLocaleString(),
            icon: <Package className="w-5 h-5" />,
            color: "purple",
          },
        ]} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="w-5 h-5 text-rose-500" />
              Most Wishlisted Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton />
            ) : data?.topProducts.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No wishlist data yet</p>
            ) : (
              <div className="space-y-3">
                {data?.topProducts.map((p, idx) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-5 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.categoryName && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {p.categoryName}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          ${Number(p.salePrice ?? p.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <TrendBar count={p.wishlistCount} max={maxProductCount} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-blue-500" />
              Most Active Wishlist Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton />
            ) : data?.topCustomers.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No wishlist data yet</p>
            ) : (
              <div className="space-y-3">
                {data?.topCustomers.map((c, idx) => (
                  <div key={c.customerId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-5 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    </div>
                    <TrendBar count={c.wishlistCount} max={maxCustomerCount} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 30-day trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Daily Wishlist Adds — Last 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : !data?.dailyTrend.length ? (
            <p className="text-gray-500 text-sm py-4 text-center">No activity in the last 30 days</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxCount = Math.max(...data.dailyTrend.map((d) => d.count), 1)
                return data.dailyTrend.map((d) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 shrink-0">{d.date}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-emerald-400 h-2 rounded-full transition-all"
                        style={{ width: `${Math.round((d.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-6 text-right">{d.count}</span>
                  </div>
                ))
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
