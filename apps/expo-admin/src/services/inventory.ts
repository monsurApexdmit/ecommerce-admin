import { api } from "@/lib/api";

export interface InventoryLocation {
  locationId: number;
  locationName: string;
  quantity: number;
}

export interface InventoryItem {
  type: "variant" | "product";
  id: number;
  productId: number;
  productName: string;
  variantName?: string;
  sku: string;
  barcode?: string;
  stock: number;
  inventory: InventoryLocation[];
}

export interface TransferItem {
  id: number;
  productId: number;
  productName: string;
  variantId?: number | null;
  variantName?: string;
  fromLocationId: number;
  fromLocationName: string;
  toLocationId: number;
  toLocationName: string;
  quantity: number;
  notes?: string;
  status: "Pending" | "Completed" | "Cancelled";
  createdAt: string;
}

export interface LocationProduct {
  type: "variant" | "product";
  id: number;
  productId: number;
  productName: string;
  variantName?: string;
  sku: string;
  stock: number;
}

export async function getInventory(params?: {
  search?: string;
  warehouseId?: number;
}): Promise<InventoryItem[]> {
  let allItems: InventoryItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await api.get("/inventory", {
      params: {
        page,
        per_page: 100,
        ...(params?.search && { search: params.search }),
        ...(params?.warehouseId && { location_id: params.warehouseId }),
      },
    });

    const items: InventoryItem[] = response.data?.data ?? [];
    const pagination = response.data?.meta?.pagination ?? response.data?.meta ?? {};
    allItems = [...allItems, ...items];
    const total = pagination.total ?? allItems.length;
    hasMore = allItems.length < total;
    page++;
    if (items.length === 0) break;
  }

  return allItems;
}

export async function getProductsByLocation(locationId: number): Promise<LocationProduct[]> {
  const response = await api.get(`/transfers/products-by-location/${locationId}`);
  const raw: Array<{
    id: number; name: string; stock: number; sku: string;
    variants?: Array<{ id: number; product_id: number; name: string; stock: number; sku: string }>;
  }> = response.data?.data ?? [];

  const rows: LocationProduct[] = [];
  for (const product of raw) {
    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        rows.push({ type: "variant", id: v.id, productId: product.id, productName: product.name, variantName: v.name, sku: v.sku, stock: v.stock });
      }
    } else {
      rows.push({ type: "product", id: product.id, productId: product.id, productName: product.name, sku: product.sku, stock: product.stock });
    }
  }
  return rows;
}

export async function getTransfers(): Promise<TransferItem[]> {
  const response = await api.get("/transfers");
  const data = response.data?.data?.data ?? response.data?.data ?? [];
  return data.map((t: any) => ({
    id: t.id,
    productId: t.productId ?? t.product_id ?? t.product?.id,
    productName: t.product?.name ?? t.productName ?? t.product_name ?? "",
    variantId: t.variantId ?? t.variant_id ?? null,
    variantName: t.variant?.name ?? t.variantName ?? t.variant_name,
    fromLocationId: t.fromLocationId ?? t.from_location_id ?? t.fromLocation?.id,
    fromLocationName: t.fromLocation?.name ?? t.from_location?.name ?? "",
    toLocationId: t.toLocationId ?? t.to_location_id ?? t.toLocation?.id,
    toLocationName: t.toLocation?.name ?? t.to_location?.name ?? "",
    quantity: Number(t.quantity ?? 0),
    notes: t.notes,
    status: t.status ?? "Pending",
    createdAt: t.createdAt ?? t.created_at ?? "",
  }));
}

export async function createTransfer(data: {
  productId: number;
  variantId?: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  notes?: string;
}): Promise<TransferItem> {
  const response = await api.post("/transfers", {
    product_id: data.productId,
    variant_id: data.variantId ?? null,
    from_location_id: data.fromLocationId,
    to_location_id: data.toLocationId,
    quantity: data.quantity,
    notes: data.notes,
  });
  const t = response.data?.data ?? response.data;
  return {
    id: t.id,
    productId: t.product_id ?? t.productId,
    productName: t.product?.name ?? "",
    variantId: t.variant_id ?? t.variantId ?? null,
    variantName: t.variant?.name,
    fromLocationId: t.from_location_id ?? t.fromLocationId,
    fromLocationName: t.fromLocation?.name ?? t.from_location?.name ?? "",
    toLocationId: t.to_location_id ?? t.toLocationId,
    toLocationName: t.toLocation?.name ?? t.to_location?.name ?? "",
    quantity: Number(t.quantity ?? 0),
    notes: t.notes,
    status: t.status ?? "Pending",
    createdAt: t.createdAt ?? t.created_at ?? "",
  };
}

export async function cancelTransfer(id: number): Promise<void> {
  await api.put(`/transfers/${id}/cancel`);
}

// ─── Stock overview (GET /inventory/overview) ─────────────────────────────────
// Health per SKU: ok | low | out | over. Products with real variants take their health
// from the variants (out when all are out, low when any is low/out, …) — computed server-side.

export type StockHealth = "ok" | "low" | "out" | "over";
export type StockHealthFilter = "all" | "attention" | StockHealth;

export interface StockOverviewRow {
  type: "product" | "variant";
  /** product id for type=product, variant id for type=variant */
  id: number;
  productId: number;
  name: string;
  variantName?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  published: boolean;
  sku: string;
  barcode?: string | null;
  reorderPoint: number;
  cost: number;
  locations: InventoryLocation[];
  onHand: number;
  reserved: number;
  available: number;
  health: StockHealth;
  value: number;
  variants: StockOverviewRow[];
}

export interface StockOverview {
  items: StockOverviewRow[];
  total: number;
  counts: Record<StockHealthFilter, number>;
  stats: {
    skus: number;
    units: number;
    reserved: number;
    stockValue: number;
    low: number;
    out: number;
    over: number;
    ok: number;
    attention: number;
  };
  locations: Array<{ id: number; name: string; isDefault: boolean }>;
  categories: Array<{ id: number; name: string }>;
}

function normalizeOverviewRow(r: any): StockOverviewRow {
  return {
    type: r.type === "variant" ? "variant" : "product",
    id: Number(r.id),
    productId: Number(r.productId ?? r.id),
    name: r.name ?? "",
    variantName: r.variantName ?? null,
    categoryId: r.categoryId ?? null,
    categoryName: r.categoryName ?? null,
    published: Boolean(r.published ?? true),
    sku: r.sku ?? "",
    barcode: r.barcode ?? null,
    reorderPoint: Number(r.reorderPoint ?? 0),
    cost: Number(r.cost ?? 0),
    locations: Array.isArray(r.locations)
      ? r.locations.map((l: any) => ({
          locationId: Number(l.locationId),
          locationName: l.locationName ?? "",
          quantity: Number(l.quantity ?? 0),
        }))
      : [],
    onHand: Number(r.onHand ?? 0),
    reserved: Number(r.reserved ?? 0),
    available: Number(r.available ?? 0),
    health: (["ok", "low", "out", "over"].includes(r.health) ? r.health : "ok") as StockHealth,
    value: Number(r.value ?? 0),
    variants: Array.isArray(r.variants) ? r.variants.map(normalizeOverviewRow) : [],
  };
}

export async function getInventoryOverview(params?: {
  search?: string;
  locationId?: number;
  categoryId?: number;
  health?: StockHealthFilter;
}): Promise<StockOverview> {
  const response = await api.get("/inventory/overview", {
    params: {
      search: params?.search || undefined,
      location_id: params?.locationId,
      category_id: params?.categoryId,
      health: params?.health && params.health !== "all" ? params.health : undefined,
      per_page: 1000,
    },
  });
  const d = response.data?.data ?? {};
  const counts = d.counts ?? {};
  const stats = d.stats ?? {};
  return {
    items: Array.isArray(d.items) ? d.items.map(normalizeOverviewRow) : [],
    total: Number(d.total ?? 0),
    counts: {
      all: Number(counts.all ?? 0),
      attention: Number(counts.attention ?? 0),
      ok: Number(counts.ok ?? 0),
      low: Number(counts.low ?? 0),
      out: Number(counts.out ?? 0),
      over: Number(counts.over ?? 0),
    },
    stats: {
      skus: Number(stats.skus ?? 0),
      units: Number(stats.units ?? 0),
      reserved: Number(stats.reserved ?? 0),
      stockValue: Number(stats.stockValue ?? 0),
      low: Number(stats.low ?? 0),
      out: Number(stats.out ?? 0),
      over: Number(stats.over ?? 0),
      ok: Number(stats.ok ?? 0),
      attention: Number(stats.attention ?? 0),
    },
    locations: Array.isArray(d.locations)
      ? d.locations.map((l: any) => ({ id: Number(l.id), name: l.name ?? "", isDefault: Boolean(l.isDefault) }))
      : [],
    categories: Array.isArray(d.categories)
      ? d.categories.map((c: any) => ({ id: Number(c.id), name: c.name ?? "" }))
      : [],
  };
}

// ─── Transfer documents (TR-xxxxxx) ───────────────────────────────────────────
// Cancelling a completed transfer moves the stock back and records a reversal transfer
// going the other way; the cancelled one shows "Returned via TR-…".

export const TRANSFER_REASONS = ["Restock store", "Rebalance stock", "Customer order pickup", "Return to warehouse"];

export interface TransferDocument {
  id: number;
  transferNo: string;
  status: "completed" | "cancelled";
  from: { id: number; name: string };
  to: { id: number; name: string };
  reason: string | null;
  sentWith: string | null;
  note: string | null;
  units: number;
  itemsSummary: string;
  lines: Array<{ productId: number; variantId: number | null; name: string; quantity: number }>;
  createdAt: string;
  createdBy: string | null;
  canCancel: boolean;
  isReversal: boolean;
  reversedBy: string | null;
}

function normalizeTransferDocument(d: any): TransferDocument {
  return {
    id: Number(d.id),
    transferNo: d.transferNo ?? `#${d.id}`,
    status: d.status === "cancelled" ? "cancelled" : "completed",
    from: { id: Number(d.from?.id ?? 0), name: d.from?.name ?? "" },
    to: { id: Number(d.to?.id ?? 0), name: d.to?.name ?? "" },
    reason: d.reason ?? null,
    sentWith: d.sentWith ?? null,
    note: d.note ?? null,
    units: Number(d.units ?? 0),
    itemsSummary: d.itemsSummary ?? "",
    lines: Array.isArray(d.lines)
      ? d.lines.map((l: any) => ({
          productId: Number(l.productId),
          variantId: l.variantId ?? null,
          name: l.name ?? "",
          quantity: Number(l.quantity ?? 0),
        }))
      : [],
    createdAt: d.createdAt ?? "",
    createdBy: d.createdBy ?? null,
    canCancel: Boolean(d.canCancel),
    isReversal: Boolean(d.isReversal),
    reversedBy: d.reversedBy ?? null,
  };
}

export async function getTransferDocuments(params?: {
  search?: string;
  status?: string;
  locationId?: number;
  page?: number;
  perPage?: number;
}): Promise<{ data: TransferDocument[]; total: number; stats: { count: number; unitsMoved: number } }> {
  const response = await api.get("/transfers/documents", {
    params: {
      search: params?.search || undefined,
      status: params?.status,
      location_id: params?.locationId,
      page: params?.page,
      per_page: params?.perPage ?? 50,
    },
  });
  const body = response.data ?? {};
  const d = body.data ?? [];
  const rows = Array.isArray(d) ? d : d.data ?? [];
  return {
    data: rows.map(normalizeTransferDocument),
    total: Number(body.meta?.total ?? d.total ?? rows.length),
    stats: {
      count: Number(body.meta?.stats?.count ?? rows.length),
      unitsMoved: Number(body.meta?.stats?.unitsMoved ?? 0),
    },
  };
}

export async function createTransferDocument(data: {
  fromLocationId: number;
  toLocationId: number;
  reason?: string;
  sentWith?: string;
  note?: string;
  items: Array<{ productId: number; variantId?: number; quantity: number }>;
}): Promise<TransferDocument> {
  const response = await api.post("/transfers/document", {
    fromLocationId: data.fromLocationId,
    toLocationId: data.toLocationId,
    reason: data.reason || undefined,
    sentWith: data.sentWith || undefined,
    note: data.note || undefined,
    items: data.items,
  });
  return normalizeTransferDocument(response.data?.data ?? {});
}

export async function cancelTransferDocument(id: number): Promise<TransferDocument> {
  const response = await api.put(`/transfers/documents/${id}/cancel`);
  return normalizeTransferDocument(response.data?.data ?? {});
}
