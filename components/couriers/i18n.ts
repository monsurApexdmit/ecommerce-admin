import type { ParseKeys, TFunction } from "i18next"

/** Namespaces used by the courier screens: `useTranslation(COURIER_NS)`. */
export const COURIER_NS = ["courier", "common"] as const
type CourierNs = typeof COURIER_NS

/** A translation key of the courier screens ("courier:…" or "common:…"); tsc rejects unknown keys. */
export type CourierKey = ParseKeys<CourierNs>
/** `t` of `useTranslation(COURIER_NS)`, for helpers that build display text outside a component. */
export type CourierT = TFunction<CourierNs>
