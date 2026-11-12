import { cn } from "@/lib/utils"
import type React from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist, Hind_Siliguri } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SaasAuthProvider } from "@/contexts/saas-auth-context"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/components/i18n-provider"
import { LANG_COOKIE, isLang } from "@/lib/i18n/config"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
// Bangla glyphs: Geist has none, so the browser falls back to this per character
const bangla = Hind_Siliguri({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--font-bangla" })

export const metadata: Metadata = {
  title: "Admin Dashboard with POS",
  description: "Admin dashboard for managing your e-commerce store",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛒</text></svg>",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛒</text></svg>",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛒</text></svg>",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const saved = (await cookies()).get(LANG_COOKIE)?.value
  const lang = isLang(saved) ? saved : "en"
  return (
    <html lang={lang} className={cn(geist.variable, bangla.variable, "font-sans")} suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        style={{ fontFamily: "var(--font-sans), var(--font-bangla), ui-sans-serif, system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <I18nProvider lang={lang}>
              <SaasAuthProvider>{children}</SaasAuthProvider>
            </I18nProvider>
          </TooltipProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
