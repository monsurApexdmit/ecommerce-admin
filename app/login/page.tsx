"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormField } from "@/components/common/FormField"
import { Card } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"
import { saasAuthApi } from "@/lib/saasAuthApi"
import { WithTooltip } from "@/components/common/WithTooltip"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await saasAuthApi.login({ email, password })

      // Store auth data
      localStorage.setItem("token", response.data.token)
      localStorage.setItem("user_email", response.data.userEmail)
      localStorage.setItem("company_id", response.data.companyId.toString())
      localStorage.setItem("company_name", response.data.companyName)
      localStorage.setItem("user_role", response.data.userRole)

      // Store trial/subscription info
      if (response.data.trialDaysRemaining !== undefined) {
        localStorage.setItem("trial_days", response.data.trialDaysRemaining.toString())
      }
      if (response.data.subscriptionEndDate) {
        localStorage.setItem("subscription_end_date", response.data.subscriptionEndDate)
      }

      // Redirect to dashboard
      router.push("/dashboard")
    } catch (err: any) {
      const message = err.response?.data?.message || "Invalid email or password"
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Inventory Admin</h1>
          <p className="text-sm text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              placeholder="admin@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Password" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
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
          </FormField>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Demo credentials:</p>
            <p className="font-mono text-xs mt-1">jane.smith@startup.io / StartupPass123!</p>
          </div>
        </form>
      </Card>
    </div>
  )
}
