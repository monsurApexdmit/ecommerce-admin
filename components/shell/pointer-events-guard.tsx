"use client"

import { useEffect } from "react"

const OPEN_LAYERS = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[data-radix-popper-content-wrapper] [data-state="open"]',
].join(",")

/**
 * G-4 safety net: Radix modal layers set `pointer-events: none` on <body> while open. When a Dialog is opened from a
 * menu (or two modal layers close in the same tick) the lock can survive the close, and the next click anywhere is
 * swallowed. If <body> is still locked shortly after the last open layer is gone, release it.
 */
export function PointerEventsGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (document.body.style.pointerEvents === "none" && !document.querySelector(OPEN_LAYERS)) {
          document.body.style.pointerEvents = ""
        }
      }, 350)
    }
    const obs = new MutationObserver(check)
    obs.observe(document.body, { attributes: true, attributeFilter: ["style"], childList: true })
    return () => { obs.disconnect(); if (timer) clearTimeout(timer) }
  }, [])
  return null
}
