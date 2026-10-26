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

export default function SignupPage() {
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

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required"
    }

    if (!formData.ownerFullName.trim()) {
      newErrors.ownerFullName = "Owner name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required"
    }

    if (!agreedToTerms) {
      newErrors.terms = "You must agree to the terms and conditions"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
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
        error.response?.data?.message || error.message || "Signup failed. Please try again."
      setServerError(errorMessage)
      setLoading(false)
    }
  }

  const passwordStrength = (): { level: number; text: string; color: string } => {
    if (!formData.password) return { level: 0, text: "", color: "" }

    let strength = 0
    if (formData.password.length >= 8) strength++
    if (formData.password.match(/[a-z]/) && formData.password.match(/[A-Z]/)) strength++
    if (formData.password.match(/[0-9]/)) strength++
    if (formData.password.match(/[^a-zA-Z0-9]/)) strength++

    const levels = [
      { text: "", color: "" },
      { text: "Weak", color: "text-red-600" },
      { text: "Fair", color: "text-yellow-600" },
      { text: "Good", color: "text-blue-600" },
      { text: "Strong", color: "text-green-600" },
    ]

    return { level: strength, ...levels[strength] }
  }

  const strength = passwordStrength()

  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="w-full max-w-lg p-8 shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6 mx-auto">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-3">
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">{formData.email}</span>.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Please verify your email to activate your account, then log in.
          </p>
          <Button
            className="w-full mt-8"
            onClick={() => router.push("/auth/login")}
          >
            Go to Login
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
          <h1 className="text-2xl font-bold">Start Your Free Trial</h1>
          <p className="text-sm text-muted-foreground mt-2">Get 10 days of free access with no credit card</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          {/* Company Name */}
          <FormField label="Company Name" htmlFor="companyName" error={errors.companyName || undefined}>
            <Input
              id="companyName"
              name="companyName"
              type="text"
              placeholder="Your Company"
              value={formData.companyName}
              onChange={handleInputChange}
              aria-invalid={errors.companyName ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Owner Full Name */}
          <FormField label="Your Full Name" htmlFor="ownerFullName" error={errors.ownerFullName || undefined}>
            <Input
              id="ownerFullName"
              name="ownerFullName"
              type="text"
              placeholder="John Doe"
              value={formData.ownerFullName}
              onChange={handleInputChange}
              aria-invalid={errors.ownerFullName ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Email */}
          <FormField label="Email Address" htmlFor="email" error={errors.email || undefined}>
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
          <FormField label="Phone Number" htmlFor="phone" error={errors.phone || undefined}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={handleInputChange}
              aria-invalid={errors.phone ? true : undefined}
              disabled={loading}
            />
          </FormField>

          {/* Password */}
          <FormField label="Password" htmlFor="password" error={errors.password || undefined}>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a strong password"
                value={formData.password}
                onChange={handleInputChange}
                className="pr-10"
                aria-invalid={errors.password ? true : undefined}
                disabled={loading}
              />
              <WithTooltip content={showPassword ? "Hide password" : "Show password"}><Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </Button></WithTooltip>
            </div>
            {formData.password && strength.level > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Progress
                  value={strength.level * 25}
                  aria-label="Password strength"
                  className={cn("flex-1 bg-muted", strength.level === 1
                      ? "[&>[data-slot=progress-indicator]]:bg-red-500"
                      : strength.level === 2
                        ? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
                        : strength.level === 3
                          ? "[&>[data-slot=progress-indicator]]:bg-blue-500"
                          : "[&>[data-slot=progress-indicator]]:bg-green-500")}
                />
                <span className={strength.color}>{strength.text}</span>
              </div>
            )}
          </FormField>

          {/* Confirm Password */}
          <FormField label="Confirm Password" htmlFor="confirmPassword" error={errors.confirmPassword || undefined}>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="pr-10"
                aria-invalid={errors.confirmPassword ? true : undefined}
                disabled={loading}
              />
              <WithTooltip content={showConfirmPassword ? "Hide password" : "Show password"}><Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </Button></WithTooltip>
            </div>
            {!errors.confirmPassword && formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-green-600 text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Passwords match
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
          <FormField error={errors.terms || undefined}>
            <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(v) => {
                setAgreedToTerms(v === true)
                if (errors.terms) {
                  setErrors((prev) => ({ ...prev, terms: "" }))
                }
              }}
              className="mt-1"
              disabled={loading}
            />
            <Label htmlFor="terms" className="block leading-normal font-normal">
              I agree to the{" "}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </Label>
            </div>
          </FormField>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Start 10-Day Free Trial"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/auth/login" className="text-primary hover:underline font-medium">
              Sign In
            </a>
          </div>

          <Separator />
          <div className="text-center text-xs text-muted-foreground">
            <p className="mb-2">✓ No credit card required</p>
            <p>✓ 10 days of free access</p>
            <p>✓ Cancel anytime</p>
          </div>
        </form>
      </Card>
    </div>
  )
}
