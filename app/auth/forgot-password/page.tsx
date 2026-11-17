"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/common/FormField"
import { saasAuthApi } from "@/lib/saasAuthApi"
import { AlertCircle, Mail, ArrowLeft } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"

export default function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "common"])
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setError(t("auth:login.emailRequired"))
      return
    }

    setLoading(true)
    setError("")

    try {
      await saasAuthApi.forgotPassword({ email })
      setSuccess(true)
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          t("auth:password.forgot.failed")
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth:password.forgot.sentTitle")}</h1>
            <p className="text-muted-foreground mt-2">
              <Trans t={t} i18nKey="auth:password.forgot.sentTo" values={{ email }} components={{ b: <strong /> }} />
            </p>
          </div>

          <Alert className="mb-6">
            <AlertDescription>
              <p>
                💡 <Trans t={t} i18nKey="auth:password.forgot.tip" components={{ b: <strong /> }} />
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">{t("auth:password.forgot.nextTitle")}</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>{t("auth:password.forgot.step1")}</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>{t("auth:password.forgot.step2")}</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>{t("auth:password.forgot.step3")}</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">4.</span>
                  <span>{t("auth:password.forgot.step4")}</span>
                </li>
              </ol>
            </div>

            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                <Trans
                  t={t}
                  i18nKey="auth:password.forgot.notReceived"
                  components={{
                    retry: (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setSuccess(false)}
                        className="h-auto p-0"
                      />
                    ),
                  }}
                />
              </p>

              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">
                  <ArrowLeft className="w-4 h-4" />
                  {t("auth:login.backToLogin")}
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8">
          <Button asChild variant="link" className="mb-6 px-0">
            <Link href="/auth/login">
              <ArrowLeft className="w-4 h-4" />
              {t("auth:login.backToLogin")}
            </Link>
          </Button>

          <h1 className="text-3xl font-bold mb-2">{t("auth:password.forgot.title")}</h1>
          <p className="text-muted-foreground">
            {t("auth:password.forgot.subtitle")}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField label={t("auth:login.emailAddress")} htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth:password.forgot.emailPlaceholder")}
              disabled={loading}
            />
          </FormField>

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner />
                {t("auth:password.forgot.sending")}
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                {t("auth:password.forgot.send")}
              </>
            )}
          </Button>
        </form>

        <Separator className="mt-6" />
        <div className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            {t("auth:login.rememberPassword")}{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              {t("auth:login.signInHere")}
            </Link>
          </p>
        </div>

        {/* Security Note */}
        <Alert className="mt-6">
          <AlertDescription className="text-xs">
            <p>
              🔒 <Trans t={t} i18nKey="auth:password.forgot.security" components={{ b: <strong /> }} />
            </p>
          </AlertDescription>
        </Alert>
      </Card>
    </div>
  )
}
