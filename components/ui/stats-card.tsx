"use client"

import { Card } from "@/components/ui/card"
import { ReactNode } from "react"

interface StatItem {
  label: string
  value: number | string
  icon?: ReactNode
  color?: "blue" | "green" | "yellow" | "red" | "purple"
}

interface StatsCardsProps {
  stats: StatItem[]
}

const colorClasses = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, idx) => (
        <Card key={idx} className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              {stat.icon && (
                <div className={`p-2.5 rounded-lg ${colorClasses[stat.color || "blue"]}`}>
                  {stat.icon}
                </div>
              )}
            </div>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
