"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react"
import { useSaasAuth } from "@/contexts/saas-auth-context"

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
      // Navigation handled in signup function
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
          <h1 className="text-2xl font-bold text-gray-900">Start Your Free Trial</h1>
          <p className="text-sm text-gray-600 mt-2">Get 10 days of free access with no credit card</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-sm font-medium">
              Company Name
            </Label>
            <Input
              id="companyName"
              name="companyName"
              type="text"
              placeholder="Your Company"
              value={formData.companyName}
              onChange={handleInputChange}
              className={`h-10 ${errors.companyName ? "border-red-500 focus:border-red-500" : ""}`}
              disabled={loading}
            />
            {errors.companyName && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.companyName}
              </p>
            )}
          </div>

          {/* Owner Full Name */}
          <div className="space-y-2">
            <Label htmlFor="ownerFullName" className="text-sm font-medium">
              Your Full Name
            </Label>
            <Input
              id="ownerFullName"
              name="ownerFullName"
              type="text"
              placeholder="John Doe"
              value={formData.ownerFullName}
              onChange={handleInputChange}
              className={`h-10 ${errors.ownerFullName ? "border-red-500" : ""}`}
              disabled={loading}
            />
            {errors.ownerFullName && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.ownerFullName}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={handleInputChange}
              className={`h-10 ${errors.email ? "border-red-500" : ""}`}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone Number
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={handleInputChange}
              className={`h-10 ${errors.phone ? "border-red-500" : ""}`}
              disabled={loading}
            />
            {errors.phone && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.phone}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter a strong password"
                value={formData.password}
                onChange={handleInputChange}
                className={`h-10 pr-10 ${errors.password ? "border-red-500" : ""}`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {formData.password && strength.level > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      strength.level === 1
                        ? "w-1/4 bg-red-500"
                        : strength.level === 2
                          ? "w-2/4 bg-yellow-500"
                          : strength.level === 3
                            ? "w-3/4 bg-blue-500"
                            : "w-full bg-green-500"
                    }`}
                  />
                </div>
                <span className={strength.color}>{strength.text}</span>
              </div>
            )}
            {errors.password && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`h-10 pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {!errors.confirmPassword && formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-green-600 text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Passwords match
              </p>
            )}
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Server Error */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {serverError}
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked)
                if (errors.terms) {
                  setErrors((prev) => ({ ...prev, terms: "" }))
                }
              }}
              className="mt-1 w-4 h-4 accent-emerald-600 rounded"
              disabled={loading}
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              I agree to the{" "}
              <a href="/terms" className="text-emerald-600 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-emerald-600 hover:underline">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.terms && (
            <p className="text-red-600 text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.terms}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Start 10-Day Free Trial"}
          </Button>

          <div className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <a href="/auth/login" className="text-emerald-600 hover:underline font-medium">
              Sign In
            </a>
          </div>

          <div className="border-t pt-5 text-center text-xs text-gray-500">
            <p className="mb-2">✓ No credit card required</p>
            <p>✓ 10 days of free access</p>
            <p>✓ Cancel anytime</p>
          </div>
        </form>
      </Card>
    </div>
  )
}
