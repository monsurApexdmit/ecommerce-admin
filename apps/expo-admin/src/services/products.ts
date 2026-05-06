import { api, getApiSession } from "@/lib/api";
import type {
  Product,
  ProductAttributeSelection,
  ProductDraft,
  ProductFileAsset,
  ProductImage,
  ProductInventoryItem,
  ProductListParams,
  ProductListResult,
  ProductReview,
  ProductReviewDistribution,
  ProductReviewListResult,
  ProductReviewReply,
  ProductStats,
  ProductVariant,
} from "@/types/product";

type ProductCategoryResponse = {
  id: number;
  category_name?: string;
  categoryName?: string;
  parent_id?: number | null;
  parentId?: number | null;
  status?: boolean;
};

type ProductLocationResponse = {
  id: number;
  name: string;
  address: string;
  contact_person?: string | null;
  contactPerson?: string | null;
  is_default?: boolean;
  isDefault?: boolean;
};

type ProductImageResponse = {
  id: number;
  path: string;
  position?: number;
  is_primary?: boolean;
  isPrimary?: boolean;
};

type ProductAttributeResponse = {
  id: number;
  name: string;
  display_name?: string;
  displayName?: string;
  option_type?: string;
  optionType?: string;
  values?: string;
  status?: boolean;
};

type ProductVariantResponse = {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number | string | null;
  sale_price?: number | string | null;
  salePrice?: number | string | null;
  cost_price?: number | string | null;
  costPrice?: number | string | null;
  profit_margin?: number | string | null;
  profitMargin?: number | string | null;
  margin_type?: string | null;
  marginType?: string | null;
  stock?: number | string | null;
  attributes?: Record<string, string> | string | null;
  inventory?: Array<{
    inventory_id?: number;
    warehouse_id?: number;
    quantity?: number | string | null;
  }>;
};

type ProductInventoryResponse = {
  inventory_id?: number;
  warehouse_id?: number;
  quantity?: number | string | null;
};

type ProductResponse = {
  id: number;
  name: string;
  description?: string | null;
  category?: string | ProductCategoryResponse | null;
  categoryId?: number | null;
  category_id?: number | null;
  categoryName?: string | null;
  location_id?: number | null;
  locationId?: number | null;
  location?: ProductLocationResponse | null;
  price?: number | string | null;
  sale_price?: number | string | null;
  salePrice?: number | string | null;
  offer_price?: number | string | null;
  offerPrice?: number | string | null;
  offer_type?: string | null;
  offerType?: string | null;
  cost_price?: number | string | null;
  costPrice?: number | string | null;
  profit_margin?: number | string | null;
  profitMargin?: number | string | null;
  margin_type?: string | null;
  marginType?: string | null;
  stock?: number | string | null;
  status?: string | null;
  published?: boolean | null;
  image?: string | null;
  images?: ProductImageResponse[] | null;
  sku?: string | null;
  barcode?: string | null;
  barcode_code?: string | null;
  vendor_id?: number | null;
  vendorId?: number | null;
  vendor_name?: string | null;
  vendorName?: string | null;
  vendor?: { id: number; name?: string | null } | null;
  receipt_number?: string | null;
  receiptNumber?: string | null;
  is_hot_deal?: boolean | null;
  isHotDeal?: boolean | null;
  is_best_seller?: boolean | null;
  isBestSeller?: boolean | null;
  is_featured?: boolean | null;
  isFeatured?: boolean | null;
  deal_label?: string | null;
  dealLabel?: string | null;
  attributes?: ProductAttributeResponse[] | null;
  variants?: ProductVariantResponse[] | null;
  inventory?: ProductInventoryResponse[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ProductReviewReplyResponse = {
  body: string;
  author_name?: string;
  authorName?: string;
  replied_at?: string | null;
  repliedAt?: string | null;
};

type ProductReviewResponse = {
  id: number;
  product_id: number;
  customer_id: number | null;
  customer_name: string;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  created_at: string | null;
  reply: ProductReviewReplyResponse | null;
};

type ProductReviewListResponse = {
  data: {
    summary: {
      average_rating: number;
      review_count: number;
      distribution: Array<{
        stars: number;
        count: number;
        percent: number;
      }>;
    };
    reviews: ProductReviewResponse[];
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeImages(product: ProductResponse): ProductImage[] {
  const images = Array.isArray(product.images) ? product.images : [];
  if (images.length > 0) {
    return images.map((image) => ({
      id: image.id,
      path: image.path,
      position: image.position,
      isPrimary: Boolean(image.isPrimary ?? image.is_primary),
    }));
  }

  if (product.image) {
    return [{ path: product.image, isPrimary: true }];
  }

  return [];
}

function normalizeInventory(items?: ProductInventoryResponse[] | null): ProductInventoryItem[] {
  return Array.isArray(items)
    ? items.map((item) => ({
        inventoryId: item.inventory_id,
        warehouseId: Number(item.warehouse_id ?? 0),
        quantity: toNumber(item.quantity),
      }))
    : [];
}

function normalizeAttributes(items?: ProductAttributeResponse[] | null): ProductAttributeSelection[] {
  return Array.isArray(items)
    ? items.map((item) => ({
        id: String(item.id),
        name: item.name,
        value: item.values
          ? item.values
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      }))
    : [];
}

function normalizeVariantAttributes(
  attributes?: ProductVariantResponse["attributes"],
): Record<string, string> {
  if (!attributes) return {};

  if (typeof attributes === "string") {
    try {
      const parsed = JSON.parse(attributes) as Record<string, string>;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  return attributes;
}

function normalizeVariants(items?: ProductVariantResponse[] | null): ProductVariant[] {
  return Array.isArray(items)
    ? items.map((variant) => ({
        id: String(variant.id),
        name: variant.name,
        attributes: normalizeVariantAttributes(variant.attributes),
        price: toNumber(variant.price),
        salePrice: toNumber(variant.salePrice ?? variant.sale_price),
        costPrice: variant.costPrice ?? variant.cost_price ? toNumber(variant.costPrice ?? variant.cost_price) : undefined,
        profitMargin:
          variant.profitMargin ?? variant.profit_margin
            ? toNumber(variant.profitMargin ?? variant.profit_margin)
            : undefined,
        marginType: variant.marginType ?? variant.margin_type ?? undefined,
        stock: toNumber(variant.stock),
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? undefined,
        inventory: Array.isArray(variant.inventory)
          ? variant.inventory.map((item) => ({
              inventoryId: item.inventory_id,
              warehouseId: Number(item.warehouse_id ?? 0),
              quantity: toNumber(item.quantity),
            }))
          : [],
      }))
    : [];
}

function normalizeReviewReply(reply: ProductReviewReplyResponse | null): ProductReviewReply | null {
  if (!reply) return null;

  return {
    body: reply.body,
    authorName: reply.authorName ?? reply.author_name ?? "Admin",
    repliedAt: reply.repliedAt ?? reply.replied_at ?? null,
  };
}

function normalizeReview(review: ProductReviewResponse): ProductReview {
  return {
    id: review.id,
    productId: review.product_id,
    customerId: review.customer_id,
    customerName: review.customer_name,
    rating: review.rating,
    comment: review.comment,
    verifiedPurchase: review.verified_purchase,
    createdAt: review.created_at,
    reply: normalizeReviewReply(review.reply),
  };
}

function normalizeDistribution(
  distribution: ProductReviewListResponse["data"]["summary"]["distribution"],
): ProductReviewDistribution[] {
  return Array.isArray(distribution)
    ? distribution.map((item) => ({
        stars: item.stars,
        count: item.count,
        percent: item.percent,
      }))
    : [];
}

function normalizeProduct(product: ProductResponse): Product {
  const categoryObject =
    typeof product.category === "object" && product.category !== null
      ? product.category
      : null;
  const categoryName =
    product.categoryName ??
    categoryObject?.categoryName ??
    categoryObject?.category_name ??
    (typeof product.category === "string" ? product.category : "");
  const categoryId = product.categoryId ?? product.category_id ?? categoryObject?.id ?? undefined;
  const locationId = product.locationId ?? product.location_id ?? product.location?.id ?? undefined;
  const primaryImage = normalizeImages(product).find((item) => item.isPrimary) ?? normalizeImages(product)[0];
  const stock = toNumber(product.stock);
  const salePrice = toNumber(product.salePrice ?? product.sale_price);
  const price = toNumber(product.price);

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    category: categoryName,
    categoryId: categoryId ?? undefined,
    price,
    salePrice,
    offerPrice: product.offerPrice ?? product.offer_price
      ? toNumber(product.offerPrice ?? product.offer_price) || undefined
      : undefined,
    offerType: product.offerType ?? product.offer_type ?? undefined,
    costPrice:
      product.costPrice ?? product.cost_price ? toNumber(product.costPrice ?? product.cost_price) : undefined,
    profitMargin:
      product.profitMargin ?? product.profit_margin
        ? toNumber(product.profitMargin ?? product.profit_margin)
        : undefined,
    marginType: product.marginType ?? product.margin_type ?? undefined,
    stock,
    status:
      (product.status as Product["status"]) ?? (stock > 0 ? "Selling" : "Out of Stock"),
    published: Boolean(product.published ?? true),
    isHotDeal: Boolean(product.isHotDeal ?? product.is_hot_deal),
    isBestSeller: Boolean(product.isBestSeller ?? product.is_best_seller),
    isFeatured: Boolean(product.isFeatured ?? product.is_featured),
    dealLabel: product.dealLabel ?? product.deal_label ?? undefined,
    image: primaryImage?.path,
    images: normalizeImages(product),
    sku: product.sku ?? undefined,
    barcode: product.barcode_code ?? product.barcode ?? undefined,
    receiptNumber: product.receiptNumber ?? product.receipt_number ?? undefined,
    vendorId: product.vendorId ?? product.vendor_id ?? undefined,
    vendorName: product.vendor?.name ?? product.vendorName ?? product.vendor_name ?? undefined,
    locationId,
    locationName: product.location?.name ?? undefined,
    attributes: normalizeAttributes(product.attributes),
    variants: normalizeVariants(product.variants),
    inventory: normalizeInventory(product.inventory),
    createdAt: product.createdAt ?? product.created_at ?? undefined,
    updatedAt: product.updatedAt ?? product.updated_at ?? undefined,
  };
}

function buildFormData(draft: ProductDraft) {
  const formData = new FormData();

  formData.append("name", draft.name);
  formData.append("description", draft.description ?? "");
  formData.append("category_id", String(draft.categoryId));
  formData.append("location_id", String(draft.locationId));
  formData.append("price", String(draft.price));
  formData.append("sale_price", String(draft.salePrice));
  formData.append("stock", String(draft.stock));

  if (draft.offerPrice !== undefined && draft.offerPrice > 0) {
    formData.append("offer_price", String(draft.offerPrice));
    formData.append("offer_type", draft.offerType ?? "percentage");
  } else {
    formData.append("offer_price", "");
    formData.append("offer_type", "");
  }

  if (draft.costPrice !== undefined) formData.append("cost_price", String(draft.costPrice));
  if (draft.profitMargin !== undefined) formData.append("profit_margin", String(draft.profitMargin));
  if (draft.marginType) formData.append("margin_type", draft.marginType);
  if (draft.sku) formData.append("sku", draft.sku);
  if (draft.barcode) formData.append("barcode", draft.barcode);
  if (draft.published !== undefined) formData.append("published", draft.published ? "true" : "false");
  if (draft.vendorId !== undefined) formData.append("vendor_id", String(draft.vendorId));
  if (draft.receiptNumber) formData.append("receipt_number", draft.receiptNumber);

  formData.append("is_hot_deal", draft.isHotDeal ? "1" : "0");
  formData.append("is_best_seller", draft.isBestSeller ? "1" : "0");
  formData.append("is_featured", draft.isFeatured ? "1" : "0");

  if (draft.dealLabel !== undefined) {
    formData.append("deal_label", draft.dealLabel);
  }

  if (draft.attributes?.length) {
    const attributeIds = draft.attributes.map((attribute) => Number(attribute.id));
    formData.append("attributes", JSON.stringify(attributeIds));
  }

  if (draft.variants?.length) {
    formData.append(
      "variants",
      JSON.stringify(
        draft.variants.map((variant) => ({
          id: /^\d+$/.test(variant.id) ? Number(variant.id) : undefined,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
          price: variant.price,
          sale_price: variant.salePrice,
          cost_price: variant.costPrice,
          profit_margin: variant.profitMargin,
          margin_type: variant.marginType,
          stock: variant.stock,
          attributes: variant.attributes,
        })),
      ),
    );
  }

  if (draft.deleteImages) {
    formData.append("delete_images", "1");
  }

  if (draft.keepImages?.length) {
    draft.keepImages.forEach((path) => {
      formData.append("keep_images[]", path);
    });
  }

  if (draft.localImages?.length) {
    draft.localImages.forEach((image, index) => {
      formData.append(`image[${index}]`, image as unknown as Blob);
    });
  }

  return formData;
}

async function sendMultipart<T>(method: "POST" | "PUT", path: string, draft: ProductDraft): Promise<T> {
  const session = getApiSession();
  const baseURL = api.defaults.baseURL ?? "";
  const companyId = session?.companyId;
  const url = `${baseURL}${path}${companyId ? `${path.includes("?") ? "&" : "?"}company_id=${companyId}` : ""}`;
  const formData = buildFormData(draft);

  const response = await fetch(url, {
    method,
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : undefined,
    body: formData,
  });

  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? "Request failed");
  }

  return payload;
}

export async function getProducts(params?: ProductListParams): Promise<ProductListResult> {
  const response = await api.get("/products", {
    params: {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      status: params?.status,
      category_id: params?.categoryId,
      location_id: params?.locationId,
      vendor_id: params?.vendorId,
    },
  });

  const laravelData = response.data?.data ?? {};
  const items = Array.isArray(laravelData) ? laravelData : Array.isArray(laravelData.data) ? laravelData.data : [];
  const total = laravelData.total ?? items.length;
  const page = laravelData.current_page ?? params?.page ?? 1;
  const limit = laravelData.per_page ?? params?.limit ?? items.length ?? 20;
  const totalPages = laravelData.last_page ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return {
    data: items.map(normalizeProduct),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

export async function getProductById(id: number): Promise<Product> {
  const response = await api.get<{ data: ProductResponse }>(`/products/${id}`);
  return normalizeProduct(response.data.data);
}

export async function createProduct(draft: ProductDraft): Promise<Product> {
  const response = await sendMultipart<{ data: ProductResponse }>("POST", "/products", draft);
  return normalizeProduct(response.data);
}

export async function updateProduct(id: number, draft: ProductDraft): Promise<Product> {
  const response = await sendMultipart<{ data: ProductResponse }>("PUT", `/products/${id}`, draft);
  return normalizeProduct(response.data);
}

export async function deleteProduct(id: number) {
  await api.delete(`/products/${id}`);
}

export async function updateProductStatus(id: number, published: boolean) {
  const product = await getProductById(id);
  return updateProduct(id, {
    name: product.name,
    description: product.description,
    category: product.category,
    categoryId: product.categoryId ?? 0,
    locationId: product.locationId ?? product.inventory[0]?.warehouseId ?? 0,
    price: product.price,
    salePrice: product.salePrice,
    costPrice: product.costPrice,
    profitMargin: product.profitMargin,
    marginType: product.marginType,
    stock: product.stock,
    published,
    isHotDeal: product.isHotDeal,
    isBestSeller: product.isBestSeller,
    isFeatured: product.isFeatured,
    dealLabel: product.dealLabel,
    sku: product.sku,
    barcode: product.barcode,
    receiptNumber: product.receiptNumber,
    vendorId: product.vendorId,
    attributes: product.attributes,
    variants: product.variants,
    keepImages: product.images.map((image) => image.path),
  });
}

export async function getProductStats(): Promise<ProductStats> {
  const response = await api.get<{ data: ProductStats }>("/products/stats");
  return response.data.data;
}

export async function getProductReviews(
  id: number,
  perPage = 50,
): Promise<ProductReviewListResult> {
  const response = await api.get<ProductReviewListResponse>(`/store/products/${id}/reviews`, {
    params: { per_page: perPage },
  });

  return {
    summary: {
      averageRating: response.data.data.summary.average_rating,
      reviewCount: response.data.data.summary.review_count,
      distribution: normalizeDistribution(response.data.data.summary.distribution),
    },
    reviews: response.data.data.reviews.map(normalizeReview),
    meta: {
      currentPage: response.data.meta.current_page,
      lastPage: response.data.meta.last_page,
      perPage: response.data.meta.per_page,
      total: response.data.meta.total,
    },
  };
}

export async function replyToProductReview(
  productId: number,
  reviewId: number,
  reply: string,
) {
  await api.post(`/products/${productId}/reviews/${reviewId}/reply`, { reply });
}

export function buildProductFileAsset(asset: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): ProductFileAsset {
  return {
    uri: asset.uri,
    name: asset.fileName ?? `image-${Date.now()}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  };
}
