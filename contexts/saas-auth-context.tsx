"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { saasAuthApi, type Company, type User } from "@/lib/saasAuthApi"
import { saasCompanyApi } from "@/lib/saasCompanyApi"

export interface SaasAuthContextType {
  // Auth state
  isAuthenticated: boolean
  user: User | null
  company: Company | null
  token: string | null

  // Company status
  companyStatus: "trial" | "active" | "expired" | "suspended"
  licenseKey: string | null
  licenseType: "trial" | "paid"

  // Trial info
  trialDaysRemaining: number | null
  trialEndDate: string | null

  // Subscription info
  subscriptionEndDate: string | null

  // Methods
  login: (email: string, password: string) => Promise<void>
  signup: (data: {
    companyName: string
    ownerFullName: string
    email: string
    password: string
    phone: string
  }) => Promise<void>
  logout: () => void
  refreshUserData: () => Promise<void>

  // Helper methods
  isTrialExpired: () => boolean
  isSubscriptionExpired: () => boolean
  canAccessFeature: (featureName: string) => boolean
  isOwner: () => boolean
  isAdmin: () => boolean
}

const SaasAuthContext = createContext<SaasAuthContextType>({
  isAuthenticated: false,
  user: null,
  company: null,
  token: null,
  companyStatus: "trial",
  licenseKey: null,
  licenseType: "trial",
  trialDaysRemaining: null,
  trialEndDate: null,
  subscriptionEndDate: null,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refreshUserData: async () => {},
  isTrialExpired: () => false,
  isSubscriptionExpired: () => false,
  canAccessFeature: () => false,
  isOwner: () => false,
  isAdmin: () => false,
})

export function SaasAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Initialize auth from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token")
      const storedCompanyId = localStorage.getItem("company_id")

      if (storedToken && storedCompanyId) {
        try {
          setToken(storedToken)
          const response = await saasAuthApi.getCurrentUser()
          setUser(response.data.user)
          setCompany(response.data.company)
          setIsAuthenticated(true)
        } catch (error) {
          // Token invalid or expired
          localStorage.removeItem("token")
          localStorage.removeItem("company_id")
          localStorage.removeItem("user_role")
          document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
          if (pathname?.startsWith("/dashboard")) {
            router.push("/auth/login")
          }
        }
      } else if (pathname?.startsWith("/dashboard")) {
        router.push("/auth/login")
      }

      setLoading(false)
    }

    initAuth()
  }, [pathname, router])

  const login = async (email: string, password: string) => {
    try {
      const response = await saasAuthApi.login({ email, password })

      // Store auth data
      localStorage.setItem("token", response.data.token)
      localStorage.setItem("company_id", response.data.companyId.toString())
      localStorage.setItem("user_role", response.data.userRole)
      // Set cookie for Next.js middleware
      document.cookie = `token=${response.data.token}; path=/; max-age=86400; SameSite=Lax`

      // Update state
      setToken(response.data.token)
      setIsAuthenticated(true)

      // Fetch full user data
      const userResponse = await saasAuthApi.getCurrentUser()
      setUser(userResponse.data.user)
      setCompany(userResponse.data.company)

      // Route based on company status
      if (response.data.companyStatus === "expired" || response.data.companyStatus === "suspended") {
        router.push("/billing/blocked-access")
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      throw error
    }
  }

  const signup = async (data: {
    companyName: string
    ownerFullName: string
    email: string
    password: string
    phone: string
  }) => {
    try {
      const response = await saasAuthApi.signup({
        companyName: data.companyName,
        ownerFullName: data.ownerFullName,
        email: data.email,
        password: data.password,
        phone: data.phone,
      })

      // Store auth data
      localStorage.setItem("token", response.data.token)
      localStorage.setItem("company_id", response.data.companyId.toString())
      localStorage.setItem("user_role", response.data.userRole)
      // Set cookie for Next.js middleware
      document.cookie = `token=${response.data.token}; path=/; max-age=86400; SameSite=Lax`

      // Update state
      setToken(response.data.token)
      setIsAuthenticated(true)

      // Create basic user and company objects (will be populated on next fetch)
      setUser({
        id: response.data.userId,
        companyId: response.data.companyId,
        email: response.data.userEmail,
        fullName: data.ownerFullName,
        role: "owner",
        status: "active",
        joinedDate: new Date().toISOString(),
      })

      setCompany({
        id: response.data.companyId,
        name: response.data.companyName,
        status: "trial",
        trialStartDate: response.data.trialStartDate,
        trialEndDate: response.data.trialEndDate,
        trialDaysRemaining: response.data.trialDaysRemaining,
        licenseKey: response.data.licenseKey,
        licenseType: "trial",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Redirect to dashboard
      router.push("/dashboard")
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await saasAuthApi.logout()
    } catch (error) {
      // Ignore logout error, still clear local state
    }

    localStorage.removeItem("token")
    localStorage.removeItem("company_id")
    localStorage.removeItem("user_role")
    localStorage.removeItem("trial_days")
    // Clear cookie for Next.js middleware
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"

    setIsAuthenticated(false)
    setUser(null)
    setCompany(null)
    setToken(null)

    router.push("/auth/login")
  }

  const refreshUserData = async () => {
    if (!isAuthenticated) return

    try {
      const response = await saasAuthApi.getCurrentUser()
      setUser(response.data.user)
      setCompany(response.data.company)
    } catch (error) {
      console.error("Failed to refresh user data:", error)
      if ((error as any).response?.status === 401) {
        logout()
      }
    }
  }

  const isTrialExpired = (): boolean => {
    if (!company || company.status !== "trial") return false
    return new Date(company.trialEndDate) < new Date()
  }

  const isSubscriptionExpired = (): boolean => {
    if (!company || company.status !== "active") return false
    if (!company.subscriptionEndDate) return false
    return new Date(company.subscriptionEndDate) < new Date()
  }

  const canAccessFeature = (featureName: string): boolean => {
    // Expired or suspended accounts cannot access any features
    if (company?.status === "expired" || company?.status === "suspended") {
      return false
    }

    // Trial and active accounts can access features based on their plan
    if (company?.status === "trial" || company?.status === "active") {
      // If plan features are available, check them
      if (company?.planFeatures && Array.isArray(company.planFeatures)) {
        return company.planFeatures.includes(featureName)
      }
      // If no plan features yet (shouldn't happen), allow access
      return true
    }

    return false
  }

  const isOwner = (): boolean => {
    return user?.role === "owner"
  }

  const isAdmin = (): boolean => {
    return user?.role === "owner" || user?.role === "admin"
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const value: SaasAuthContextType = {
    isAuthenticated,
    user,
    company,
    token,
    companyStatus: company?.status as any || "trial",
    licenseKey: company?.licenseKey || null,
    licenseType: company?.licenseType as any || "trial",
    trialDaysRemaining: company?.trialDaysRemaining || null,
    trialEndDate: company?.trialEndDate || null,
    subscriptionEndDate: company?.subscriptionEndDate || null,
    login,
    signup,
    logout,
    refreshUserData,
    isTrialExpired,
    isSubscriptionExpired,
    canAccessFeature,
    isOwner,
    isAdmin,
  }

  return <SaasAuthContext.Provider value={value}>{children}</SaasAuthContext.Provider>
}

export const useSaasAuth = () => {
  const context = useContext(SaasAuthContext)
  if (!context) {
    throw new Error("useSaasAuth must be used within SaasAuthProvider")
  }
  return context
}
