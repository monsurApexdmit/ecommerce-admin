"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/common/FormField"
import { saasAuthApi } from "@/lib/saasAuthApi"
import { AlertCircle, CheckCircle, Mail, RefreshCw } from "lucide-react"

type State = "verifying" | "success" | "error" | "resend"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [state, setState] = useState<State>(token ? "verifying" : "resend")
  const [error, setError] = useState("")
  const [resendEmail, setResendEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendError, setResendError] = useState("")

  useEffect(() => {
    if (!token) return

    let cancelled = false

    saasAuthApi
      .verifyEmail(token)
      .then((data) => {
        if (cancelled) return
        // Store token and redirect to dashboard
        if (data?.data?.token) {
          localStorage.setItem("saas_token", data.data.token)
        }
        setState("success")
        setTimeout(() => router.push("/dashboard"), 2500)
      })
      .catch((err: any) => {
        if (cancelled) return
        setError(
          err.response?.data?.message || "Verification failed. The link may have expired."
        )
        setState("error")
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail.trim()) {
      setResendError("Please enter your email address")
      return
    }
    setResendLoading(true)
    setResendError("")
    try {
      await saasAuthApi.resendVerificationEmail(resendEmail)
      setResendSent(true)
    } catch {
      setResendError("Failed to resend. Please try again.")
    } finally {
      setResendLoading(false)
    }
  }

  // ── Verifying ──────────────────────────────────────────────────────────────
  if (state === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="w-full max-w-md p-10 shadow-lg text-center">
          <Spinner className="size-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold">Verifying your email…</h1>
          <p className="text-muted-foreground text-sm mt-2">Please wait a moment.</p>
        </Card>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="w-full max-w-md p-10 shadow-lg text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Email Verified!</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your account is now active. Your 10-day free trial has started.
          </p>
          <Alert className="mt-4">
            <AlertDescription className="justify-items-center">Redirecting to dashboard…</AlertDescription>
          </Alert>
          <Button
            className="mt-6 w-full"
            onClick={() => router.push("/dashboard")}
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <Card className="w-full max-w-md p-10 shadow-lg text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold">Verification Failed</h1>
          <p className="text-muted-foreground mt-2 text-sm">{error}</p>

          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setState("resend")}
            >
              <RefreshCw className="w-4 h-4" />
              Resend Verification Email
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/auth/login">Back to Login</Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ── Resend (no token in URL) ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md p-10 shadow-lg">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Check Your Email</h1>
          <p className="text-muted-foreground text-sm mt-2">
            We sent a verification link to your email. Click the link to activate your account.
          </p>
        </div>

        {resendSent ? (
          <Alert>
            <CheckCircle />
            <AlertTitle>Verification email sent!</AlertTitle>
            <AlertDescription>Check your inbox and spam folder.</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleResend} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Didn't receive it? Resend below.
            </p>
            <FormField htmlFor="resend-email" error={resendError || undefined}>
            <Input
              id="resend-email"
              type="email"
              aria-label="Email address"
              placeholder="your@email.com"
              value={resendEmail}
              onChange={(e) => {
                setResendEmail(e.target.value)
                setResendError("")
              }}
              aria-invalid={resendError ? true : undefined}
              disabled={resendLoading}
            />
            </FormField>
            <Button
              type="submit"
              className="w-full"
              disabled={resendLoading}
            >
              {resendLoading ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Button asChild variant="link" size="sm">
            <Link href="/auth/login">Back to Login</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
