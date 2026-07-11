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

export interface ProductVariant {
  id: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  salePrice: number;
  offerPrice?: number;
  offerType?: string;
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
  costPrice?: number;
  profitMargin?: number;
  marginType?: string;
  stock: number;
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
  locationId?: number;
  vendorId?: number;
}

export interface ProductListResult {
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
  published?: boolean;
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
