"use client"

import { Fragment, useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Category } from "@/contexts/category-context"
import { cn } from "@/lib/utils"

interface Row {
  category: Category
  depth: number
  /** "Baby & Kids › Baby Food" */
  path: string
}

const byName = (a: Category, b: Category) => a.category_name.localeCompare(b.category_name)

/** One group per top-level category: the parent first, then its children in order. Categories whose parent is missing become top level. */
function buildGroups(categories: Category[]): Row[][] {
  const unique = [...new Map(categories.map((c) => [c.id, c])).values()]
  const ids = new Set(unique.map((c) => c.id))
  const childrenOf = new Map<string, Category[]>()
  const roots: Category[] = []
  for (const c of unique) {
    if (c.parent_id !== null && ids.has(c.parent_id)) childrenOf.set(c.parent_id, [...(childrenOf.get(c.parent_id) ?? []), c])
    else roots.push(c)
  }
  const walk = (c: Category, depth: number, parentPath: string, rows: Row[]) => {
    const path = parentPath ? `${parentPath} › ${c.category_name}` : c.category_name
    rows.push({ category: c, depth, path })
    for (const child of (childrenOf.get(c.id) ?? []).sort(byName)) walk(child, depth + 1, path, rows)
    return rows
  }
  return roots.sort(byName).map((root) => walk(root, 0, "", []))
}

/** Searchable category select for long lists; search also matches the parent's name. `value` "" means no category. */
export function CategoryPicker({ categories, value, onChange, labelledBy }: {
  categories: Category[]
  value: string
  onChange: (id: string, name: string) => void
  labelledBy?: string
}) {
  const { t } = useTranslation(["products", "common"])
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => buildGroups(categories), [categories])
  const selected = useMemo(() => groups.flat().find((r) => r.category.id === value), [groups, value])
  const pick = (id: string, name: string) => { onChange(id, name); setOpen(false) }

  return (
    // `modal` keeps the list scrollable inside a Dialog, which otherwise blocks wheel events in portals
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-labelledby={labelledBy}
          title={selected?.path} className="w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.path ?? t("products:shared.noCategory")}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-[280px] p-0">
        <Command filter={(_, search, keywords) => (keywords?.join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={t("products:category.search")} />
          <CommandList>
            <CommandEmpty>{t("products:category.noneFound")}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="none" keywords={[t("products:shared.noCategory")]} onSelect={() => pick("", "")} className="text-muted-foreground">
                {t("products:shared.noCategory")}
                <Check className={cn("ml-auto size-4", value ? "opacity-0" : "opacity-100")} aria-hidden />
              </CommandItem>
            </CommandGroup>
            {groups.map((rows) => (
              <Fragment key={rows[0].category.id}>
                <CommandSeparator />
                <CommandGroup>
                  {rows.map(({ category: c, depth, path }) => (
                    <CommandItem key={c.id} value={c.id} keywords={[path]} onSelect={() => pick(c.id, c.category_name)}
                      style={{ paddingLeft: `${0.5 + depth}rem` }} className={cn(depth === 0 && "font-medium")}>
                      <span className="truncate">{c.category_name}</span>
                      {!c.status && <span className="shrink-0 text-xs font-normal text-muted-foreground">{t("common:status.inactive")}</span>}
                      <Check className={cn("ml-auto size-4", value === c.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
