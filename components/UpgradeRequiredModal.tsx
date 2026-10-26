"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface UpgradeRequiredModalProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  limitType?: "products" | "users" | "warehouses"
  currentLimit?: number
  suggestedPlan?: string
}

/**
 * Modal component displayed when a user tries to exceed their plan limits
 * Shows what limit they've hit and provides a CTA to upgrade
 */
export function UpgradeRequiredModal({
  open,
  onOpenChange,
  title = "Upgrade Required",
  description = "You've reached the limit for your current plan.",
  limitType = "products",
  currentLimit,
  suggestedPlan = "Professional",
}: UpgradeRequiredModalProps) {
  const router = useRouter()
  const [closing, setClosing] = useState(false)

  const getLimitMessage = () => {
    const messages = {
      products: `You've reached the ${currentLimit}-product limit on your current plan. Upgrade to Professional or Enterprise to add more.`,
      users: `You've reached the ${currentLimit}-user limit on your current plan. Upgrade to Professional or Enterprise to add more team members.`,
      warehouses: `You've reached the ${currentLimit}-warehouse limit on your current plan. Upgrade to Professional or Enterprise to manage multiple locations.`,
    }
    return messages[limitType]
  }

  const handleClose = () => {
    setClosing(true)
    onOpenChange?.(false)
    setClosing(false)
  }

  const handleUpgrade = () => {
    handleClose()
    router.push("/dashboard/billing/plans")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <DialogTitle>{title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-2">
            {getLimitMessage()}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTitle>Plan Comparison</AlertTitle>
          <AlertDescription className="space-y-2">
            {limitType === "products" && (
              <>
                <div>📦 Starter: 1,000 products</div>
                <div>📦 Professional: 10,000 products</div>
                <div>📦 Enterprise: Unlimited products</div>
              </>
            )}
            {limitType === "users" && (
              <>
                <div>👥 Starter: 2 team members</div>
                <div>👥 Professional: 5 team members</div>
                <div>👥 Enterprise: Unlimited team members</div>
              </>
            )}
            {limitType === "warehouses" && (
              <>
                <div>🏢 Starter: 1 warehouse</div>
                <div>🏢 Professional: 5 warehouses</div>
                <div>🏢 Enterprise: Unlimited warehouses</div>
              </>
            )}
          </AlertDescription>
        </Alert>

        <DialogFooter className="flex gap-3 justify-end pt-4">
          <Button variant="outline" onClick={handleClose}>
            Keep Current Plan
          </Button>
          <Button onClick={handleUpgrade}>
            Browse Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
