import { api, getApiSession } from "@/lib/api";
import type {
  Collection,
  CollectionDraft,
  CollectionListParams,
  CollectionListResult,
  CollectionMatch,
  CollectionPreview,
  CollectionProductLite,
  CollectionProductSort,
  CollectionRule,
  CollectionType,
} from "@/types/collection";

const PRODUCT_SORTS: CollectionProductSort[] = ["manual", "best_selling", "price_asc", "price_desc", "newest", "name"];

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** AdminProduct (contract 3.3) -> picker/list row. */
function normalizeProductLite(raw: any, index = 0): CollectionProductLite {
  const p = raw?.product ?? raw ?? {};
  const image =
    p.imageUrl ?? p.image_url ?? p.image ?? p.thumbnail ??
    (Array.isArray(p.images) && p.images.length > 0 ? (p.images[0]?.path ?? p.images[0]?.url ?? p.images[0]) : null);
  const price = p.effectivePrice ?? p.effective_price ?? p.currentPrice ?? p.salePrice ?? p.sale_price ?? p.price;
  const published = p.published === undefined ? undefined : bool(p.published);
  const visibleOnline =
    p.visibleOnline === undefined && p.visible_online === undefined ? undefined : bool(p.visibleOnline ?? p.visible_online);
  const storefront = p.visibleOnStorefront ?? p.visible_on_storefront;
  return {
    id: num(p.id ?? raw?.productId ?? raw?.product_id),
    name: p.name ?? p.productName ?? p.product_name ?? "",
    image: typeof image === "string" ? image : null,
    price: price === undefined || price === null ? undefined : num(price),
    sku: p.sku ?? undefined,
    published,
    visibleOnline,
    stock: p.stock === undefined || p.stock === null ? undefined : num(p.stock),
    visibleOnStorefront:
      storefront !== undefined
        ? bool(storefront)
        : published === undefined && visibleOnline === undefined
          ? undefined
          : published !== false && visibleOnline !== false,
    position: num(raw?.position ?? raw?.pivot?.position ?? index + 1, index + 1),
  };
}

/** API rule -> editor rule (best sellers' `{limit, days}` is split into value + days). */
function normalizeRule(raw: any): CollectionRule {
  const field = raw?.field ?? "category";
  const operator = raw?.operator ?? undefined;
  if (field === "best_sellers") {
    const v = raw?.value;
    const limit = v && typeof v === "object" ? v.limit : v;
    const days = v && typeof v === "object" ? v.days : raw?.days;
    return { field, operator, value: limit === undefined || limit === null ? null : num(limit), days: days === undefined || days === null ? null : num(days) };
  }
  return { field, operator, value: raw?.value ?? null };
}

function parseRules(raw: unknown): CollectionRule[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  const list = Array.isArray(value) ? value : [];
  return list.map(normalizeRule);
}

export function normalizeCollection(raw: any): Collection {
  const type: CollectionType = raw?.type === "automatic" ? "automatic" : "manual";
  const rawMatch = raw?.match ?? raw?.rules?.match;
  const match: CollectionMatch = rawMatch === "any" ? "any" : "all";
  const sort = raw?.productSort ?? raw?.product_sort;
  const productsRaw: any[] = Array.isArray(raw?.manualProducts)
    ? raw.manualProducts
    : Array.isArray(raw?.products)
      ? raw.products
      : [];
  const products = productsRaw
    .map((p, i) => normalizeProductLite(p, i))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const idsRaw = raw?.productIds ?? raw?.product_ids;
  const productIds: number[] = Array.isArray(idsRaw)
    ? idsRaw.map((v: any) => num(typeof v === "object" ? v?.id ?? v?.productId ?? v?.product_id : v))
    : products.map((p) => p.id);

  return {
    id: num(raw?.id),
    name: raw?.name ?? "",
    slug: raw?.slug ?? "",
    description: raw?.description ?? "",
    image: raw?.image ?? null,
    imageUrl: raw?.imageUrl ?? raw?.image_url ?? null,
    type,
    match,
    rules: parseRules(raw?.rules),
    sortOrder: num(raw?.sortOrder ?? raw?.sort_order),
    productSort: PRODUCT_SORTS.includes(sort) ? sort : type === "manual" ? "manual" : "best_selling",
    isPublished: bool(raw?.isPublished ?? raw?.is_published ?? raw?.published),
    showOnHomepage: bool(raw?.showOnHomepage ?? raw?.show_on_homepage),
    seoTitle: raw?.seoTitle ?? raw?.seo_title ?? "",
    seoDescription: raw?.seoDescription ?? raw?.seo_description ?? "",
    productCount: num(raw?.productCount ?? raw?.product_count ?? raw?.productsCount ?? raw?.products_count ?? productIds.length),
    visibleProductCount:
      raw?.visibleProductCount === undefined || raw?.visibleProductCount === null ? undefined : num(raw.visibleProductCount),
    productIds,
    products,
    createdAt: raw?.createdAt ?? raw?.created_at,
    updatedAt: raw?.updatedAt ?? raw?.updated_at,
  };
}

/** Editor rules -> API rules (contract section 4). */
function serializeRules(rules: CollectionRule[]) {
  return rules.map((rule) => {
    switch (rule.field) {
      case "category":
      case "brand":
        return { field: rule.field, operator: rule.operator ?? "is", value: num(rule.value) };
      case "price":
        return { field: rule.field, operator: rule.operator ?? "greater_than", value: num(rule.value) };
      case "tag":
        return { field: rule.field, operator: rule.operator ?? "equals", value: String(rule.value ?? "").trim() };
      case "flag":
        return { field: rule.field, operator: rule.operator ?? "is", value: rule.value ?? "best_seller" };
      case "new_arrivals":
        return { field: rule.field, operator: "within_days", value: num(rule.value) };
      case "best_sellers":
        return { field: rule.field, operator: "top", value: { limit: num(rule.value), days: num(rule.days) } };
      case "on_offer":
      case "in_stock":
        return { field: rule.field, operator: "is", value: true };
      default:
        return { field: rule.field, operator: rule.operator, value: rule.value };
    }
  });
}

function draftToBody(draft: CollectionDraft) {
  return {
    name: draft.name.trim(),
    slug: draft.slug?.trim() || undefined,
    description: draft.description ?? "",
    type: draft.type,
    match: draft.match,
    rules: draft.type === "automatic" ? serializeRules(draft.rules) : [],
    productSort: draft.productSort,
    isPublished: draft.isPublished,
    showOnHomepage: draft.showOnHomepage,
    seoTitle: draft.seoTitle ?? "",
    seoDescription: draft.seoDescription ?? "",
    ...(draft.type === "manual" && draft.productIds ? { productIds: draft.productIds } : {}),
    // `image: null` clears the stored image (only when no new file is attached).
    ...(draft.removeImage && !draft.imageFile ? { image: null } : {}),
  };
}

/** Multipart create/update when a new image file is attached (fetch handles RN file parts). */
async function sendMultipart(path: string, draft: CollectionDraft): Promise<any> {
  const session = getApiSession();
  const baseURL = api.defaults.baseURL ?? "";
  const companyId = session?.companyId;
  const url = `${baseURL}${path}${companyId ? `?company_id=${companyId}` : ""}`;
  const body = draftToBody(draft);
  const form = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "boolean") form.append(key, value ? "1" : "0");
    else if (Array.isArray(value) || typeof value === "object") form.append(key, JSON.stringify(value));
    else form.append(key, String(value));
  });
  if (draft.imageFile) {
    form.append("image", draft.imageFile as unknown as Blob);
  }
  // PHP only parses multipart bodies on POST — the API accepts POST /collections/{id} as an update.

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload) {
    // Shape the error like axios so apiErrorMessage() reads it.
    const error: any = new Error(payload?.message ?? `Request failed (${response.status})`);
    error.response = { status: response.status, data: payload ?? {} };
    throw error;
  }
  return payload;
}

export async function getCollections(params?: CollectionListParams): Promise<CollectionListResult> {
  const response = await api.get("/collections", {
    params: {
      page: params?.page,
      limit: params?.limit,
      search: params?.search || undefined,
      type: params?.type,
      published: params?.published === undefined ? undefined : params.published ? "true" : "false",
    },
  });

  const body = response.data ?? {};
  const payload = body.data ?? {};
  const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
  const meta = body.meta ?? payload.meta ?? payload;
  const total = num(meta.total ?? items.length, items.length);
  const page = num(meta.current_page ?? meta.currentPage ?? meta.page ?? params?.page ?? 1, 1);
  const perPage = num(meta.per_page ?? meta.perPage ?? params?.limit ?? (items.length || 20), 20);
  const totalPages = num(meta.last_page ?? meta.lastPage ?? meta.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, perPage))), 1);

  return { data: items.map(normalizeCollection), total, page, totalPages };
}

export async function getCollection(id: number): Promise<Collection> {
  const response = await api.get(`/collections/${id}`);
  return normalizeCollection(response.data?.data ?? response.data);
}

export async function createCollection(draft: CollectionDraft): Promise<Collection> {
  if (draft.imageFile) {
    const payload = await sendMultipart("/collections", draft);
    return normalizeCollection(payload.data ?? payload);
  }
  const response = await api.post("/collections", draftToBody(draft));
  return normalizeCollection(response.data?.data ?? response.data);
}

export async function updateCollection(id: number, draft: CollectionDraft): Promise<Collection> {
  if (draft.imageFile) {
    const payload = await sendMultipart(`/collections/${id}`, draft);
    return normalizeCollection(payload.data ?? payload);
  }
  const response = await api.put(`/collections/${id}`, draftToBody(draft));
  return normalizeCollection(response.data?.data ?? response.data);
}

export async function deleteCollection(id: number) {
  await api.delete(`/collections/${id}`);
}

/** Manual collections: replace the product list (order = position). */
export async function setCollectionProducts(id: number, productIds: number[]): Promise<Collection> {
  const response = await api.put(`/collections/${id}/products`, { productIds });
  return normalizeCollection(response.data?.data ?? response.data);
}

export async function updateCollectionStatus(id: number, isPublished: boolean): Promise<Collection | null> {
  const response = await api.patch(`/collections/${id}/status`, { isPublished });
  const data = response.data?.data;
  return data && typeof data === "object" && "id" in data ? normalizeCollection(data) : null;
}

export async function reorderCollections(ids: number[]) {
  await api.post("/collections/reorder", { ids });
}

function normalizePreview(data: any): CollectionPreview {
  const list: any[] = Array.isArray(data?.products) ? data.products : Array.isArray(data?.data) ? data.data : [];
  return {
    total: num(data?.total ?? list.length, list.length),
    visibleTotal: data?.visibleTotal === undefined || data?.visibleTotal === null ? undefined : num(data.visibleTotal),
    hint: typeof data?.hint === "string" ? data.hint : null,
    products: list.map((p, i) => normalizeProductLite(p, i)),
  };
}

/** Live preview of an unsaved definition: total matches + first few products. */
export async function previewCollection(input: {
  type: CollectionType;
  match: CollectionMatch;
  rules?: CollectionRule[];
  productIds?: number[];
  productSort?: CollectionProductSort;
  limit?: number;
}): Promise<CollectionPreview> {
  const response = await api.post("/collections/preview", {
    type: input.type,
    match: input.match,
    ...(input.type === "automatic" ? { rules: serializeRules(input.rules ?? []) } : { productIds: input.productIds ?? [] }),
    ...(input.productSort ? { productSort: input.productSort } : {}),
    limit: input.limit ?? 6,
  });
  return normalizePreview(response.data?.data ?? {});
}

/** Products of a saved collection (paged). */
export async function getCollectionProducts(id: number, params?: { page?: number; limit?: number }): Promise<CollectionPreview> {
  const response = await api.get(`/collections/${id}/preview-products`, {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 20 },
  });
  return normalizePreview(response.data?.data ?? {});
}
