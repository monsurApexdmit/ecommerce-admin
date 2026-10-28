export type CollectionType = "manual" | "automatic";
export type CollectionMatch = "all" | "any";
export type CollectionProductSort =
  | "manual"
  | "best_selling"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "name";

export type CollectionRuleField =
  | "category"
  | "brand"
  | "tag"
  | "flag"
  | "price"
  | "on_offer"
  | "new_arrivals"
  | "best_sellers"
  | "in_stock";

export type CollectionRuleOperator =
  | "is"
  | "is_not"
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "within_days"
  | "top";

export interface CollectionRule {
  field: CollectionRuleField;
  operator?: CollectionRuleOperator;
  /**
   * category/brand id, tag text, flag key, price amount, new-arrivals days, or best-sellers top N
   * (best sellers are sent as `{limit, days}` — see services/collections).
   */
  value?: string | number | boolean | null;
  /** Best sellers: look-back window in days. */
  days?: number | null;
}

export interface CollectionProductLite {
  id: number;
  name: string;
  image?: string | null;
  price?: number;
  sku?: string;
  published?: boolean;
  visibleOnline?: boolean;
  stock?: number;
  /** Published + visible online (would appear on the storefront). */
  visibleOnStorefront?: boolean;
  position?: number;
}

export interface Collection {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  imageUrl: string | null;
  type: CollectionType;
  match: CollectionMatch;
  rules: CollectionRule[];
  sortOrder: number;
  productSort: CollectionProductSort;
  isPublished: boolean;
  showOnHomepage: boolean;
  seoTitle: string;
  seoDescription: string;
  productCount: number;
  /** Products the storefront will show (published + visible online). */
  visibleProductCount?: number;
  /** Manual collections: product ids in display order. */
  productIds: number[];
  /** Manual collections: products in display order (when the API embeds them). */
  products: CollectionProductLite[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: CollectionType;
  published?: boolean;
}

export interface CollectionListResult {
  data: Collection[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CollectionImageFile {
  uri: string;
  name: string;
  type: string;
}

export interface CollectionDraft {
  name: string;
  slug?: string;
  description?: string;
  type: CollectionType;
  match: CollectionMatch;
  rules: CollectionRule[];
  productSort: CollectionProductSort;
  isPublished: boolean;
  showOnHomepage: boolean;
  seoTitle?: string;
  seoDescription?: string;
  /** New image to upload. */
  imageFile?: CollectionImageFile | null;
  /** True to clear the existing image (sent as `image: null`). */
  removeImage?: boolean;
  /** Manual collections: ordered product ids. */
  productIds?: number[];
}

export interface CollectionPreview {
  total: number;
  visibleTotal?: number;
  /** e.g. "1 matching product is hidden on the storefront…" — null when nothing is hidden. */
  hint?: string | null;
  products: CollectionProductLite[];
}
