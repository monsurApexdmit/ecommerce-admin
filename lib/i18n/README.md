# Admin translations (i18next)

Languages: English (`en`, default/fallback) and Bangla (`bn`). Each staff member picks one in the
top bar (`components/shell/language-switcher.tsx`); it is stored in the `admin-lang` cookie, which the
root layout reads so the server renders the right language with no flash.

## Files

```
lib/i18n/
  index.ts            createI18n(), LANGUAGES, rememberLanguage(), localeTag()
  resources.ts        lists every namespace for both languages
  i18next.d.ts        typed keys: an unknown key fails `tsc`
  locales/en/<ns>.ts  English source strings (plain object, default export)
  locales/bn/<ns>.ts  Bangla, typed Messages<typeof en> so keys must match
components/i18n-provider.tsx   wraps the app (app/layout.tsx)
```

Namespaces: `common` (shared actions, statuses, fields, money, table, time, extra, ago), `nav` (sidebar, header,
breadcrumbs, global search), `dashboard`, `pos`, `orders`, `products`, `ui` (shared components), `print`
(invoice/packing slip), `tailor`, `finance`, `inventory` (suppliers, returns, stock, shipments), `store`
(online store, settings, company), `account` (billing, team, staff, profile, notifications), `catalog`
(collections, attributes, categories, brands, units, pages), `commerce` (coupons, marketing, reports,
support, shipping/payment methods, international, checkout), `customers` (customers, expenses, dues),
`auth` (login, sign-up, landing, platform, public tracking), `courier` (Pathao / Steadfast integration: setup, booking, courier status).

## Rules

1. Client components only (`"use client"`). List every namespace the component uses:
   `const { t, i18n } = useTranslation(["pos", "common"])`. Without the list, prefixed keys fail `tsc`.
2. **Always prefix the namespace**: `t("pos:cart.title")`, `t("common:actions.save")`. `tsc` rejects unknown keys.
3. Reuse `common` before adding a key; add to `common` only for text shared by several screens.
4. Nest keys by component: `cart.title`, `payment.received`.
5. Interpolation `t("common:table.pageOf", { page, pages })` with `{{page}}`; never concatenate translated pieces.
6. Plurals: `key_one` / `key_other`, called with `{ count }`.
7. Markup inside a sentence: `<Trans i18nKey="..." components={{ b: <strong /> }} />`.
8. Module-level constants (label maps, option arrays, column defs) hold **keys**, translated at render.
9. Dates: `toLocaleDateString(localeTag(i18n.language), …)`. Leave `formatCurrency` alone.
10. Do **not** translate data: product/customer/category names, API messages, SKUs, invoice numbers.
11. Translate `aria-label`, `placeholder`, `title`, tooltip text, toasts and validation messages too.
12. Bangla: short, natural business Bangla used by Bangladeshi shop software (e.g. "বিক্রি", "অর্ডার",
    "স্টক", "গ্রাহক", "নগদ", "বাকি"). Common English loanwords (POS, SKU, অর্ডার, ক্যাটাগরি) are fine.
    Keep `{{placeholders}}` identical.
