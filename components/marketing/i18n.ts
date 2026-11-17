import type { ParseKeys, TFunction } from "i18next"

/** Namespaces used by the marketing screens: `useTranslation(MARKETING_NS)`. */
export const MARKETING_NS = ["commerce", "common"] as const
type MarketingNs = typeof MARKETING_NS

/** A translation key of the marketing screens ("commerce:…" or "common:…"); tsc rejects unknown keys. */
export type MarketingKey = ParseKeys<MarketingNs>
/** `t` of `useTranslation(MARKETING_NS)`, for helpers that build display text outside a component. */
export type MarketingT = TFunction<MarketingNs>
