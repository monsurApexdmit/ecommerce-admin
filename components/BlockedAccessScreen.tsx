"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { SectionTitle } from "@/components/common/SectionTitle"
import { AlertCircle, Mail } from "lucide-react"
import Link from "next/link"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { Trans, useTranslation } from "react-i18next"

interface BlockedAccessScreenProps {
  reason?: "trial_expired" | "subscription_expired" | "account_suspended"
}

const SUPPORT_EMAIL = "support@company.com"
const HELP_URL = "https://help.company.com"

export function BlockedAccessScreen({ reason = "trial_expired" }: BlockedAccessScreenProps) {
  const { logout } = useSaasAuth()
  const { t } = useTranslation(["ui", "common"])

  const getContent = () => {
    switch (reason) {
      case "trial_expired":
        return {
          icon: "🎯",
          title: t("ui:blocked.trialTitle"),
          message: t("ui:blocked.trialMessage"),
          primaryButton: { label: t("ui:blocked.viewPlans"), href: "/dashboard/billing/plans" },
          secondaryButton: { label: t("ui:blocked.contactSupport"), href: `mailto:${SUPPORT_EMAIL}` },
          steps: [t("ui:blocked.trialStep1"), t("ui:blocked.trialStep2"), t("ui:blocked.trialStep3")],
        }
      case "subscription_expired":
        return {
          icon: "📅",
          title: t("ui:blocked.subTitle"),
          message: t("ui:blocked.subMessage"),
          primaryButton: { label: t("ui:blocked.renew"), href: "/dashboard/billing/subscriptions" },
          secondaryButton: { label: t("ui:blocked.viewPlans"), href: "/dashboard/billing/plans" },
          steps: [t("ui:blocked.subStep1"), t("ui:blocked.subStep2"), t("ui:blocked.subStep3")],
        }
      case "account_suspended":
        return {
          icon: "🚫",
          title: t("ui:blocked.suspendedTitle"),
          message: t("ui:blocked.suspendedMessage"),
          primaryButton: { label: t("ui:blocked.contactSupport"), href: `mailto:${SUPPORT_EMAIL}` },
          secondaryButton: { label: t("ui:blocked.helpCenter"), href: HELP_URL },
          steps: [t("ui:blocked.suspendedStep1"), t("ui:blocked.suspendedStep2"), t("ui:blocked.suspendedStep3")],
        }
      default:
        return {
          icon: "⚠️",
          title: t("ui:blocked.deniedTitle"),
          message: t("ui:blocked.deniedMessage"),
          primaryButton: { label: t("ui:blocked.goBack"), href: "/" },
          secondaryButton: { label: t("ui:blocked.contactSupport"), href: `mailto:${SUPPORT_EMAIL}` },
          steps: [] as string[],
        }
    }
  }

  const content = getContent()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md py-0">
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-6">{content.icon}</div>

          {/* Alert Icon */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">{content.title}</h1>

          {/* Message */}
          <p className="text-muted-foreground text-sm mb-6">{content.message}</p>

          {/* Features List */}
          <Card className="gap-0 p-4 mb-6 text-left shadow-none bg-muted/50">
            <SectionTitle as="p" className="mb-2">{t("ui:blocked.todo")}</SectionTitle>
            <ul className="text-xs text-muted-foreground space-y-1">
              {content.steps.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ul>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href={content.primaryButton.href}>
                {content.primaryButton.label}
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href={content.secondaryButton.href}>
                {content.secondaryButton.label}
              </Link>
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={logout}
            >
              {t("ui:blocked.signOut")}
            </Button>
          </div>

          {/* Support Info */}
          <Separator className="mt-6" />
          <div className="pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mb-2">
              <Mail className="w-4 h-4" />
              <span>{t("ui:blocked.needHelp")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              <Trans
                t={t}
                i18nKey="ui:blocked.emailUs"
                values={{ email: SUPPORT_EMAIL }}
                components={{ a: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline font-medium" /> }}
              />
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <Trans
                t={t}
                i18nKey="ui:blocked.visitHelp"
                components={{ a: <a href={HELP_URL} className="text-primary hover:underline font-medium" /> }}
              />
            </p>
          </div>

          {/* Additional Info */}
          <Alert className="mt-6 text-left">
            <AlertDescription className="text-xs">
              <p>
                <Trans t={t} i18nKey="ui:blocked.didYouKnow" components={{ b: <strong className="text-foreground" /> }} />
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </Card>
    </div>
  )
}
