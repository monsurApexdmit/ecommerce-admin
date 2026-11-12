"use client"

import { cn } from "@/lib/utils"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { FormField } from "@/components/common/FormField"
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Trans, useTranslation } from "react-i18next"

// Validation messages are kept as keys and translated at render, so they follow a language switch
const ERR = {
  companyName: "auth:signup.errors.companyName",
  ownerName: "auth:signup.errors.ownerName",
  emailRequired: "auth:signup.errors.emailRequired",
  emailInvalid: "auth:signup.errors.emailInvalid",
  passwordRequired: "auth:signup.errors.passwordRequired",
  passwordMin: "auth:signup.errors.passwordMin",
  mismatch: "auth:password.mismatch",
  phone: "auth:signup.errors.phone",
  terms: "auth:signup.errors.terms",
} as const
type ErrKey = (typeof ERR)[keyof typeof ERR]

const STRENGTH = [
  { text: null, color: "" },
  { text: "auth:password.weak", color: "text-red-600" },
  { text: "auth:password.fair", color: "text-yellow-600" },
  { text: "auth:password.good", color: "text-blue-600" },
  { text: "auth:password.strong", color: "text-green-600" },
] as const

export default function SignupPage() {
  const { t } = useTranslation(["auth", "common"])
  const router = useRouter()
  const { signup } = useSaasAuth()

  const [formData, setFormData] = useState({
    companyName: "",
    ownerFullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  })

  const [errors, setErrors] = useState<Partial<Record<string, ErrKey>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<string, ErrKey>> = {}

    if (!formData.companyName.trim()) {
      newErrors.companyName = ERR.companyName
    }

    if (!formData.ownerFullName.trim()) {
      newErrors.ownerFullName = ERR.ownerName
    }

    if (!formData.email.trim()) {
      newErrors.email = ERR.emailRequired
    } else if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = ERR.emailInvalid
    }

    if (!formData.password) {
      newErrors.password = ERR.passwordRequired
    } else if (formData.password.length < 8) {
      newErrors.password = ERR.passwordMin
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = ERR.mismatch
    }

    if (!formData.phone.trim()) {
      newErrors.phone = ERR.phone
    }

    if (!agreedToTerms) {
      newErrors.terms = ERR.terms
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      await signup({
        companyName: formData.companyName,
        ownerFullName: formData.ownerFullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
      })
      // Account created (unverified). Show the verify-email screen instead of
      // redirecting to the dashboard — the user logs in after verifying.
      setSignupSuccess(true)
      setLoading(false)
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || t("auth:signup.failed")
      setServerError(errorMessage)
      setLoading(false)
    }
  }

  /** Translated validation message for a field, if any */
  const err = (field: string) => {
    const key = errors[field]
    return key ? t(key) : undefined
  }

  const passwordStrength = () => {
    if (!formData.password) return { level: 0, ...STRENGTH[0] }

    let strength = 0
    if (formData.password.length >= 8) strength++
    if (formData.password.match(/[a-z]/) && formData.password.match(/[A-Z]/)) strength++
    if (formData.password.match(/[0-9]/)) strength++
    if (formData.password.match(/[^a-zA-Z0-9]/)) strength++

    return { level: strength, ...STRENGTH[strength] }
  }

  const strength = passwordStrength()

  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="w-full max-w-lg p-8 shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6 mx-auto">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">{t("auth:signup.success.title")}</h1>
          <p className="text-sm text-muted-foreground mt-3">
            <Trans
              t={t}
              i18nKey="auth:signup.success.sent"
              values={{ email: formData.email }}
              components={{ b: <span className="font-medium text-foreground" /> }}
            />
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("auth:signup.success.next")}
          </p>
          <Button
            className="w-full mt-8"
            onClick={() => router.push("/auth/login")}
          >
            {t("auth:login.goToLogin")}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-lg p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">{t("auth:signup.title")}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t("auth:signup.subtitle")}</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          {/* Company Name */}
          <FormField label={t("auth:signup.companyName")} htmlFor="companyName" error={err("companyName")}>
            <Input
              id="companyName"
              name="companyName"
              type="text"
              placeholder={t("auth:signup.companyNamePlaceholder")}
              value={formData.companyName}
              onChange={handleInputChange}
              aria-invalid={errors.companyName ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Owner Full Name */}
          <FormField label={t("auth:signup.fullName")} htmlFor="ownerFullName" error={err("ownerFullName")}>
            <Input
              id="ownerFullName"
              name="ownerFullName"
              type="text"
              placeholder={t("auth:signup.fullNamePlaceholder")}
              value={formData.ownerFullName}
              onChange={handleInputChange}
              aria-invalid={errors.ownerFullName ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Email */}
          <FormField label={t("auth:login.emailAddress")} htmlFor="email" error={err("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={handleInputChange}
              aria-invalid={errors.email ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Phone */}
          <FormField label={t("auth:signup.phone")} htmlFor="phone" error={err("phone")}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder={t("auth:signup.phonePlaceholder")}
              value={formData.phone}
              onChange={handleInputChange}
              aria-invalid={errors.phone ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Password */}
          <FormField label={t("auth:login.password")} htmlFor="password" error={err("password")}>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth:signup.passwordPlaceholder")}
                value={formData.password}
                onChange={handleInputChange}
                className="pr-10"
                aria-invalid={errors.password ? true : undefined}
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
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </Button></WithTooltip>
            </div>
            {formData.password && strength.level > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Progress
                  value={strength.level * 25}
                  aria-label={t("auth:password.strength")}
                  className={cn("flex-1 bg-muted", strength.level === 1
                      ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                      : strength.level === 2
                        ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                        : strength.level === 3
                          ? "[&>[data-slot=progress-indicator]]:bg-blue-500"
                          : "[&>[data-slot=progress-indicator]]:bg-green-500")}
                />
                <span className={strength.color}>{strength.text && t(strength.text)}</span>
              </div>
            )}
          </FormField>

          {/* Confirm Password */}
          <FormField label={t("auth:signup.confirmPassword")} htmlFor="confirmPassword" error={err("confirmPassword")}>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={t("auth:signup.confirmPasswordPlaceholder")}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="pr-10"
                aria-invalid={errors.confirmPassword ? true : undefined}
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
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </Button></WithTooltip>
            </div>
            {!errors.confirmPassword && formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-green-600 text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {t("auth:password.match")}
              </p>
            )}
          </FormField>

          {/* Server Error */}
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Terms & Conditions */}
          <FormField error={err("terms")}>
            <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(v) => {
                setAgreedToTerms(v === true)
                if (errors.terms) {
                  setErrors((prev) => ({ ...prev, terms: undefined }))
                }
              }}
              className="mt-1"
              disabled={loading}
            />
            <Label htmlFor="terms" className="block leading-normal font-normal">
              <Trans
                t={t}
                i18nKey="auth:signup.terms"
                components={{
                  terms: <a href="/terms" className="text-primary hover:underline" />,
                  privacy: <a href="/privacy" className="text-primary hover:underline" />,
                }}
              />
            </Label>
            </div>
          </FormField>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? t("auth:signup.submitting") : t("auth:signup.submit")}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {t("auth:signup.haveAccount")}{" "}
            <a href="/auth/login" className="text-primary hover:underline font-medium">
              {t("auth:login.signIn")}
            </a>
          </div>

          <Separator />
          <div className="text-center text-xs text-muted-foreground">
            <p className="mb-2">✓ {t("auth:signup.perks.noCard")}</p>
            <p>✓ {t("auth:signup.perks.trial")}</p>
            <p>✓ {t("auth:signup.perks.cancel")}</p>
          </div>
        </form>
      </Card>
    </div>
  )
}
