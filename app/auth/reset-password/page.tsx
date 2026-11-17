"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/common/FormField"
import { saasAuthApi } from "@/lib/saasAuthApi"
import { AlertCircle, Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Trans, useTranslation } from "react-i18next"

export default function ResetPasswordPage() {
  const { t } = useTranslation(["auth", "common"])
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setInvalidToken(true)
    }
  }, [token])

  // Calculate password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0)
      return
    }

    let strength = 0
    if (password.length >= 8) strength += 25
    if (password.length >= 12) strength += 25
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25
    if (/\d/.test(password)) strength += 12.5
    if (/[!@#$%^&*]/.test(password)) strength += 12.5

    setPasswordStrength(Math.min(100, strength))
  }, [password])

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return "[&>[data-slot=progress-indicator]]:bg-red-500"
    if (passwordStrength < 70) return "[&>[data-slot=progress-indicator]]:bg-yellow-500"
    return "[&>[data-slot=progress-indicator]]:bg-emerald-500"
  }

  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 40) return t("auth:password.weak")
    if (passwordStrength < 70) return t("auth:password.medium")
    return t("auth:password.strong")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      setError(t("auth:password.reset.missingToken"))
      return
    }

    if (!password || !confirmPassword) {
      setError(t("auth:password.reset.fillAll"))
      return
    }

    if (password.length < 8) {
      setError(t("auth:password.reset.minLength"))
      return
    }

    if (password !== confirmPassword) {
      setError(t("auth:password.mismatch"))
      return
    }

    setLoading(true)
    setError("")

    try {
      await saasAuthApi.resetPassword({
        token,
        newPassword: password,
        confirmPassword,
      })
      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          t("auth:password.reset.failed")
      )
      if (err.response?.status === 400 || err.response?.status === 401) {
        setInvalidToken(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth:password.reset.invalidTitle")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("auth:password.reset.invalidText")}
            </p>
          </div>

          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              <p>
                💡 <Trans t={t} i18nKey="auth:password.reset.invalidHelp" components={{ b: <strong /> }} />
              </p>
            </AlertDescription>
          </Alert>

          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">{t("auth:password.reset.requestNew")}</Link>
          </Button>

          <div className="mt-4">
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">
                <ArrowLeft className="w-4 h-4" />
                {t("auth:login.backToLogin")}
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth:password.reset.doneTitle")}</h1>
            <p className="text-muted-foreground mt-2">{t("auth:password.reset.doneText")}</p>
          </div>

          <Alert className="mb-6">
            <AlertDescription>
              <p>
                ✅ <Trans t={t} i18nKey="auth:password.reset.doneHelp" components={{ b: <strong /> }} />
              </p>
            </AlertDescription>
          </Alert>

          <Button asChild className="w-full">
            <Link href="/auth/login">{t("auth:login.goToLogin")}</Link>
          </Button>
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

          <h1 className="text-3xl font-bold mb-2">{t("auth:password.reset.title")}</h1>
          <p className="text-muted-foreground">{t("auth:password.reset.subtitle")}</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField label={t("auth:password.reset.newPassword")} htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth:password.reset.newPlaceholder")}
                disabled={loading}
              />
              <WithTooltip content={showPassword ? t("auth:password.hide") : t("auth:password.show")}><Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("auth:password.hide") : t("auth:password.show")}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button></WithTooltip>
            </div>

            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{t("auth:password.strength")}</span>
                  <span className="text-xs font-medium text-muted-foreground">{getPasswordStrengthLabel()}</span>
                </div>
                <Progress
                  value={passwordStrength}
                  aria-label={t("auth:password.strength")}
                  className={cn("bg-muted", getPasswordStrengthColor())}
                />
              </div>
            )}
          </FormField>

          <FormField label={t("auth:signup.confirmPassword")} htmlFor="confirmPassword">
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("auth:password.reset.confirmPlaceholder")}
                disabled={loading}
              />
              <WithTooltip content={showConfirmPassword ? t("auth:password.hide") : t("auth:password.show")}><Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? t("auth:password.hide") : t("auth:password.show")}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button></WithTooltip>
            </div>

            {password && confirmPassword && password === confirmPassword && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                ✓ {t("auth:password.match")}
              </p>
            )}
          </FormField>

          <Alert>
            <AlertDescription className="text-xs">
              <p>🔒 <strong>{t("auth:password.reset.requirements")}</strong></p>
              <ul className="mt-2 space-y-1">
                <li>• {t("auth:password.reset.reqLength")}</li>
                <li>• {t("auth:password.reset.reqCase")}</li>
                <li>• {t("auth:password.reset.reqNumber")}</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button
            type="submit"
            disabled={loading || !password || !confirmPassword || password !== confirmPassword}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner />
                {t("auth:password.reset.submitting")}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {t("auth:password.reset.submit")}
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
      </Card>
    </div>
  )
}
