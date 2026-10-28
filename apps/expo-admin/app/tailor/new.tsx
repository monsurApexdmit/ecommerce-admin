import React, { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { useCurrency } from "@/context/CurrencyContext"
import {
  findTailorCustomerByPhone,
  getCustomerOrders,
  getMeasurementsByCustomer,
  getTailorCustomers,
  getTailorFabrics,
  getTailorOrderDetail,
  getTailorOrderFormOptions,
  placeTailorOrder,
  saveTailorCustomer,
  tailorApiError,
} from "@/services/tailor"
import type { TailorCustomer, TailorFabric, TailorMeasurement, TailorOrderFormOptions } from "@/types/tailor"
import { GARMENT_DEFAULTS, PRODUCT_TYPES, TAILOR_PAY_METHODS, sameGarment } from "@/types/tailor"
import { addDaysIso, isIsoDate, jobCardHtml, measurementText, printOrShareHtml, todayIso } from "@/components/tailor/tailorHelpers"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

/** Style-option chips offered per garment (labels only; saved with the item). */
const STYLE_OPTS: Record<string, string[]> = {
  shirt: ["Mandarin collar", "Double cuff", "Pocket"],
  panjabi: ["Embroidery", "Side pocket", "Hidden placket"],
  pant: ["Pleated", "Side pocket", "Belt loop"],
  blouse: ["Boat neck", "Back zip", "Lining", "Puff sleeve"],
  "salwar kameez": ["Churidar", "Piping", "Lining"],
  coat: ["Two button", "Lining", "Vent"],
  pajama: ["Elastic waist", "Drawstring", "Side pocket"],
  jama: ["Embroidery", "Lining", "Collar"],
  kurta: ["Mandarin collar", "Side slit", "Embroidery"],
}

interface Line {
  g: string
  qty: number
  own: boolean
  fabricId: number | null
  meters: string
  ownNote: string
  rate: string
  opts: Record<string, boolean>
  note: string
  /** fabric price per unit override (text) */
  price?: string
  /** undefined = auto (latest saved set for the garment), null = none */
  measId?: number | null
}

const r2 = (v: number) => Math.round(v * 100) / 100
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

function SectionHeader({ n, title }: { n?: number; title: string }) {
  return (
    <View style={s.sectionHeaderRow}>
      {n ? <View style={s.stepBadge}><Text style={s.stepBadgeText}>{n}</Text></View> : null}
      <Text style={s.sectionHeader}>{title}</Text>
    </View>
  )
}

function Chip({ label, sub, active, onPress }: { label: string; sub?: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      {sub ? <Text style={[s.chipSub, active && s.chipTextActive]}>{sub}</Text> : null}
    </TouchableOpacity>
  )
}

export default function NewTailorOrderScreen() {
  const { canWrite } = useAuth()
  const { formatCurrency } = useCurrency()
  const fc = (n: number) => formatCurrency(n)

  const [fabrics, setFabrics] = useState<TailorFabric[]>([])
  const [opts, setOpts] = useState<TailorOrderFormOptions | null>(null)

  // customer
  const [cq, setCq] = useState("")
  const [results, setResults] = useState<TailorCustomer[]>([])
  const [searched, setSearched] = useState(false)
  const [cust, setCust] = useState<TailorCustomer | null>(null)
  const [custMeas, setCustMeas] = useState<TailorMeasurement[]>([])
  const [custInfo, setCustInfo] = useState<{ orders: number; due: number } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [nc, setNc] = useState({ name: "", phone: "", addr: "" })
  const [ncErr, setNcErr] = useState("")
  const [ncSaving, setNcSaving] = useState(false)

  // items
  const blank = (): Line => ({ g: "Shirt", qty: 1, own: true, fabricId: null, meters: "0", ownNote: "", rate: "0", opts: {}, note: "" })
  const [its, setIts] = useState<Line[]>([blank()])
  const [fabricPickerFor, setFabricPickerFor] = useState<number | null>(null)

  // delivery
  const [orderDate, setOrderDate] = useState(todayIso())
  const [date, setDate] = useState(addDaysIso(7))
  const [urgent, setUrgent] = useState(false)
  const [dz, setDz] = useState<number | null>(null)
  const [orderNote, setOrderNote] = useState("")

  // charges / advance
  const [extra, setExtra] = useState("0")
  const [disc, setDisc] = useState("0")
  const [advMode, setAdvMode] = useState<"none" | "half" | "full">("none")
  const [advManual, setAdvManual] = useState<string | undefined>(undefined)
  const [method, setMethod] = useState("cash")
  const [printAfter, setPrintAfter] = useState(false)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getTailorFabrics({ limit: 200, status: "active" }).then(setFabrics).catch(() => {})
    getTailorOrderFormOptions().then(setOpts).catch(() => {})
  }, [])

  // learned-from-history values win; the reference defaults fill the gaps
  const hint = (g: string) => {
    const learned = opts?.garments.find((x) => sameGarment(x.productType, g))
    const def = GARMENT_DEFAULTS.find((x) => sameGarment(x.name, g))
    const price = learned?.lastPrice || def?.price || 0
    const fabric = learned?.avgFabricEach || def?.fabric || 0
    return { price, fabric }
  }
  const suggest = (g: string, qty: number) => r2(hint(g).fabric * qty)

  // first line starts as a Shirt: give it its price once the form options are in
  useEffect(() => {
    setIts((p) => (p.length === 1 && p[0].rate === "0" && p[0].g === "Shirt" ? [{ ...p[0], rate: String(hint("Shirt").price) }] : p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts])

  // customer search
  useEffect(() => {
    const q = cq.trim()
    if (!q) { setResults([]); setSearched(false); return }
    const t = setTimeout(() => {
      getTailorCustomers({ search: q }).then((r) => { setResults(r.slice(0, 6)); setSearched(true) }).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [cq])

  const garmentList = useMemo(() => {
    const extraTypes = (opts?.garments ?? []).map((g) => g.productType).filter((g) => !PRODUCT_TYPES.some((p) => sameGarment(p, g)))
    return [...PRODUCT_TYPES, ...extraTypes]
  }, [opts])

  if (!canWrite("TailorOrders")) return <AccessDenied />

  const pickCustomer = (c: TailorCustomer) => {
    setCust(c); setCq(""); setErr(""); setShowNew(false)
    setIts((p) => p.map((x) => ({ ...x, measId: undefined })))
    setCustMeas([]); setCustInfo(null)
    getMeasurementsByCustomer(c.id).then(setCustMeas).catch(() => {})
    getCustomerOrders(c.id).then((list) => setCustInfo({
      orders: list.length,
      due: list.filter((o) => o.orderStatus !== "cancelled").reduce((a, o) => a + Math.max(0, o.totalAmount - o.paidAmount), 0),
    })).catch(() => {})
  }

  const phoneGuess = /^[0-9+\-\s]+$/.test(cq.trim()) ? cq.trim() : ""

  const saveNewCustomer = async () => {
    const name = (nc.name || (phoneGuess ? "" : cq.trim())).trim()
    const phone = (nc.phone || phoneGuess).trim()
    if (!name) { setNcErr("Customer name is required."); return }
    if (!phone) { setNcErr("Phone is required."); return }
    if (!/^[0-9+\-\s]{6,20}$/.test(phone)) { setNcErr("Enter a valid phone number."); return }
    setNcSaving(true); setNcErr("")
    try {
      const existing = await findTailorCustomerByPhone(phone)
      if (existing) { setNcErr("A customer with this phone already exists. Search by phone to select them."); return }
      const c = await saveTailorCustomer({ name, phone, address: nc.addr.trim() || undefined })
      pickCustomer(c)
      setNc({ name: "", phone: "", addr: "" })
    } catch (e) {
      setNcErr(tailorApiError(e, "Failed to add customer"))
    } finally {
      setNcSaving(false)
    }
  }

  const autoMeas = (g: string) =>
    custMeas.filter((m) => sameGarment(m.productType, g)).sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))[0]?.id
  const setIt = (i: number, patch: Partial<Line>) => { setIts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x))); setErr("") }

  // totals
  const calc = its.map((it) => {
    const qty = Math.max(1, it.qty)
    const f = !it.own && it.fabricId ? fabrics.find((x) => x.id === it.fabricId) : undefined
    const meters = num(it.meters)
    const unitPrice = f ? (it.price !== undefined ? num(it.price) : f.sellingPrice || f.purchasePrice) : 0
    const fabCost = f ? r2(meters * unitPrice) : 0
    return { qty, f, meters, unitPrice, fabCost, stitch: qty * num(it.rate) }
  })
  const stitch = calc.reduce((a, c) => a + c.stitch, 0)
  const fab = calc.reduce((a, c) => a + c.fabCost, 0)
  const urgFee = urgent ? opts?.urgentFee ?? 0 : 0
  const extraN = Math.max(0, num(extra))
  const subtotal = stitch + fab + urgFee + extraN
  const discount = Math.min(Math.max(0, num(disc)), subtotal)
  const total = r2(Math.max(0, subtotal - discount))
  const advRaw = advManual !== undefined ? num(advManual) : advMode === "half" ? Math.round(total / 2) : advMode === "full" ? total : 0
  const adv = Math.min(Math.max(0, advRaw), total)
  const due = r2(Math.max(0, total - adv))

  const today = todayIso()
  const sameDay = opts?.dueByDate?.[date] ?? 0
  const loadHint = !date ? "Pick a delivery date." : !isIsoDate(date) ? "Use YYYY-MM-DD." : date < orderDate ? "Delivery cannot be before the order date."
    : date < today ? "That date is in the past."
    : sameDay ? `${sameDay} open order${sameDay > 1 ? "s" : ""} already due that day. Consider Urgent.` : "No other orders due that day."

  const save = async () => {
    if (saving) return
    if (!cust) { setErr("Select a customer."); return }
    for (let i = 0; i < its.length; i++) {
      const it = its[i], c = calc[i]
      if (num(it.rate) < 0) { setErr(`Item ${i + 1}: stitching price cannot be negative.`); return }
      if (!it.own) {
        if (!c.f) { setErr(`Item ${i + 1}: choose a fabric or switch to customer's fabric.`); return }
        if (!(c.meters > 0)) { setErr(`Item ${i + 1}: enter fabric quantity.`); return }
      }
    }
    if (!isIsoDate(orderDate)) { setErr("Enter the order date as YYYY-MM-DD."); return }
    if (orderDate > today) { setErr("Order date cannot be in the future."); return }
    if (!isIsoDate(date)) { setErr("Enter the delivery date as YYYY-MM-DD."); return }
    if (date < orderDate) { setErr("Delivery date cannot be before the order date."); return }
    if (date < today) { setErr("Delivery date cannot be in the past."); return }
    if (!(total > 0)) { setErr("Order total must be greater than 0."); return }
    if (advRaw > total + 0.005) { setErr("Advance cannot be more than the total."); return }
    setSaving(true); setErr("")
    try {
      const created = await placeTailorOrder({
        customerId: cust.id, orderDate, deliveryDate: date, isUrgent: urgent, dorjiId: dz ?? undefined,
        notes: orderNote.trim() || undefined, extraCharge: extraN, discount, advancePayment: adv, advancePaymentMethod: method,
        items: its.map((it, i) => {
          const c = calc[i]
          const measId = it.measId === undefined ? autoMeas(it.g) : it.measId
          return {
            productType: it.g, quantity: c.qty, stitchingPrice: num(it.rate), fabricSource: it.own ? "own" : "shop",
            fabricId: c.f?.id, fabricQuantity: c.f ? c.meters : undefined, fabricUnitPrice: c.f ? c.unitPrice : undefined,
            ownFabricNote: it.own ? it.ownNote.trim() || undefined : undefined,
            measurementId: measId ?? undefined,
            styleOptions: Object.keys(it.opts).filter((k) => it.opts[k]),
            notes: it.note.trim() || undefined,
          }
        }),
      })
      if (printAfter && created?.id) {
        try { const d = await getTailorOrderDetail(created.id); await printOrShareHtml(jobCardHtml(d), "print", `Job card ${d.orderNumber}`) } catch { /* best effort */ }
      }
      Alert.alert("Order created", `Order ${created?.order_number ?? ""} created.`, [
        { text: "OK", onPress: () => router.replace(created?.id ? (`/tailor/${created.id}` as any) : "/tailor") },
      ])
    } catch (e) {
      setErr(tailorApiError(e, "Failed to create order"))
    } finally {
      setSaving(false)
    }
  }

  const garmentsSaved = Array.from(new Set(custMeas.map((m) => m.productType))).join(", ")
  const pickerLine = fabricPickerFor != null ? its[fabricPickerFor] : null

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>New Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* 1 · Customer */}
        <View style={s.card}>
          <SectionHeader n={1} title="Customer" />
          {!cust ? (
            <>
              <View style={s.searchRow}>
                <Ionicons name="search-outline" size={16} color={colors.muted} />
                <TextInput
                  style={s.searchInput}
                  value={cq}
                  onChangeText={setCq}
                  placeholder="Phone number or name"
                  placeholderTextColor={colors.muted}
                />
              </View>
              {results.map((c) => (
                <TouchableOpacity key={c.id} style={s.resultRow} onPress={() => pickCustomer(c)} activeOpacity={0.75}>
                  <Ionicons name="person-circle-outline" size={22} color="#7c3aed" />
                  <Text style={s.resultName}>{c.name}</Text>
                  <Text style={s.resultPhone}>{c.phone}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowNew((v) => !v)} hitSlop={6}>
                <Text style={s.link}>{showNew ? "Hide new customer" : "+ New customer"}</Text>
              </TouchableOpacity>
              {(showNew || (searched && cq.trim() && results.length === 0)) && (
                <View style={s.newCustBox}>
                  <Text style={s.mutedText}>{showNew ? "New customer" : "No customer matches — add them now"}</Text>
                  <TextInput style={s.input} value={nc.name} onChangeText={(v) => { setNc({ ...nc, name: v }); setNcErr("") }} placeholder="Full name *" placeholderTextColor={colors.muted} />
                  <TextInput style={s.input} value={nc.phone || phoneGuess} onChangeText={(v) => { setNc({ ...nc, phone: v }); setNcErr("") }} placeholder="Phone * (01XXX-XXXXXX)" keyboardType="phone-pad" placeholderTextColor={colors.muted} />
                  <TextInput style={s.input} value={nc.addr} onChangeText={(v) => setNc({ ...nc, addr: v })} placeholder="Address (optional)" placeholderTextColor={colors.muted} />
                  {ncErr ? <Text style={s.errText}>{ncErr}</Text> : null}
                  <TouchableOpacity style={[s.smallBtn, ncSaving && s.disabled]} onPress={() => void saveNewCustomer()} disabled={ncSaving}>
                    {ncSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.smallBtnText}>Save & select customer</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={s.custBox}>
              <Ionicons name="checkmark-circle" size={20} color="#7c3aed" />
              <View style={{ flex: 1 }}>
                <Text style={s.custName}>{cust.name}{cust.phone ? ` · ${cust.phone}` : ""}</Text>
                <Text style={s.mutedSmall}>
                  {custInfo ? `${custInfo.orders} order${custInfo.orders === 1 ? "" : "s"} · ` : ""}saved measurements: {garmentsSaved || "none"}
                  {custInfo ? ` · ${fc(custInfo.due)} due` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setCust(null); setCustMeas([]); setCustInfo(null) }} hitSlop={8}>
                <Text style={s.link}>Change</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2 · What to make */}
        <View style={s.card}>
          <SectionHeader n={2} title="What to make" />
          {its.map((it, i) => {
            const c = calc[i]
            const measId = it.measId === undefined ? autoMeas(it.g) : it.measId
            const meas = measId ? custMeas.find((m) => m.id === measId) : undefined
            const short = c.f && c.meters > c.f.stockQuantity
            const sug = suggest(it.g, c.qty)
            const styleOpts = Object.entries(STYLE_OPTS).find(([k]) => sameGarment(k, it.g))?.[1] ?? []
            const unit = c.f?.unit ?? "m"
            return (
              <View key={i} style={s.itemCard}>
                <View style={s.itemCardHeader}>
                  <Text style={s.itemIndex}>Item {i + 1} · {it.g}</Text>
                  <View style={s.rowCenter}>
                    <Text style={s.itemTotal}>{fc(c.stitch + c.fabCost)}</Text>
                    {its.length > 1 && (
                      <TouchableOpacity onPress={() => setIts((p) => p.filter((_, j) => j !== i))} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={s.label}>Garment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                  {garmentList.map((g) => {
                    const rate = hint(g).price
                    return (
                      <Chip
                        key={g}
                        label={g}
                        sub={rate ? fc(rate) : undefined}
                        active={sameGarment(it.g, g)}
                        onPress={() => setIt(i, { g, opts: {}, rate: String(rate), measId: undefined, meters: it.own ? "0" : String(suggest(g, c.qty)) })}
                      />
                    )
                  })}
                </ScrollView>

                <Text style={s.label}>Measurement</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                  <Chip label={custMeas.length ? "None" : "No saved measurements"} active={!measId} onPress={() => setIt(i, { measId: null })} />
                  {custMeas.map((m) => (
                    <Chip key={m.id} label={`${m.productType} · ${new Date(m.measuredAt).toLocaleDateString()}`} active={measId === m.id} onPress={() => setIt(i, { measId: m.id })} />
                  ))}
                </ScrollView>
                <Text style={s.mutedSmall}>{meas ? measurementText(meas) : cust ? "No measurement selected" : "Pick a customer first"}</Text>

                <Text style={s.label}>Fabric</Text>
                <View style={s.segment}>
                  {([["own", "Customer's fabric"], ["shop", "From shop stock"]] as const).map(([v, l]) => {
                    const on = (v === "own") === it.own
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[s.segmentBtn, on && s.segmentBtnActive]}
                        onPress={() => { const own = v === "own"; setIt(i, { own, meters: own ? "0" : String(suggest(it.g, c.qty)), fabricId: own ? null : it.fabricId }) }}
                      >
                        <Text style={[s.segmentText, on && s.segmentTextActive]}>{l}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {it.own ? (
                  <TextInput style={s.input} value={it.ownNote} onChangeText={(v) => setIt(i, { ownNote: v })} placeholder="Describe the customer's fabric, e.g. 2.5 m red georgette" placeholderTextColor={colors.muted} />
                ) : (
                  <>
                    <TouchableOpacity style={s.pickerBtn} onPress={() => setFabricPickerFor(i)} activeOpacity={0.8}>
                      <Text style={c.f ? s.pickerText : s.pickerPlaceholder} numberOfLines={1}>
                        {c.f ? `${c.f.name}${c.f.color ? ` · ${c.f.color}` : ""} — ${c.f.stockQuantity} ${c.f.unit} left` : fabrics.length ? "Choose fabric…" : "No fabrics in stock list"}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.muted} />
                    </TouchableOpacity>
                    <View style={s.twoCol}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={s.label}>Quantity ({unit})</Text>
                        <View style={s.stepper}>
                          <TouchableOpacity style={s.stepBtn} onPress={() => setIt(i, { meters: String(Math.max(0.5, r2(c.meters - 0.5))) })}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
                          <TextInput style={s.stepInput} keyboardType="decimal-pad" value={it.meters} onChangeText={(v) => setIt(i, { meters: v })} />
                          <TouchableOpacity style={s.stepBtn} onPress={() => setIt(i, { meters: String(r2(c.meters + 0.5)) })}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
                        </View>
                      </View>
                      {c.f && (
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text style={s.label}>Price / {c.f.unit}</Text>
                          <TextInput style={s.input} keyboardType="decimal-pad" value={it.price !== undefined ? it.price : String(c.unitPrice)} onChangeText={(v) => setIt(i, { price: v })} />
                        </View>
                      )}
                    </View>
                    <Text style={[s.mutedSmall, short && s.warnText]}>
                      {sug > 0 ? `Suggested ${sug} ${unit} for ${c.qty} ${it.g}` : ""}
                      {c.f ? `${sug > 0 ? " · " : ""}${fc(c.fabCost)} fabric${short ? ` · only ${c.f.stockQuantity} ${c.f.unit} in stock (cutting will be blocked until restocked)` : ""}` : ""}
                    </Text>
                  </>
                )}

                <View style={s.twoCol}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={s.label}>Pieces</Text>
                    <View style={s.stepper}>
                      <TouchableOpacity style={s.stepBtn} onPress={() => setIt(i, { qty: Math.max(1, c.qty - 1), meters: !it.own && c.meters === suggest(it.g, c.qty) ? String(suggest(it.g, Math.max(1, c.qty - 1))) : it.meters })}>
                        <Text style={s.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.stepValue}>{c.qty}</Text>
                      <TouchableOpacity style={s.stepBtn} onPress={() => setIt(i, { qty: c.qty + 1, meters: !it.own && c.meters === suggest(it.g, c.qty) ? String(suggest(it.g, c.qty + 1)) : it.meters })}>
                        <Text style={s.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={s.label}>Stitching (each)</Text>
                    <TextInput style={s.input} keyboardType="decimal-pad" value={it.rate} onChangeText={(v) => setIt(i, { rate: v })} />
                  </View>
                </View>

                {styleOpts.length > 0 && (
                  <>
                    <Text style={s.label}>Style options</Text>
                    <View style={s.wrapRow}>
                      {styleOpts.map((o) => (
                        <Chip key={o} label={`${it.opts[o] ? "✓ " : ""}${o}`} active={!!it.opts[o]} onPress={() => setIt(i, { opts: { ...it.opts, [o]: !it.opts[o] } })} />
                      ))}
                    </View>
                  </>
                )}
                <TextInput style={s.input} value={it.note} onChangeText={(v) => setIt(i, { note: v })} placeholder="Note for dorji, e.g. Boat neck, back zip" placeholderTextColor={colors.muted} />
              </View>
            )
          })}
          <TouchableOpacity
            style={s.addLineBtn}
            onPress={() => setIts((p) => [...p, { ...blank(), rate: String(hint("Shirt").price) }])}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#7c3aed" />
            <Text style={s.addLineText}>Add another garment</Text>
          </TouchableOpacity>
        </View>

        {/* 3 · Delivery & dorji */}
        <View style={s.card}>
          <SectionHeader n={3} title="Delivery & dorji" />
          <Text style={s.label}>Order date</Text>
          <TextInput style={s.input} value={orderDate} onChangeText={(v) => { setOrderDate(v); setErr("") }} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
          <Text style={s.label}>Delivery date</Text>
          <View style={s.wrapRow}>
            {[3, 5, 7, 10].map((n) => {
              const v = addDaysIso(n)
              return <Chip key={n} label={`+${n} days`} active={date === v} onPress={() => { setDate(v); setErr("") }} />
            })}
          </View>
          <TextInput style={s.input} value={date} onChangeText={(v) => { setDate(v); setErr("") }} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
          <Text style={s.mutedSmall}>{loadHint}</Text>

          <Text style={s.label}>Urgency</Text>
          <View style={s.twoCol}>
            <TouchableOpacity style={[s.choice, !urgent && s.choiceActive]} onPress={() => setUrgent(false)}>
              <Text style={[s.choiceTitle, !urgent && s.choiceTitleActive]}>Normal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.choice, urgent && s.choiceActive]} onPress={() => setUrgent(true)}>
              <Text style={[s.choiceTitle, urgent && s.choiceTitleActive]}>Urgent</Text>
              <Text style={s.mutedSmall}>+{fc(opts?.urgentFee ?? 0)} · jumps the queue</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Assign to dorji (optional)</Text>
          <View style={s.wrapRow}>
            {(opts?.dorjis ?? []).map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                sub={`${d.open} open${d.speciality.length ? ` · ${d.speciality.join(", ")}` : ""}`}
                active={dz === d.id}
                onPress={() => setDz(dz === d.id ? null : d.id)}
              />
            ))}
          </View>
          {opts && opts.dorjis.length === 0 && <Text style={s.mutedSmall}>No active dorjis yet. Add them under Dorjis, or leave unassigned.</Text>}

          <Text style={s.label}>Order notes</Text>
          <TextInput
            style={[s.input, s.notesInput]}
            value={orderNote}
            onChangeText={setOrderNote}
            placeholder="Anything the shop should remember about this order"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Summary */}
        <View style={s.card}>
          <SectionHeader title="Order summary" />
          <View style={s.sumRow}><Text style={s.sumLabel}>Stitching</Text><Text style={s.sumValue}>{fc(stitch)}</Text></View>
          <View style={s.sumRow}><Text style={s.sumLabel}>Fabric</Text><Text style={s.sumValue}>{fc(fab)}</Text></View>
          <View style={s.sumRow}><Text style={s.sumLabel}>Urgent charge</Text><Text style={s.sumValue}>{fc(urgFee)}</Text></View>
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Extra charge</Text>
            <TextInput style={s.sumInput} keyboardType="decimal-pad" value={extra} onChangeText={setExtra} />
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Discount</Text>
            <TextInput style={s.sumInput} keyboardType="decimal-pad" value={disc} onChangeText={setDisc} />
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{fc(total)}</Text>
          </View>

          <Text style={s.label}>Advance</Text>
          <View style={s.twoCol}>
            {([["none", "None"], ["half", "50%"], ["full", "Full"]] as const).map(([k, l]) => (
              <TouchableOpacity
                key={k}
                style={[s.choice, advMode === k && advManual === undefined && s.choiceActive, { alignItems: "center" }]}
                onPress={() => { setAdvMode(k); setAdvManual(undefined); setErr("") }}
              >
                <Text style={[s.choiceTitle, advMode === k && advManual === undefined && s.choiceTitleActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={s.input}
            keyboardType="decimal-pad"
            value={advManual !== undefined ? advManual : String(adv)}
            onChangeText={(v) => { setAdvManual(v); setErr("") }}
            placeholder="Advance amount"
            placeholderTextColor={colors.muted}
          />
          <View style={s.wrapRow}>
            {TAILOR_PAY_METHODS.map((m) => <Chip key={m.id} label={m.label} active={method === m.id} onPress={() => setMethod(m.id)} />)}
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Due on delivery</Text>
            <Text style={[s.sumValue, { color: due ? "#d97706" : "#16a34a" }]}>{fc(due)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Print job card after saving</Text>
            <Switch value={printAfter} onValueChange={setPrintAfter} trackColor={{ true: "#c4b5fd" }} thumbColor={printAfter ? "#7c3aed" : undefined} />
          </View>
        </View>

        {err ? <Text style={s.errBanner}>{err}</Text> : null}

        <TouchableOpacity style={[s.submitBtn, saving && s.disabled]} onPress={() => void save()} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={s.submitBtnText}>Create Order</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Fabric picker */}
      <Modal visible={fabricPickerFor != null} transparent animationType="slide" onRequestClose={() => setFabricPickerFor(null)}>
        <Pressable style={s.overlay} onPress={() => setFabricPickerFor(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Choose fabric</Text>
          <ScrollView>
            {fabrics.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={s.pickRow}
                onPress={() => {
                  if (fabricPickerFor == null || !pickerLine) return
                  const i = fabricPickerFor
                  setIt(i, { fabricId: f.id, price: undefined, meters: num(pickerLine.meters) > 0 ? pickerLine.meters : String(suggest(pickerLine.g, Math.max(1, pickerLine.qty))) })
                  setFabricPickerFor(null)
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.pickName}>{f.name}{f.color ? ` · ${f.color}` : ""}</Text>
                  <Text style={[s.mutedSmall, f.stockQuantity <= 0 && s.warnText]}>{fc(f.sellingPrice)}/{f.unit} · {f.stockQuantity} {f.unit} left</Text>
                </View>
                {pickerLine?.fabricId === f.id && <Ionicons name="checkmark" size={18} color="#7c3aed" />}
              </TouchableOpacity>
            ))}
            {fabrics.length === 0 && <Text style={s.mutedText}>No active fabrics.</Text>}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.text },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontSize: 12, fontWeight: "800", color: "#7c3aed" },
  sectionHeader: { fontSize: 16, fontWeight: "800", color: colors.text },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  mutedText: { fontSize: 13, color: colors.muted },
  mutedSmall: { fontSize: 12, color: colors.muted },
  warnText: { color: "#b45309", fontWeight: "600" },
  errText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
  errBanner: { fontSize: 13, color: colors.danger, fontWeight: "700", backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#fecaca" },
  link: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },
  input: {
    backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  notesInput: { minHeight: 70 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  resultPhone: { fontSize: 12, color: colors.muted },
  newCustBox: { gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 12, padding: 12 },
  custBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#c4b5fd", backgroundColor: "#f5f3ff" },
  custName: { fontSize: 14, fontWeight: "800", color: colors.text },
  smallBtn: { backgroundColor: "#7c3aed", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.6 },
  itemCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 8 },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemIndex: { fontSize: 14, fontWeight: "800", color: colors.text },
  itemTotal: { fontSize: 14, fontWeight: "800", color: "#7c3aed" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  chipRow: { gap: 8 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  chipSub: { fontSize: 10, color: colors.muted, marginTop: 1 },
  chipTextActive: { color: "#fff" },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#7c3aed" },
  segmentText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  segmentTextActive: { color: "#fff" },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 11,
  },
  pickerText: { fontSize: 13, color: colors.text, flex: 1 },
  pickerPlaceholder: { fontSize: 13, color: colors.muted, flex: 1 },
  twoCol: { flexDirection: "row", gap: 10 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: "hidden" },
  stepBtn: { width: 40, paddingVertical: 9, alignItems: "center", backgroundColor: "#f5f3ff" },
  stepBtnText: { fontSize: 18, fontWeight: "800", color: "#7c3aed" },
  stepInput: { flex: 1, textAlign: "center", fontSize: 14, color: colors.text, paddingVertical: 8 },
  stepValue: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: colors.text },
  addLineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#c4b5fd", borderStyle: "dashed", borderRadius: 12, paddingVertical: 12 },
  addLineText: { color: "#7c3aed", fontWeight: "700", fontSize: 13 },
  choice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.surface, gap: 2 },
  choiceActive: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
  choiceTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  choiceTitleActive: { color: "#7c3aed" },
  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sumLabel: { fontSize: 13, color: colors.muted },
  sumValue: { fontSize: 14, fontWeight: "700", color: colors.text },
  sumInput: {
    width: 110, textAlign: "right", backgroundColor: colors.background, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: colors.text,
  },
  totalBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ede9fe", borderRadius: 10, padding: 12, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#7c3aed" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7c3aed", borderRadius: 16, paddingVertical: 16,
    shadowColor: "#7c3aed", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 10, maxHeight: "70%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickName: { fontSize: 14, fontWeight: "700", color: colors.text },
})
