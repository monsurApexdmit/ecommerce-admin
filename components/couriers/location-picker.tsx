"use client"

import { useEffect, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FormField } from "@/components/common/FormField"
import { courierApi, courierError, type CourierLocation, type LocationType } from "@/lib/courierApi"
import { cn } from "@/lib/utils"
import { COURIER_NS } from "./i18n"

/** Searchable single select for a long list (Pathao cities / zones / areas). */
function LocationSelect({ id, options, value, onChange, loading, disabled, placeholder }: {
  id: string
  options: CourierLocation[]
  value: number | null
  onChange: (loc: CourierLocation) => void
  loading?: boolean
  disabled?: boolean
  placeholder: string
}) {
  const { t } = useTranslation(COURIER_NS)
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)
  return (
    // `modal` keeps the list scrollable inside a Dialog
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled || loading}
          className="w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading ? t("common:status.loading") : selected?.name ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-[220px] p-0">
        <Command filter={(_, search, keywords) => (keywords?.join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={t("courier:location.search")} />
          <CommandList>
            <CommandEmpty>{t("courier:location.noneFound")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={String(o.id)} keywords={[o.name]} onSelect={() => { onChange(o); setOpen(false) }}>
                  <span className="truncate">{o.name}</span>
                  <Check className={cn("ml-auto size-4", value === o.id ? "opacity-100" : "opacity-0")} aria-hidden />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export interface PathaoLocation {
  cityId: number | null
  cityName?: string
  zoneId: number | null
  zoneName?: string
  areaId: number | null
  areaName?: string
}

export const EMPTY_LOCATION: PathaoLocation = { cityId: null, zoneId: null, areaId: null }

/** Loads one level of Pathao locations for an account (the backend caches the lists). */
function useLocations(accountId: number | null, type: LocationType, parentId: number | null | undefined, enabled: boolean) {
  const [list, setList] = useState<CourierLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    setList([]); setError("")
    if (!enabled || !accountId || (type !== "city" && !parentId)) return
    let cancelled = false
    setLoading(true)
    courierApi.locations(accountId, type, parentId ?? undefined)
      .then((r) => { if (!cancelled) setList([...r].sort((a, b) => a.name.localeCompare(b.name))) })
      .catch((e) => { if (!cancelled) setError(courierError(e, "")) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [accountId, type, parentId, enabled])
  return { list, loading, error }
}

/** Pathao city → zone → area cascading pickers. Area is optional. */
export function PathaoLocationFields({ accountId, value, onChange, idPrefix = "pathao" }: {
  accountId: number | null
  value: PathaoLocation
  onChange: (v: PathaoLocation) => void
  idPrefix?: string
}) {
  const { t } = useTranslation(COURIER_NS)
  const cities = useLocations(accountId, "city", null, true)
  const zones = useLocations(accountId, "zone", value.cityId, !!value.cityId)
  const areas = useLocations(accountId, "area", value.zoneId, !!value.zoneId)
  const error = cities.error || zones.error || areas.error

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField label={t("courier:location.city")} htmlFor={`${idPrefix}-city`} className="min-w-0">
        <LocationSelect id={`${idPrefix}-city`} options={cities.list} value={value.cityId} loading={cities.loading}
          placeholder={t("courier:location.pickCity")}
          onChange={(c) => onChange({ cityId: c.id, cityName: c.name, zoneId: null, areaId: null })} />
      </FormField>
      <FormField label={t("courier:location.zone")} htmlFor={`${idPrefix}-zone`} className="min-w-0">
        <LocationSelect id={`${idPrefix}-zone`} options={zones.list} value={value.zoneId} loading={zones.loading} disabled={!value.cityId}
          placeholder={value.cityId ? t("courier:location.pickZone") : t("courier:location.cityFirst")}
          onChange={(z) => onChange({ ...value, zoneId: z.id, zoneName: z.name, areaId: null, areaName: undefined })} />
      </FormField>
      <FormField label={t("courier:location.area")} htmlFor={`${idPrefix}-area`} className="min-w-0">
        <LocationSelect id={`${idPrefix}-area`} options={areas.list} value={value.areaId} loading={areas.loading} disabled={!value.zoneId}
          placeholder={value.zoneId ? t("courier:location.pickArea") : t("courier:location.zoneFirst")}
          onChange={(a) => onChange({ ...value, areaId: a.id, areaName: a.name })} />
      </FormField>
      {error && <p className="text-sm text-destructive sm:col-span-3">{t("courier:location.loadFailed", { message: error })}</p>}
    </div>
  )
}
