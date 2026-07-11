import { api } from "@/lib/api";
import type { CheckoutPayload, Coupon } from "@/types/pos";

type CouponRaw = {
  id: number;
  campaignName?: string;
  campaign_name?: string;
  code: string;
  discount: number;
  type: "percentage" | "fixed" | "free_shipping";
  status: boolean;
  minOrderAmount?: number;
  min_order_amount?: number;
  maxDiscount?: number | null;
  max_discount?: number | null;
};

type CreateSellResponse = {
  message: string;
  data: {
    id: number;
    invoiceNo?: string;
    invoice_no?: string;
    [key: string]: any;
  };
};

export async function getActiveCoupons(): Promise<Coupon[]> {
  const response = await api.get("/coupons", { params: { limit: 100 } });
  const raw: CouponRaw[] = Array.isArray(response.data?.data)
    ? response.data.data
    : [];

  return raw
    .filter((c) => c.status === true)
    .map((c) => ({
      id: c.id,
      code: c.code,
      campaignName: c.campaignName ?? c.campaign_name ?? c.code,
      discount: Number(c.discount ?? 0),
      type: c.type,
      minOrderAmount: Number(c.minOrderAmount ?? c.min_order_amount ?? 0),
      maxDiscount: c.maxDiscount ?? c.max_discount ?? null,
    }));
}

export async function createSell(payload: CheckoutPayload): Promise<{ id: number; invoiceNo: string }> {
  const response = await api.post<CreateSellResponse>("/sells", {
    customerId: payload.customerId,
    customerName: payload.customerName,
    shippingFullName: payload.shippingFullName,
    shippingPhone: payload.shippingPhone,
    shippingEmail: payload.shippingEmail,
    shippingAddressLine1: payload.shippingAddressLine1,
    shippingCity: payload.shippingCity,
    shippingState: payload.shippingState,
    shippingPostalCode: payload.shippingPostalCode,
    shippingCountry: payload.shippingCountry,
    method: payload.method,
    amount: payload.amount,
    discount: payload.discount,
    couponId: payload.couponId,
    couponCode: payload.couponCode,
    shippingCost: payload.shippingCost,
    status: payload.status,
    items: payload.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      inventoryId: item.inventoryId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.price,
      price: item.price,
    })),
  });

  const d = response.data.data;
  return {
    id: d.id,
    invoiceNo: d.invoiceNo ?? d.invoice_no ?? String(d.id),
  };
}
