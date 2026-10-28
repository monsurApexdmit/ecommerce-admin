/**
 * Collection API Service — proxied through the Next.js route.
 * Collections are curated product groups for the storefront (manual picks or rule-based).
 */

import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';
import { resolveStorageUrl } from './settingsApi';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type CollectionType = 'manual' | 'automatic';
export type CollectionMatch = 'all' | 'any';
export type CollectionProductSort = 'manual' | 'best_selling' | 'price_asc' | 'price_desc' | 'newest' | 'name';

export type CollectionRuleField =
  | 'category' | 'brand' | 'tag' | 'flag' | 'price' | 'on_offer' | 'new_arrivals' | 'best_sellers' | 'in_stock';

/**
 * One rule (see COLLECTIONS_API_CONTRACT.md §4).
 * value: category/brand id, tag text, flag name, price, days (new_arrivals), `true` (on_offer/in_stock),
 * or `{ limit, days }` (best_sellers).
 */
export interface CollectionRule {
  field: CollectionRuleField;
  operator?: string;
  value?: string | number | boolean | { limit: number | string; days: number | string } | null;
}

export interface CollectionProduct {
  id: number;
  name: string;
  sku?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  salePrice?: number | null;
  /** What a buyer pays now (sale price lowered by a live offer). */
  effectivePrice?: number | null;
  offerActive?: boolean;
  stock?: number | null;
  categoryName?: string | null;
  brandName?: string | null;
  published?: boolean;
  visibleOnline?: boolean;
  /** false when the storefront will hide it (not published or not visible online). */
  visibleOnStorefront?: boolean;
  unitsSold?: number | null;
  position?: number;
}

export interface CollectionResponse {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  type: CollectionType;
  match: CollectionMatch;
  rules: CollectionRule[];
  sortOrder: number;
  productSort: CollectionProductSort;
  isPublished: boolean;
  showOnHomepage: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  productCount: number;
  /** Products the storefront will show (published + visible online). */
  visibleProductCount: number;
  productIds?: number[];
  products?: CollectionProduct[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionPayload {
  name: string;
  slug?: string;
  description?: string | null;
  type: CollectionType;
  match?: CollectionMatch;
  rules?: CollectionRule[];
  productSort?: CollectionProductSort;
  isPublished?: boolean;
  showOnHomepage?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  productIds?: number[];
  imageFile?: File | null;
  /** true clears the stored image (sends image: null). */
  removeImage?: boolean;
}

export interface CollectionPreview {
  total: number;
  visibleTotal: number;
  products: CollectionProduct[];
  hint: string | null;
}

const num = (v: any): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

export const normalizeCollectionProduct = (p: any): CollectionProduct => ({
  id: Number(p?.id),
  name: p?.name ?? '',
  sku: p?.sku ?? null,
  imageUrl: resolveStorageUrl(p?.imageUrl ?? p?.image_url ?? p?.image) || null,
  price: num(p?.price),
  salePrice: num(p?.salePrice ?? p?.sale_price),
  effectivePrice: num(p?.effectivePrice ?? p?.effective_price),
  offerActive: p?.offerActive ?? p?.offer_active ?? undefined,
  stock: num(p?.stock),
  categoryName: p?.categoryName ?? p?.category_name ?? null,
  brandName: p?.brandName ?? p?.brand_name ?? null,
  published: p?.published ?? undefined,
  visibleOnline: p?.visibleOnline ?? p?.visible_online ?? undefined,
  visibleOnStorefront: p?.visibleOnStorefront ?? undefined,
  unitsSold: num(p?.unitsSold),
  position: p?.position ?? undefined,
});

const normalizeRule = (r: any): CollectionRule => ({
  field: r?.field,
  operator: r?.operator ?? undefined,
  value: r?.value ?? null,
});

export const normalizeCollection = (c: any): CollectionResponse => {
  const rawProducts = c?.manualProducts ?? c?.products;
  const products = Array.isArray(rawProducts) ? rawProducts.map(normalizeCollectionProduct) : undefined;
  return {
    id: Number(c?.id),
    name: c?.name ?? '',
    slug: c?.slug ?? '',
    description: c?.description ?? null,
    image: c?.image ?? null,
    imageUrl: c?.imageUrl ?? c?.image_url ?? null,
    type: (c?.type ?? 'manual') as CollectionType,
    match: (c?.match ?? 'all') as CollectionMatch,
    rules: Array.isArray(c?.rules) ? c.rules.map(normalizeRule) : [],
    sortOrder: Number(c?.sortOrder ?? c?.sort_order ?? 0),
    productSort: (c?.productSort ?? c?.product_sort ?? 'manual') as CollectionProductSort,
    isPublished: !!(c?.isPublished ?? c?.is_published),
    showOnHomepage: !!(c?.showOnHomepage ?? c?.show_on_homepage),
    seoTitle: c?.seoTitle ?? c?.seo_title ?? null,
    seoDescription: c?.seoDescription ?? c?.seo_description ?? null,
    productCount: Number(c?.productCount ?? c?.products_count ?? c?.product_count ?? 0),
    visibleProductCount: Number(c?.visibleProductCount ?? c?.productCount ?? 0),
    productIds: Array.isArray(c?.productIds) ? c.productIds.map(Number) : products?.map((p: CollectionProduct) => p.id),
    products,
    createdAt: c?.createdAt ?? c?.created_at,
    updatedAt: c?.updatedAt ?? c?.updated_at,
  };
};

/** JSON body, or multipart when an image file is attached (rules/productIds as JSON strings, per the contract). */
const toBody = (data: Partial<CollectionPayload>) => {
  const { imageFile, removeImage, ...rest } = data;
  if (!imageFile) {
    const body: any = { ...rest };
    if (removeImage) body.image = null;
    return { body, multipart: false };
  }
  const fd = new FormData();
  Object.entries(rest).forEach(([k, v]) => {
    if (v === undefined) return;
    if (k === 'rules' || k === 'productIds') fd.append(k, JSON.stringify(v ?? []));
    else if (typeof v === 'boolean') fd.append(k, v ? '1' : '0');
    else fd.append(k, v === null ? '' : String(v));
  });
  fd.append('image', imageFile);
  return { body: fd, multipart: true };
};

const multipartHeaders = { headers: { 'Content-Type': 'multipart/form-data' } };

const normalizePreview = (d: any): CollectionPreview => {
  const list = d?.products ?? d?.data ?? [];
  const total = Number(d?.total ?? list.length);
  return {
    total,
    visibleTotal: Number(d?.visibleTotal ?? total),
    products: list.map(normalizeCollectionProduct),
    hint: d?.hint ?? null,
  };
};

export const collectionApi = {
  getAll: async (params?: { search?: string; type?: string; published?: string; page?: number; limit?: number }): Promise<{ data: CollectionResponse[]; total: number; lastPage: number }> => {
    const res = await api.get('/collections', { params });
    const d = res.data?.data ?? {};
    const list = Array.isArray(d) ? d : (d.data ?? []);
    return {
      data: list.map(normalizeCollection),
      total: Array.isArray(d) ? list.length : (d.total ?? list.length),
      lastPage: Array.isArray(d) ? 1 : Number(d.last_page ?? d.lastPage ?? 1),
    };
  },

  /** Every collection in list order (walks all pages; the API caps limit at 100). */
  listAll: async (): Promise<CollectionResponse[]> => {
    const out: CollectionResponse[] = [];
    for (let page = 1; page <= 50; page++) {
      const r = await collectionApi.getAll({ page, limit: 100 });
      out.push(...r.data);
      if (page >= r.lastPage || r.data.length === 0) break;
    }
    return out;
  },

  getById: async (id: number): Promise<CollectionResponse> => {
    const res = await api.get(`/collections/${id}`);
    return normalizeCollection(res.data?.data ?? res.data);
  },

  create: async (data: CollectionPayload): Promise<CollectionResponse> => {
    const { body, multipart } = toBody(data);
    const res = await api.post('/collections', body, multipart ? multipartHeaders : undefined);
    return normalizeCollection(res.data?.data ?? res.data);
  },

  update: async (id: number, data: Partial<CollectionPayload>): Promise<CollectionResponse> => {
    const { body, multipart } = toBody(data);
    const res = multipart
      ? await api.post(`/collections/${id}`, body, multipartHeaders)
      : await api.put(`/collections/${id}`, body);
    return normalizeCollection(res.data?.data ?? res.data);
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const res = await api.delete(`/collections/${id}`);
    return res.data;
  },

  setProducts: async (id: number, productIds: number[]): Promise<CollectionResponse> => {
    const res = await api.put(`/collections/${id}/products`, { productIds });
    return normalizeCollection(res.data?.data ?? res.data);
  },

  /** Publish / unpublish. */
  setStatus: async (id: number, data: { isPublished: boolean }): Promise<CollectionResponse> => {
    const res = await api.patch(`/collections/${id}/status`, data);
    return normalizeCollection(res.data?.data ?? res.data);
  },

  reorder: async (ids: number[]): Promise<void> => {
    await api.post('/collections/reorder', { ids });
  },

  /** Preview an unsaved definition (nothing is saved). */
  preview: async (data: { type: CollectionType; match?: CollectionMatch; rules?: CollectionRule[]; productIds?: number[]; productSort?: CollectionProductSort; limit?: number }, signal?: AbortSignal): Promise<CollectionPreview> => {
    const res = await api.post('/collections/preview', data, { signal });
    return normalizePreview(res.data?.data);
  },

  /** Products of a saved collection (paged). */
  previewProducts: async (id: number, params?: { page?: number; limit?: number; sort?: string }): Promise<CollectionPreview> => {
    const res = await api.get(`/collections/${id}/preview-products`, { params });
    return normalizePreview(res.data?.data);
  },
};

/** First validation message from a Laravel 422 (or the plain message). */
export const apiErrorMessage = (err: any, fallback = 'Please try again'): string => {
  const errors = err?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat()[0];
    if (first) return String(first);
  }
  return err?.response?.data?.message || err?.message || fallback;
};

/** Laravel 422 errors keyed by field (first message each). */
export const apiFieldErrors = (err: any): Record<string, string> => {
  const errors = err?.response?.data?.errors;
  if (!errors || typeof errors !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(errors).forEach(([k, v]) => { out[k] = Array.isArray(v) ? String(v[0]) : String(v); });
  return out;
};

export default collectionApi;
