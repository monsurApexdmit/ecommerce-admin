"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

interface AuthContextType {
  isAuthenticated: boolean
  userEmail: string | null
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userEmail: null,
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    const email = localStorage.getItem("user_email")

    if (token) {
      setIsAuthenticated(true)
      setUserEmail(email)
    } else if (pathname?.startsWith("/dashboard")) {
      router.push("/login")
    }

    setLoading(false)
  }, [pathname, router])

  const logout = () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_email")
    setIsAuthenticated(false)
    setUserEmail(null)
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return <AuthContext.Provider value={{ isAuthenticated, userEmail, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
