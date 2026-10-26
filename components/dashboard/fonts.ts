import { Inter, Plus_Jakarta_Sans } from "next/font/google"

/** Headings, big numbers, brand name — matches the design foundation (theme.css). */
export const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display-ui",
  display: "swap",
})

/** Body copy and controls. */
export const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-ui",
  display: "swap",
})

// Existing pages import these names; they now point at the design-foundation fonts.
export const bricolage = displayFont
export const instrument = bodyFont
