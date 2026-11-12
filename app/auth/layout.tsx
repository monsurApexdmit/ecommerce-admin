"use client"

import type React from "react"
import { LanguageSwitcher } from "@/components/shell/language-switcher"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Logged-out visitors pick their language here (every /auth page) */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  )
}
