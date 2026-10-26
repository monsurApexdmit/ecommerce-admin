"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { Eye, EyeOff, AlertCircle } from "lucide-react"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { WithTooltip } from "@/components/common/WithTooltip"

export default function LoginPage() {
  const router = useRouter()
  const { login, pinLogin } = useSaasAuth()
  const [mode, setMode] = useState<"password" | "pin">("password")
  const [companyId, setCompanyId] = useState("")
  const [identifier, setIdentifier] = useState("")
  const [pin, setPin] = useState("")

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
      if (mode === "pin") {
        const cid = parseInt(companyId, 10)
        if (!cid || cid < 1) throw { local: "Enter a valid numeric Company ID." }
        if (!identifier.trim()) throw { local: "Enter your phone, email or staff ID." }
        if (!/^\d{4,6}$/.test(pin)) throw { local: "PIN must be 4 to 6 digits." }
        await pinLogin(cid, identifier.trim(), pin)
        try { localStorage.setItem("last_pin_company_id", String(cid)) } catch {}
        return
      }
      await login(email, password)
      // Navigation is handled in login function
    } catch (err: any) {
      const status = err.response?.status
      let errorMessage: string
      if (err.local) errorMessage = err.local
      else if (mode === "pin" && status === 401) errorMessage = err.response?.data?.message || "Incorrect PIN or staff details."
      else if (mode === "pin" && status === 422) errorMessage = err.response?.data?.message || "Invalid details. PIN must be 4 to 6 digits."
      else if (mode === "pin" && (status === 429 || status === 423)) errorMessage = err.response?.data?.message || "Too many failed attempts. Try again in 15 minutes."
      else errorMessage =
        err.response?.data?.message ||
        err.response?.data?.errors?.email?.[0] ||
        "Login failed. Please check your credentials."

      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
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
          <h1 className="text-2xl font-bold">SAAS Inventory</h1>
          <p className="text-sm text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <SegmentedControl
          aria-label="Sign-in method"
          size="default"
          className="mb-6 w-full"
          value={mode}
          onValueChange={(v) => {
            const m = v as "password" | "pin"
            setMode(m)
            setError("")
            if (m === "pin" && !companyId) {
              try { setCompanyId(localStorage.getItem("last_pin_company_id") || "") } catch {}
            }
          }}
          options={[
            { value: "password", label: "Email & Password" },
            { value: "pin", label: "Staff PIN" },
          ]}
        />

        <form onSubmit={handleLogin} className="space-y-6">
          {mode === "pin" ? (
            <>
              <FormField label="Company ID" htmlFor="companyId" description={<>Ask your manager for your company&apos;s numeric ID.</>}>
                <Input
                  id="companyId"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 12"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value.replace(/\D/g, ""))}
                  required
                  disabled={loading}
                />
              </FormField>
              <FormField label="Phone, Email or Staff ID" htmlFor="identifier">
                <Input
                  id="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={loading}
                />
              </FormField>
              <FormField label="PIN" htmlFor="pin">
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="4-6 digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="tracking-widest"
                  disabled={loading}
                />
              </FormField>
            </>
          ) : (
          <>
          <FormField label="Email Address" htmlFor="email">
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </FormField>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                Password
              </Label>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <a href="/auth/forgot-password">Forgot?</a>
              </Button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
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
          </div>
          </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <Separator />
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Don't have an account?{" "}
              <a href="/auth/signup" className="text-primary hover:underline font-medium">
                Start Free Trial
              </a>
            </p>
          </div>
        </form>
      </Card>
    </div>
  )
}
