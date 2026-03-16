"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saasAuthApi } from "@/lib/saasAuthApi"
import { AlertCircle, Loader, Mail, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setError("Please enter your email address")
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
          "Failed to send reset email. Please try again."
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
            <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
            <p className="text-gray-600 mt-2">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 mb-6">
            <p className="text-sm text-emerald-900">
              💡 <strong>Tip:</strong> If you don't see the email in a few minutes, check your spam
              or junk folder.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">What's next?</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-600">1.</span>
                  <span>Check your email for the password reset link</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-600">2.</span>
                  <span>Click the link to verify your email address</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-600">3.</span>
                  <span>Create a new password and confirm it</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-600">4.</span>
                  <span>Sign in with your new password</span>
                </li>
              </ol>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-4">
                Didn't receive the email? You can{" "}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  try again
                </button>
              </p>

              <Link href="/auth/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
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
          <Link href="/auth/login" className="text-emerald-600 hover:text-emerald-700 flex items-center gap-2 mb-6 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
          <p className="text-gray-600">
            No worries, we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600 text-center">
            Remember your password?{" "}
            <Link href="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign in here
            </Link>
          </p>
        </div>

        {/* Security Note */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-xs text-blue-900">
            🔒 <strong>Security:</strong> For your security, password reset links expire after 1 hour.
            If your link has expired, you can request a new one.
          </p>
        </div>
      </Card>
    </div>
  )
}
