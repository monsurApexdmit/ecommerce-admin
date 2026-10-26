"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/** First letters of the first two words, uppercased ("Jane Doe" -> "JD"). */
export function getInitials(name?: string | null, max = 2): string {
  return (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, max).map((w) => w[0]!.toUpperCase()).join("") || "?"
}

interface UserAvatarProps extends React.ComponentProps<typeof Avatar> {
  src?: string | null
  /** Used for alt text and the initials fallback. */
  name?: string | null
  alt?: string
  /** Custom fallback (icon) instead of initials. */
  fallback?: React.ReactNode
  /** `square` for logos/product images. */
  shape?: "circle" | "square"
}

/** shadcn Avatar with image + initials fallback. Replaces raw avatar/logo `<img>` and initials circles. Size via `className` (e.g. `size-10`). */
export function UserAvatar({ src, name, alt, fallback, shape = "circle", className, ...props }: UserAvatarProps) {
  return (
    <Avatar className={cn(shape === "square" && "rounded-md", className)} {...props}>
      {src ? <AvatarImage src={src} alt={alt ?? name ?? ""} className="object-cover" /> : null}
      <AvatarFallback className={cn("text-xs font-medium", shape === "square" && "rounded-md")}>{fallback ?? getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
