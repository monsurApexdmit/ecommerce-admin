"use client"

import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlanGateProps {
  moduleName?: string
  requiredPlan?: string
}

export function PlanGate({ moduleName, requiredPlan }: PlanGateProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {moduleName ? `${moduleName} — Plan Upgrade Required` : "Upgrade Required"}
      </h2>
      <p className="text-gray-500 max-w-sm mb-6">
        {requiredPlan
          ? `This feature is available on the ${requiredPlan} plan and above.`
          : "This feature is not included in your current plan."}
        {" "}Upgrade to unlock it.
      </p>
      <Button
        className="bg-emerald-600 hover:bg-emerald-700"
        onClick={() => router.push("/dashboard/billing/plans")}
      >
        View Plans & Upgrade
      </Button>
    </div>
  )
}
