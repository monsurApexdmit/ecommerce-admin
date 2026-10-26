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

export default function ResetPasswordPage() {
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
    if (passwordStrength < 40) return "Weak"
    if (passwordStrength < 70) return "Medium"
    return "Strong"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      setError("Invalid or missing reset token")
      return
    }

    if (!password || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
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
          "Failed to reset password. The link may have expired."
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
            <h1 className="text-2xl font-bold">Invalid Reset Link</h1>
            <p className="text-muted-foreground mt-2">
              This password reset link is invalid or has expired.
            </p>
          </div>

          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              <p>
                💡 <strong>What to do:</strong> Password reset links expire after 1 hour. Request a new reset
                link to continue.
              </p>
            </AlertDescription>
          </Alert>

          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">Request New Reset Link</Link>
          </Button>

          <div className="mt-4">
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
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
            <h1 className="text-2xl font-bold">Password Reset</h1>
            <p className="text-muted-foreground mt-2">Your password has been successfully reset.</p>
          </div>

          <Alert className="mb-6">
            <AlertDescription>
              <p>
                ✅ <strong>Success:</strong> You can now sign in with your new password. Redirecting to
                login page...
              </p>
            </AlertDescription>
          </Alert>

          <Button asChild className="w-full">
            <Link href="/auth/login">Go to Login</Link>
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
              Back to Login
            </Link>
          </Button>

          <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
          <p className="text-muted-foreground">Create a new password for your account.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField label="New Password" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Password Strength</span>
                  <span className="text-xs font-medium text-muted-foreground">{getPasswordStrengthLabel()}</span>
                </div>
                <Progress
                  value={passwordStrength}
                  aria-label="Password strength"
                  className={cn("bg-muted", getPasswordStrengthColor())}
                />
              </div>
            )}
          </FormField>

          <FormField label="Confirm Password" htmlFor="confirmPassword">
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {password && confirmPassword && password === confirmPassword && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                ✓ Passwords match
              </p>
            )}
          </FormField>

          <Alert>
            <AlertDescription className="text-xs">
              <p>🔒 <strong>Password Requirements:</strong></p>
              <ul className="mt-2 space-y-1">
                <li>• At least 8 characters long</li>
                <li>• Mix of uppercase and lowercase letters</li>
                <li>• At least one number</li>
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
                Resetting...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Reset Password
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
      </Card>
    </div>
  )
}
