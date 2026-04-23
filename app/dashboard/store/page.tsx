"use client"

import Link from "next/link"
import { MapPin, Settings, Heart } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function OnlineStorePage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Store Settings</h1>
        <p className="text-gray-600 mt-1">Manage your store configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/store/locations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-emerald-100 hover:border-emerald-300">
            <CardHeader>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
                <MapPin className="w-6 h-6 text-emerald-600" />
              </div>
              <CardTitle>Locations</CardTitle>
              <CardDescription>
                Manage your warehouses and physical stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-emerald-600 font-medium">Manage Locations &rarr;</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/store/wishlist">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-rose-100 hover:border-rose-300">
            <CardHeader>
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center mb-2">
                <Heart className="w-6 h-6 text-rose-600" />
              </div>
              <CardTitle>Wishlist Analytics</CardTitle>
              <CardDescription>
                Most-wanted products and customer wishlist activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-rose-600 font-medium">View Analytics &rarr;</span>
            </CardContent>
          </Card>
        </Link>

        <Card className="opacity-50 h-full">
          <CardHeader>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
              <Settings className="w-6 h-6 text-gray-500" />
            </div>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Store details, timezones, and formats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-gray-400 font-medium">Coming Soon</span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
