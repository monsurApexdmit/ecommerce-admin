"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saasAuthApi } from "@/lib/saasAuthApi"
import { AlertCircle, CheckCircle, Loader, Mail, RefreshCw } from "lucide-react"

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
          <Loader className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Verifying your email…</h1>
          <p className="text-gray-500 text-sm mt-2">Please wait a moment.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Email Verified!</h1>
          <p className="text-gray-600 mt-2 text-sm">
            Your account is now active. Your 10-day free trial has started.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mt-4 text-sm text-emerald-800">
            Redirecting to dashboard…
          </div>
          <Button
            className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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
          <h1 className="text-2xl font-bold text-gray-900">Verification Failed</h1>
          <p className="text-gray-600 mt-2 text-sm">{error}</p>

          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={() => setState("resend")}
            >
              <RefreshCw className="w-4 h-4" />
              Resend Verification Email
            </Button>
            <Link href="/auth/login">
              <Button variant="ghost" className="w-full text-gray-600">
                Back to Login
              </Button>
            </Link>
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
          <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
          <p className="text-gray-600 text-sm mt-2">
            We sent a verification link to your email. Click the link to activate your account.
          </p>
        </div>

        {resendSent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-center">
            <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm text-emerald-800 font-medium">Verification email sent!</p>
            <p className="text-xs text-emerald-700 mt-1">Check your inbox and spam folder.</p>
          </div>
        ) : (
          <form onSubmit={handleResend} className="space-y-4">
            <p className="text-sm text-gray-500 text-center">
              Didn't receive it? Resend below.
            </p>
            <Input
              type="email"
              placeholder="your@email.com"
              value={resendEmail}
              onChange={(e) => {
                setResendEmail(e.target.value)
                setResendError("")
              }}
              className={`h-10 ${resendError ? "border-red-500" : ""}`}
              disabled={resendLoading}
            />
            {resendError && (
              <p className="text-red-600 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {resendError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={resendLoading}
            >
              {resendLoading ? (
                <span className="flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" /> Sending…
                </span>
              ) : (
                "Resend Verification Email"
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-sm text-emerald-600 hover:underline">
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  )
}
