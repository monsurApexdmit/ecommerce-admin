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
            <h1 className="text-2xl font-bold">Check Your Email</h1>
            <p className="text-muted-foreground mt-2">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>

          <Alert className="mb-6">
            <AlertDescription>
              <p>
                💡 <strong>Tip:</strong> If you don't see the email in a few minutes, check your spam
                or junk folder.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">What's next?</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>Check your email for the password reset link</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>Click the link to verify your email address</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>Create a new password and confirm it</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">4.</span>
                  <span>Sign in with your new password</span>
                </li>
              </ol>
            </div>

            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Didn't receive the email? You can{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setSuccess(false)}
                  className="h-auto p-0"
                >
                  try again
                </Button>
              </p>

              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
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
              Back to Login
            </Link>
          </Button>

          <h1 className="text-3xl font-bold mb-2">Forgot Password?</h1>
          <p className="text-muted-foreground">
            No worries, we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField label="Email Address" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>

        <Separator className="mt-6" />
        <div className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Remember your password?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Sign in here
            </Link>
          </p>
        </div>

        {/* Security Note */}
        <Alert className="mt-6">
          <AlertDescription className="text-xs">
            <p>
              🔒 <strong>Security:</strong> For your security, password reset links expire after 1 hour.
              If your link has expired, you can request a new one.
            </p>
          </AlertDescription>
        </Alert>
      </Card>
    </div>
  )
}
