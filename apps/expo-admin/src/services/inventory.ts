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
    const pagination = response.data?.meta?.pagination ?? {};
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
