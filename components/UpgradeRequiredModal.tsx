"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
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
  title,
  description,
  limitType = "products",
  currentLimit,
  suggestedPlan = "Professional",
}: UpgradeRequiredModalProps) {
  const router = useRouter()
  const { t } = useTranslation(["ui", "common"])
  const [closing, setClosing] = useState(false)

  const getLimitMessage = () => {
    // Without a known limit, fall back to the caller's description (or the generic line)
    if (currentLimit == null) return description ?? t("ui:upgradeModal.description")
    const messages = {
      products: t("ui:upgradeModal.limitProducts", { limit: currentLimit }),
      users: t("ui:upgradeModal.limitUsers", { limit: currentLimit }),
      warehouses: t("ui:upgradeModal.limitWarehouses", { limit: currentLimit }),
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
              <DialogTitle>{title ?? t("ui:upgradeModal.title")}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="mt-2">
            {getLimitMessage()}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTitle>{t("ui:upgradeModal.comparison")}</AlertTitle>
          <AlertDescription className="space-y-2">
            {limitType === "products" && (
              <>
                <div>📦 {t("ui:upgradeModal.productsStarter")}</div>
                <div>📦 {t("ui:upgradeModal.productsPro")}</div>
                <div>📦 {t("ui:upgradeModal.productsEnterprise")}</div>
              </>
            )}
            {limitType === "users" && (
              <>
                <div>👥 {t("ui:upgradeModal.usersStarter")}</div>
                <div>👥 {t("ui:upgradeModal.usersPro")}</div>
                <div>👥 {t("ui:upgradeModal.usersEnterprise")}</div>
              </>
            )}
            {limitType === "warehouses" && (
              <>
                <div>🏢 {t("ui:upgradeModal.warehousesStarter")}</div>
                <div>🏢 {t("ui:upgradeModal.warehousesPro")}</div>
                <div>🏢 {t("ui:upgradeModal.warehousesEnterprise")}</div>
              </>
            )}
          </AlertDescription>
        </Alert>

        <DialogFooter className="flex gap-3 justify-end pt-4">
          <Button variant="outline" onClick={handleClose}>
            {t("ui:upgradeModal.keepPlan")}
          </Button>
          <Button onClick={handleUpgrade}>
            {t("ui:upgradeModal.browsePlans")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
