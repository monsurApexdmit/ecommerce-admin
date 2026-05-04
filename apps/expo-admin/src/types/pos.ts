export interface CartItem {
  key: string;
  productId: number;
  variantId?: number;
  inventoryId?: number;
  name: string;
  variantName?: string;
  price: number;
  image?: string;
  quantity: number;
  stock: number;
}

export interface Coupon {
  id: number;
  code: string;
  campaignName: string;
  discount: number;
  type: "percentage" | "fixed" | "free_shipping";
  minOrderAmount: number;
  maxDiscount?: number | null;
}

export type PaymentMethod = "Cash" | "Card" | "Online";

export interface CheckoutPayload {
  customerId?: number;
  customerName: string;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingEmail?: string;
  shippingAddressLine1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  method: PaymentMethod;
  amount: number;
  discount: number;
  couponId?: number;
  couponCode?: string;
  shippingCost: number;
  status: "Pending";
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
}
