"use client"

import { useCallback, useEffect, useState } from "react"
import { courierApi, type CourierAccount } from "@/lib/courierApi"

/** The account to preselect: the default one, else the first. */
export const defaultAccount = (list: CourierAccount[]) => list.find((a) => a.isDefault) ?? list[0] ?? null

/** Courier accounts that can book parcels (active + configured), loaded once `enabled` turns true (e.g. when a dialog opens). */
export function useBookableCouriers(enabled = true) {
  const [accounts, setAccounts] = useState<CourierAccount[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      setAccounts(await courierApi.accounts())
      setLoaded(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (enabled && !loaded && !loading && !error) reload() }, [enabled, loaded, loading, error, reload])

  return { accounts, loaded, loading: loading || (enabled && !loaded && !error), error, reload }
}
