export interface CartItem {
  key: string;
  productId: number;
  variantId?: number;
  inventoryId?: number;
  categoryId?: number;
  name: string;
  variantName?: string;
  /** Current selling price from the server (`currentPrice`): sale price, or the live offer price. */
  price: number;
  /** Regular price, shown struck through when an offer is live */
  regularPrice?: number;
  wholesalePrice?: number;
  minWholesaleQty?: number;
  image?: string;
  quantity: number;
  stock: number;
}

/** POS product (GET /products?pos=1): prices already resolved by the server. */
export interface PosVariant {
  id: number;
  name: string;
  /** `currentPrice` (an expired offer is already ignored) */
  price: number;
  regularPrice: number;
  offerActive: boolean;
  wholesalePrice?: number;
  minWholesaleQty?: number;
  /** Stock at the selected location (falls back to total stock) */
  stock: number;
  inventoryId?: number;
  sku: string;
  barcode?: string;
}

export interface PosProduct {
  id: number;
  name: string;
  categoryId?: number;
  image?: string;
  price: number;
  regularPrice: number;
  offerActive: boolean;
  wholesalePrice?: number;
  minWholesaleQty?: number;
  stock: number;
  sku?: string;
  barcode?: string;
  published: boolean;
  variants: PosVariant[];
}

export interface Coupon {
  id: number;
  code: string;
  campaignName: string;
  discount: number;
  type: "percentage" | "fixed" | "free_shipping";
  minOrderAmount: number;
  maxDiscount?: number | null;
  /** Coupon limited per customer: a walk-in sale cannot use it */
  perCustomer?: boolean;
  /** Empty = whole cart */
  productIds?: number[];
  categoryIds?: number[];
}

/** Sell `method` values accepted by the server. */
export type PaymentMethod = "Cash" | "Card" | "Online" | "COD" | "bKash" | "Nagad" | "Bank";

export interface PosPaymentOptions {
  methods: PaymentMethod[];
  defaultMethod: PaymentMethod;
}

export interface CheckoutPayload {
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingEmail?: string;
  shippingAddressLine1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  method: PaymentMethod;
  source?: "pos";
  /** Warehouse / branch the sale is made from (stock is checked there) */
  locationId?: number;
  amount: number;
  /** Total discount (manual + coupon) */
  discount: number;
  /** Manual part of the discount; the server recomputes the coupon part */
  manualDiscount?: number;
  couponId?: number;
  couponCode?: string;
  taxRate?: number;
  taxAmount?: number;
  paidAmount?: number;
  transactionId?: string;
  shippingCost: number;
  status: "Pending" | "Delivered";
  items: {
    productId: number;
    variantId?: number;
    inventoryId?: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
}

export interface CompletedSale {
  invoiceNo: string;
  customerName: string;
  method: PaymentMethod;
  subtotal: number;
  discount: number;
  couponDiscount: number;
  tax: number;
  total: number;
  itemCount: number;
  tendered?: number;
  change?: number;
  transactionId?: string;
}
