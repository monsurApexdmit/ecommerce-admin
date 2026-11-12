import type { ParseKeys, TFunction } from "i18next"

/** Namespaces used by the tailor screens: `useTranslation(TAILOR_NS)`. */
export const TAILOR_NS = ["tailor", "common"] as const
type TailorNs = typeof TAILOR_NS

/** A translation key of the tailor screens ("tailor:…" or "common:…"); tsc rejects unknown keys. */
export type TailorKey = ParseKeys<TailorNs>
/** `t` of `useTranslation(TAILOR_NS)`, for helpers that build display text outside a component. */
export type TailorT = TFunction<TailorNs>

const norm = (v?: string | null) => String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_")
const pick = (t: TailorT, map: Record<string, TailorKey>, raw?: string | null, fallback?: string) => {
  const key = map[norm(raw)]
  return key ? t(key) : (fallback ?? String(raw ?? ""))
}

/** Order stage codes (and the older order_status values that mean "Received") → labels. */
const STAGE_KEY: Record<string, TailorKey> = {
  new: "tailor:stage.new", pending: "tailor:stage.new", measurement_taken: "tailor:stage.new", assigned: "tailor:stage.new",
  cutting: "tailor:stage.cutting", stitching: "tailor:stage.stitching", trial: "tailor:stage.trial",
  ready: "tailor:stage.ready", delivered: "tailor:stage.delivered", cancelled: "tailor:stage.cancelled", canceled: "tailor:stage.cancelled",
}
export const stageLabel = (t: TailorT, stage?: string | null, fallback?: string) => pick(t, STAGE_KEY, stage, fallback)

const PAY_KEY: Record<string, TailorKey> = { unpaid: "tailor:pay.unpaid", partial: "tailor:pay.partial", paid: "tailor:pay.paid" }
export const payStatusLabel = (t: TailorT, status?: string | null) => pick(t, PAY_KEY, status)

const WORK_KEY: Record<string, TailorKey> = {
  assigned: "tailor:work.assigned", in_progress: "tailor:work.inProgress", completed: "tailor:work.completed",
  returned: "tailor:work.returned", paid: "tailor:work.paid",
}
export const workLabel = (t: TailorT, status?: string | null) => pick(t, WORK_KEY, status)

const DORJI_STATUS_KEY: Record<string, TailorKey> = {
  active: "tailor:dorjiStatus.active", on_leave: "tailor:dorjiStatus.onLeave", inactive: "tailor:dorjiStatus.inactive",
}
export const dorjiStatusLabel = (t: TailorT, status?: string | null) => pick(t, DORJI_STATUS_KEY, status)

/** Payment method codes (cash, bank, bkash, nagad, card) → labels; unknown codes keep the API label. */
const METHOD_KEY: Record<string, TailorKey> = {
  cash: "tailor:method.cash", bank: "tailor:method.bank", bkash: "tailor:method.bkash", nagad: "tailor:method.nagad", card: "tailor:method.card",
}
export const methodLabel = (t: TailorT, method?: string | null, fallback?: string) => {
  const key = METHOD_KEY[norm(method)]
  if (key) return t(key)
  if (fallback) return fallback
  const m = String(method ?? "")
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "—"
}
/** Method ids offered in the payment forms (values sent to the API). */
export const PAY_METHOD_IDS = ["cash", "bank", "bkash", "nagad", "card"] as const

/** Built-in garment names (the English value is what the API stores) → labels. */
const GARMENT_KEY: Record<string, TailorKey> = {
  shirt: "tailor:garment.shirt", panjabi: "tailor:garment.panjabi", pant: "tailor:garment.pant", pants: "tailor:garment.pant",
  pajama: "tailor:garment.pajama", jama: "tailor:garment.jama", kurta: "tailor:garment.kurta", blouse: "tailor:garment.blouse",
  salwar: "tailor:garment.salwarKameez", salwar_kameez: "tailor:garment.salwarKameez", shalwar_kameez: "tailor:garment.salwarKameez",
  coat: "tailor:garment.coat", other: "tailor:garment.other", embroidery: "tailor:garment.embroidery",
}
export const garmentLabel = (t: TailorT, g?: string | null) => pick(t, GARMENT_KEY, g)

/** Style-option chips (English text is saved with the item) → labels. */
const STYLE_KEY: Record<string, TailorKey> = {
  mandarin_collar: "tailor:style.mandarinCollar", double_cuff: "tailor:style.doubleCuff", pocket: "tailor:style.pocket",
  embroidery: "tailor:style.embroidery", side_pocket: "tailor:style.sidePocket", hidden_placket: "tailor:style.hiddenPlacket",
  pleated: "tailor:style.pleated", belt_loop: "tailor:style.beltLoop", boat_neck: "tailor:style.boatNeck", back_zip: "tailor:style.backZip",
  lining: "tailor:style.lining", puff_sleeve: "tailor:style.puffSleeve", churidar: "tailor:style.churidar", piping: "tailor:style.piping",
  two_button: "tailor:style.twoButton", vent: "tailor:style.vent", elastic_waist: "tailor:style.elasticWaist",
  drawstring: "tailor:style.drawstring", collar: "tailor:style.collar", side_slit: "tailor:style.sideSlit",
}
export const styleLabel = (t: TailorT, o?: string | null) => pick(t, STYLE_KEY, o)

const FABRIC_TYPE_KEY: Record<string, TailorKey> = {
  cotton: "tailor:fabricType.cotton", silk: "tailor:fabricType.silk", linen: "tailor:fabricType.linen",
  georgette: "tailor:fabricType.georgette", khadi: "tailor:fabricType.khadi", denim: "tailor:fabricType.denim",
}
export const fabricTypeLabel = (t: TailorT, v?: string | null) => pick(t, FABRIC_TYPE_KEY, v)

const PATTERN_KEY: Record<string, TailorKey> = {
  plain: "tailor:pattern.plain", striped: "tailor:pattern.striped", checked: "tailor:pattern.checked",
  printed: "tailor:pattern.printed", embroidered: "tailor:pattern.embroidered", textured: "tailor:pattern.textured",
}
export const patternLabel = (t: TailorT, v?: string | null) => pick(t, PATTERN_KEY, v)

const COLOUR_KEY: Record<string, TailorKey> = {
  white: "tailor:colour.white", beige: "tailor:colour.beige", maroon: "tailor:colour.maroon",
  navy: "tailor:colour.navy", green: "tailor:colour.green", black: "tailor:colour.black",
}
export const colourLabel = (t: TailorT, v?: string | null) => pick(t, COLOUR_KEY, v)

const FIT_KEY: Record<string, TailorKey> = { regular: "tailor:fit.regular", slim: "tailor:fit.slim", loose: "tailor:fit.loose" }
export const fitLabel = (t: TailorT, v?: string | null) => pick(t, FIT_KEY, v)

/** Built-in measurement field keys (as stored, e.g. "arm_hole") → labels; other keys are humanised as-is. */
const MEAS_KEY: Record<string, TailorKey> = {
  chest: "tailor:measField.chest", length: "tailor:measField.length", shoulder: "tailor:measField.shoulder",
  sleeve: "tailor:measField.sleeve", collar: "tailor:measField.collar", cuff: "tailor:measField.cuff", waist: "tailor:measField.waist",
  hip: "tailor:measField.hip", bust: "tailor:measField.bust", arm_hole: "tailor:measField.arm_hole",
  front_neck: "tailor:measField.front_neck", back_neck: "tailor:measField.back_neck", salwar_length: "tailor:measField.salwar_length",
  bottom: "tailor:measField.bottom", thigh: "tailor:measField.thigh", knee: "tailor:measField.knee", fly: "tailor:measField.fly",
  inseam: "tailor:measField.inseam", back: "tailor:measField.back", neck: "tailor:measField.neck",
  pajama_waist: "tailor:measField.pajama_waist", pajama_length: "tailor:measField.pajama_length",
  bottom_length: "tailor:measField.bottom_length",
}
export const measFieldLabel = (t: TailorT, k: string) => {
  const key = MEAS_KEY[norm(k)]
  if (key) return t(key)
  const s = k.replace(/_/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Customer / dorji ledger entry types → labels (falls back to the API's own label). */
const LEDGER_TYPE_KEY: Record<string, TailorKey> = {
  advance: "tailor:payments.typeAdvance", payment: "tailor:payments.typePayment",
  final: "tailor:payments.typeFinal", payout: "tailor:payments.typePayout",
}
export const ledgerTypeLabel = (t: TailorT, type?: string | null, fallback?: string) => pick(t, LEDGER_TYPE_KEY, type, fallback)
