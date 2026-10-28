export type ProductStatus = "Selling" | "Out of Stock" | "Discontinued";

export interface ProductCategory {
  id: number;
  categoryName: string;
  parentId: number | null;
  status: boolean;
}

export interface ProductLocation {
  id: number;
  name: string;
  address: string;
  contactPerson?: string | null;
  isDefault: boolean;
}

export interface ProductImage {
  id?: number;
  path: string;
  position?: number;
  isPrimary?: boolean;
  uri?: string;
}

export interface ProductInventoryItem {
  inventoryId?: number;
  warehouseId: number;
  quantity: number;
}

export interface ProductAttributeDefinition {
  id: number;
  name: string;
  displayName: string;
  optionType: "dropdown" | "radio" | "text";
  values: string[];
  status: boolean;
}

export interface ProductAttributeSelection {
  id: string;
  name: string;
  value: string | string[];
}

export type ProductStockState = "ok" | "low" | "out";

export interface ProductStockByLocation {
  locationId: number;
  locationName: string;
  quantity: number;
}

export interface ProductTabCounts {
  all: number;
  ok: number;
  low: number;
  out: number;
  hidden: number;
  draft: number;
}

export type ProductListTab = keyof ProductTabCounts;

export interface ProductVariant {
  id: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  salePrice: number;
  offerPrice?: number;
  offerType?: string;
  /** Server-computed: true only while the offer is running. */
  offerActive?: boolean;
  /** Server-computed selling price (offer applied when active). */
  currentPrice?: number;
  costPrice?: number;
  profitMargin?: number;
  marginType?: string;
  stock: number;
  sku: string;
  barcode?: string;
  inventory?: ProductInventoryItem[];
}

export interface ProductReviewReply {
  body: string;
  authorName: string;
  repliedAt: string | null;
}

export interface ProductReview {
  id: number;
  productId: number;
  customerId: number | null;
  customerName: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string | null;
  reply: ProductReviewReply | null;
}

export interface ProductReviewDistribution {
  stars: number;
  count: number;
  percent: number;
}

export interface ProductReviewSummary {
  averageRating: number;
  reviewCount: number;
  distribution: ProductReviewDistribution[];
}

export interface ProductStats {
  total: number;
  published: number;
  unpublished: number;
}

export interface ProductFileAsset {
  uri: string;
  name: string;
  type: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  categoryId?: number;
  price: number;
  salePrice: number;
  offerPrice?: number;
  offerType?: string;
  offerEndsAt?: string;
  /** Server-computed: true only while the offer is running. */
  offerActive?: boolean;
  /** Server-computed selling price (offer applied when active). */
  currentPrice?: number;
  costPrice?: number;
  profitMargin?: number;
  marginType?: string;
  stock: number;
  /** ok | low | out — reorderPoint 0 means the low-stock alert is off. */
  stockState?: ProductStockState;
  reorderPoint?: number;
  stockByLocation?: ProductStockByLocation[];
  availableInPos?: boolean;
  visibleOnline?: boolean;
  tag?: string;
  status: ProductStatus;
  published: boolean;
  isHotDeal?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  dealLabel?: string;
  image?: string;
  images: ProductImage[];
  sku?: string;
  barcode?: string;
  receiptNumber?: string;
  vendorId?: number;
  vendorName?: string;
  locationId?: number;
  locationName?: string;
  attributes: ProductAttributeSelection[];
  variants: ProductVariant[];
  inventory: ProductInventoryItem[];
  isBundle?: boolean;
  bundlePriceOverride?: number;
  bundleItems?: BundleItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: number;
  /** Legacy: products whose home location is X. */
  locationId?: number;
  /** Warehouse for stock evaluation (stock, stockState, tab, sort). */
  stockLocationId?: number;
  vendorId?: number;
  tab?: ProductListTab;
  sort?: "recent" | "name" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
  published?: boolean;
  /** Only products available in POS. */
  pos?: boolean;
}

export interface ProductListResult {
  tabCounts?: ProductTabCounts;
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ProductReviewListResult {
  summary: ProductReviewSummary;
  reviews: ProductReview[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

export interface BundleItem {
  productId: number;
  productName: string;
  productSku: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
}

export interface ProductDraft {
  name: string;
  description?: string;
  category: string;
  categoryId: number;
  locationId: number;
  price: number;
  salePrice: number;
  offerPrice?: number;
  offerType?: string;
  costPrice?: number;
  profitMargin?: number;
  marginType?: string;
  stock: number;
  reorderPoint?: number;
  published?: boolean;
  availableInPos?: boolean;
  visibleOnline?: boolean;
  tag?: string;
  isHotDeal?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  dealLabel?: string;
  sku?: string;
  barcode?: string;
  receiptNumber?: string;
  vendorId?: number;
  attributes?: ProductAttributeSelection[];
  variants?: ProductVariant[];
  inventory?: ProductInventoryItem[];
  localImages?: ProductFileAsset[];
  keepImages?: string[];
  deleteImages?: boolean;
  isBundle?: boolean;
  bundlePriceOverride?: number;
  bundleItems?: BundleItem[];
}

export interface ProductReviewReplyPayload {
  reply: string;
}
