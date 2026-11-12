"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Trans, useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { StatusBadge } from "@/components/common/StatusBadge"
import { CheckCircle, Download, Home, Mail } from "lucide-react"
import Link from "next/link"

const FMT: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, i18n } = useTranslation(["account", "common"])
  const [loaded, setLoaded] = useState(false)

  const subscriptionId = searchParams.get("subscriptionId")
  const invoiceUrl = searchParams.get("invoiceUrl")

  useEffect(() => {
    setLoaded(true)
    // Auto-redirect to dashboard after 10 seconds if no action taken
    const timer = setTimeout(() => {
      if (!loaded) {
        router.push("/dashboard")
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [router, loaded])

  const handleDownloadInvoice = () => {
    if (invoiceUrl) {
      const decodedUrl = decodeURIComponent(invoiceUrl)
      window.open(decodedUrl, "_blank")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <div className="px-8 md:px-12 py-2 md:py-6">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <CheckCircle className="mx-auto mb-6 size-16 text-primary" />

            <h1 className="text-4xl font-bold mb-2">
              {t("account:billing.success.title")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t("account:billing.success.subtitle")}
            </p>
          </div>

          {/* Subscription Details */}
          <Card className="bg-muted/50 p-6 mb-8 shadow-none">
            <InfoList className="grid-cols-2 gap-6 md:gap-8">
              {/* Subscription ID */}
              <InfoRow layout="stacked" label={t("account:billing.success.subscriptionId")} value={<span className="text-xl font-bold font-mono">{subscriptionId || t("common:status.loading")}</span>} />

              {/* Status */}
              <InfoRow layout="stacked" label={t("common:fields.status")} value={<StatusBadge status="active" label={t("common:status.active")} />} />

              {/* Activation */}
              <InfoRow layout="stacked" label={t("account:billing.success.activated")} value={
                <span className="text-lg font-semibold">
                  {new Date().toLocaleDateString(localeTag(i18n.language), FMT)}
                </span>
              } />

              {/* Next Billing */}
              <InfoRow layout="stacked" label={t("account:billing.success.nextBilling")} value={
                <span className="text-lg font-semibold">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(localeTag(i18n.language), FMT)}
                </span>
              } />
            </InfoList>
          </Card>

          {/* What's Included */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">{t("account:billing.success.whatYouGet")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">{t("account:billing.success.fullAccess")}</p>
                  <p className="text-sm text-muted-foreground">{t("account:billing.success.fullAccessDesc")}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">{t("account:billing.success.prioritySupport")}</p>
                  <p className="text-sm text-muted-foreground">{t("account:billing.success.prioritySupportDesc")}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">{t("account:billing.success.teamMembers")}</p>
                  <p className="text-sm text-muted-foreground">{t("account:billing.success.teamMembersDesc")}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">{t("account:billing.success.analytics")}</p>
                  <p className="text-sm text-muted-foreground">{t("account:billing.success.analyticsDesc")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <Card className="p-6 mb-8 gap-3">
            <h3 className="font-bold">{t("account:billing.success.nextSteps")}</h3>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">1.</span>
                <span>{t("account:billing.success.step1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">2.</span>
                <span>{t("account:billing.success.step2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">3.</span>
                <span>{t("account:billing.success.step3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">4.</span>
                <span>{t("account:billing.success.step4")}</span>
              </li>
            </ol>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {/* Download Invoice */}
            <Button
              onClick={handleDownloadInvoice}
              disabled={!invoiceUrl}
            >
              <Download className="size-5" />
              {t("account:billing.success.downloadInvoice")}
            </Button>

            {/* Go to Dashboard */}
            <Button
              onClick={() => router.push("/dashboard")}
            >
              <Home className="size-5" />
              {t("account:billing.success.goToDashboard")}
            </Button>

            {/* View Subscription */}
            <Button
              onClick={() => router.push("/dashboard/billing/subscriptions")}
              variant="outline"
            >
              {t("account:billing.success.viewSubscription")}
            </Button>
          </div>

          {/* Email Confirmation */}
          <Alert>
            <Mail />
            <AlertTitle>{t("account:billing.success.emailSent")}</AlertTitle>
            <AlertDescription>
              {t("account:billing.success.emailSentDesc")}
            </AlertDescription>
          </Alert>

          {/* FAQ Section */}
          <Separator className="mt-8" />
          <div className="pt-8">
            <h3 className="font-bold mb-4">{t("account:billing.success.faqTitle")}</h3>

            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-1">{t("account:billing.success.q1")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account:billing.success.a1")}
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">{t("account:billing.success.q2")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account:billing.success.a2")}
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">{t("account:billing.success.q3")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account:billing.success.a3")}
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">{t("account:billing.success.q4")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("account:billing.success.a4")}
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">{t("account:billing.success.q5")}</p>
                <p className="text-sm text-muted-foreground">
                  <Trans
                    t={t}
                    i18nKey="account:billing.success.a5"
                    values={{ email: "support@company.com" }}
                    components={{
                      mail: <a href="mailto:support@company.com" className="text-primary hover:underline" />,
                      help: <a href="#" className="text-primary hover:underline" />,
                    }}
                  />
                </p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <Separator className="mt-8" />
          <div className="text-center text-sm text-muted-foreground pt-8">
            <p>
              {t("account:billing.success.thanks")}{" "}
              <Link href="/dashboard" className="text-primary hover:underline">
                {t("account:billing.success.startExploring")}
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
