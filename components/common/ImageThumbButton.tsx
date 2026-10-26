"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageThumbButtonProps extends Omit<React.ComponentProps<typeof Button>, "children" | "variant" | "size"> {
  src: string
  alt?: string
  selected?: boolean
  /** Classes for the `<img>` (e.g. `object-contain p-2`). Defaults to `object-cover`. */
  imgClassName?: string
  onImageError?: React.ReactEventHandler<HTMLImageElement>
}

/** Outline Button showing an image thumbnail; `selected` adds a ring + aria-pressed. Size via `className` (e.g. `size-20`). */
export function ImageThumbButton({ src, alt = "", selected, imgClassName, onImageError, className, ...props }: ImageThumbButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      className={cn("h-16 w-16 shrink-0 overflow-hidden p-0", selected && "border-primary ring-2 ring-primary/30", className)}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={onImageError} className={cn("size-full object-cover", imgClassName)} />
    </Button>
  )
}
