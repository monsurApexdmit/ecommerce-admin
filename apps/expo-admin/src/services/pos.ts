import { api } from "@/lib/api";
import type {
  CheckoutPayload,
  Coupon,
  PaymentMethod,
  PosPaymentOptions,
  PosProduct,
  PosVariant,
} from "@/types/pos";

type CouponRaw = {
  id: number;
  campaignName?: string;
  campaign_name?: string;
  code: string;
  discount: number;
  type: "percentage" | "fixed" | "free_shipping";
  status: boolean;
  phase?: string;
  channelPos?: boolean;
  minOrderAmount?: number;
  min_order_amount?: number;
  maxDiscount?: number | null;
  max_discount?: number | null;
  usageLimitPerUser?: number | null;
  oncePerCustomer?: boolean;
  productIds?: number[];
  categoryIds?: number[];
  applicableToProducts?: string | null;
  applicableToCategories?: string | null;
};

type CreateSellResponse = {
  message: string;
  data: {
    id: number;
    invoiceNo?: string;
    invoice_no?: string;
    amount?: number;
    discount?: number;
    taxAmount?: number | null;
    [key: string]: any;
  };
};

/** Built-in POS methods, used when payment settings were never configured. */
export const DEFAULT_POS_METHODS: PaymentMethod[] = ["Cash", "Card", "bKash", "Nagad", "Bank", "COD"];
/** Methods that take a payment reference (transaction id). */
export const NEEDS_TXN: PaymentMethod[] = ["bKash", "Nagad", "Bank"];

/** Payment settings slug -> value accepted by the sells API (`method`). */
const SELL_METHOD_BY_SLUG: Record<string, PaymentMethod> = {
  cash: "Cash", card: "Card", bkash: "bKash", nagad: "Nagad", bank: "Bank", cod: "COD", online: "Online",
};

const idList = (ids?: number[] | null, csv?: string | null) =>
  Array.isArray(ids) && ids.length ? ids.map(Number) : csv ? csv.split(",").map(Number).filter(Boolean) : [];

export async function getActiveCoupons(): Promise<Coupon[]> {
  const response = await api.get("/coupons", { params: { limit: 100 } });
  const payload = response.data?.data;
  const raw: CouponRaw[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

  return raw
    // live coupons only (`phase` is set by the server: scheduled / active / expired / used up)
    .filter((c) => (c.phase ? c.phase === "active" : c.status === true))
    .filter((c) => c.channelPos !== false && c.type !== "free_shipping")
    .map((c) => ({
      id: c.id,
      code: c.code,
      campaignName: c.campaignName ?? c.campaign_name ?? c.code,
      discount: Number(c.discount ?? 0),
      type: c.type,
      minOrderAmount: Number(c.minOrderAmount ?? c.min_order_amount ?? 0),
      maxDiscount: c.maxDiscount ?? c.max_discount ?? null,
      perCustomer: Boolean(c.oncePerCustomer) || c.usageLimitPerUser != null,
      productIds: idList(c.productIds, c.applicableToProducts),
      categoryIds: idList(c.categoryIds, c.applicableToCategories),
    }));
}

/** Coupon amount for the cart: only eligible lines count; capped by max discount and what is left after the manual discount. */
export function couponDiscountFor(
  coupon: Coupon,
  lines: { productId: number; categoryId?: number; subtotal: number }[],
  subtotal: number,
  manualDiscount = 0,
): { amount: number; problem: string } {
  const scoped = (coupon.productIds?.length || coupon.categoryIds?.length)
    ? lines.filter((l) => coupon.productIds?.includes(l.productId) || (l.categoryId !== undefined && coupon.categoryIds?.includes(l.categoryId)))
    : lines;
  const eligible = scoped.reduce((sum, l) => sum + l.subtotal, 0);
  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) return { amount: 0, problem: "min" };
  if (eligible <= 0) return { amount: 0, problem: "No items in the cart are eligible for this coupon." };
  let amount = coupon.type === "percentage" ? (eligible * coupon.discount) / 100 : Math.min(coupon.discount, eligible);
  if (coupon.type === "percentage" && coupon.maxDiscount && coupon.maxDiscount > 0) amount = Math.min(amount, coupon.maxDiscount);
  amount = Math.min(Math.max(amount, 0), Math.max(0, subtotal - manualDiscount));
  return { amount: Math.round(amount * 100) / 100, problem: "" };
}

/** Methods enabled for the POS in payment settings (empty when never configured -> built-in list). */
export async function getPosPaymentOptions(): Promise<PosPaymentOptions> {
  const fallback: PosPaymentOptions = { methods: DEFAULT_POS_METHODS, defaultMethod: "Cash" };
  try {
    const response = await api.get("/settings/payment");
    const raw = response.data?.data ?? {};
    const slugs: string[] = Array.isArray(raw.posMethods)
      ? raw.posMethods.map((x: any) => (typeof x === "string" ? x : x?.slug)).filter(Boolean)
      : [];
    const methods = Array.from(new Set(
      slugs.map((s) => SELL_METHOD_BY_SLUG[String(s).toLowerCase()]).filter((m): m is PaymentMethod => !!m),
    ));
    if (methods.length === 0) return fallback;
    const def = raw.posDefault ? SELL_METHOD_BY_SLUG[String(raw.posDefault).toLowerCase()] : undefined;
    return { methods, defaultMethod: def && methods.includes(def) ? def : methods[0] };
  } catch {
    return fallback;
  }
}

export interface PosLocation {
  id: number;
  name: string;
  isDefault: boolean;
  sellsInPos: boolean;
}

/** Locations that sell at the POS (all of them when none is flagged). */
export async function getPosLocations(): Promise<PosLocation[]> {
  const response = await api.get("/locations");
  const payload = response.data?.data;
  const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  const all = items.map((l) => ({
    id: Number(l.id),
    name: String(l.name ?? ""),
    isDefault: Boolean(l.isDefault ?? l.is_default),
    sellsInPos: l.sellsInPos !== false && l.sells_in_pos !== false,
  }));
  const pos = all.filter((l) => l.sellsInPos);
  return pos.length > 0 ? pos : all;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function stockAt(row: any, locationId?: number): { stock: number; inventoryId?: number } {
  if (!locationId) return { stock: n(row.stock) };
  const inv: any[] = Array.isArray(row.inventory) ? row.inventory : [];
  const hit = inv.find((i) => Number(i.locationId ?? i.location_id ?? i.warehouseId ?? i.warehouse_id) === locationId);
  if (hit) return { stock: n(hit.quantity), inventoryId: hit.id != null ? Number(hit.id) : undefined };
  const byLoc: any[] = Array.isArray(row.stockByLocation) ? row.stockByLocation : [];
  const loc = byLoc.find((l) => Number(l.locationId) === locationId);
  if (loc) return { stock: n(loc.quantity) };
  // per-location rows exist but none here -> nothing in stock at this location
  if (inv.some((i) => (i.locationId ?? i.location_id) != null) || byLoc.length > 0) return { stock: 0 };
  return { stock: n(row.stock) };
}

function regularOf(row: any) {
  const sale = n(row.salePrice ?? row.sale_price);
  return sale > 0 ? sale : n(row.price);
}

function primaryImage(p: any): string | undefined {
  const images: any[] = Array.isArray(p.images) ? p.images : [];
  const primary = images.find((i) => i.isPrimary === true || i.is_primary === true) ?? images[0];
  return primary?.path ?? (typeof p.image === "string" && p.image.trim() ? p.image : undefined);
}

function toPosVariant(v: any, locationId?: number): PosVariant {
  const regular = regularOf(v);
  const { stock, inventoryId } = stockAt(v, locationId);
  return {
    id: Number(v.id),
    name: String(v.name ?? ""),
    price: v.currentPrice != null ? n(v.currentPrice) : regular,
    regularPrice: regular,
    offerActive: v.offerActive === true,
    wholesalePrice: v.wholesalePrice != null ? n(v.wholesalePrice) : undefined,
    minWholesaleQty: v.minWholesaleQty != null ? n(v.minWholesaleQty) : undefined,
    stock,
    inventoryId,
    sku: v.sku ?? "",
    barcode: v.barcode ?? undefined,
  };
}

function toPosProduct(p: any, locationId?: number): PosProduct {
  const regular = regularOf(p);
  const variants: PosVariant[] = Array.isArray(p.variants) ? p.variants.map((v: any) => toPosVariant(v, locationId)) : [];
  const own = stockAt(p, locationId).stock;
  return {
    id: Number(p.id),
    name: String(p.name ?? ""),
    categoryId: p.categoryId ?? p.category_id ?? p.category?.id ?? undefined,
    image: primaryImage(p),
    price: p.currentPrice != null ? n(p.currentPrice) : regular,
    regularPrice: regular,
    offerActive: p.offerActive === true,
    wholesalePrice: p.wholesalePrice != null ? n(p.wholesalePrice) : undefined,
    minWholesaleQty: p.minWholesaleQty != null ? n(p.minWholesaleQty) : undefined,
    stock: variants.length > 0 ? variants.reduce((sum, v) => sum + v.stock, 0) : own,
    sku: p.sku ?? undefined,
    barcode: p.barcode ?? undefined,
    published: p.published !== false,
    variants,
  };
}

/** Products sold at the POS (`pos=1`), with current prices and stock at the selected location. */
export async function getPosProducts(params: {
  search?: string;
  categoryId?: number;
  locationId?: number;
  limit?: number;
}): Promise<PosProduct[]> {
  const response = await api.get("/products", {
    params: {
      pos: 1,
      page: 1,
      limit: params.limit ?? 100,
      search: params.search || undefined,
      category_id: params.categoryId,
      location_id: params.locationId,
    },
  });
  const payload = response.data?.data;
  const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return items.map((p) => toPosProduct(p, params.locationId));
}

export interface CreatedSale {
  id: number;
  invoiceNo: string;
  /** Totals as settled by the server (it re-prices lines and re-checks the coupon) */
  amount: number;
  discount: number;
}

export async function createSell(payload: CheckoutPayload): Promise<CreatedSale> {
  const response = await api.post<CreateSellResponse>("/sells", {
    customerId: payload.customerId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerEmail: payload.customerEmail,
    shippingFullName: payload.shippingFullName,
    shippingPhone: payload.shippingPhone,
    shippingEmail: payload.shippingEmail,
    shippingAddressLine1: payload.shippingAddressLine1,
    shippingCity: payload.shippingCity,
    shippingState: payload.shippingState,
    shippingPostalCode: payload.shippingPostalCode,
    shippingCountry: payload.shippingCountry,
    method: payload.method,
    source: payload.source,
    locationId: payload.locationId,
    amount: payload.amount,
    discount: payload.discount > 0 ? payload.discount : undefined,
    manualDiscount: payload.manualDiscount && payload.manualDiscount > 0 ? payload.manualDiscount : undefined,
    couponId: payload.couponId,
    couponCode: payload.couponCode,
    taxRate: payload.taxRate,
    taxAmount: payload.taxAmount,
    paidAmount: payload.paidAmount,
    transactionId: payload.transactionId || undefined,
    shippingCost: payload.shippingCost,
    status: payload.status,
    items: payload.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      inventoryId: item.inventoryId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.price,
      price: item.price,
    })),
  });

  const d = response.data.data;
  return {
    id: d.id,
    invoiceNo: d.invoiceNo ?? d.invoice_no ?? String(d.id),
    amount: n(d.amount ?? payload.amount),
    discount: n(d.discount ?? payload.discount),
  };
}
