import { api } from "@/lib/api";

export interface GeneralSettings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  storeDescription: string;
}

export interface TaxSettings {
  defaultTaxRate: number;
  taxInclusivePrice: boolean;
  enableGSTTracking: boolean;
  gstNumber?: string;
  enableTaxExemption: boolean;
  defaultShippingTax: number;
}

export interface PaymentSettings {
  enableCash: boolean;
  enableCard: boolean;
  enableOnline: boolean;
  cardProcessingFee: number;
  stripeKey?: string;
}

export interface RegionalSettings {
  language: string;
  currency: string;
  timezone: string;
  weightUnit?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  orderNotifications: boolean;
  marketingEmails: boolean;
}

export interface ShippingSettings {
  enableShipping: boolean;
  defaultShippingCost: number;
  freeShippingThreshold?: number;
}

function normalize(d: any): any { return d ?? {}; }

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return normalize(d.general ?? d);
}

export async function updateGeneralSettings(data: Partial<GeneralSettings>): Promise<GeneralSettings> {
  const r = await api.put("/settings/general", data);
  return normalize(r.data?.data ?? r.data);
}

export async function getTaxSettings(): Promise<TaxSettings> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return normalize(d.tax ?? d);
}

export async function updateTaxSettings(data: Partial<TaxSettings>): Promise<TaxSettings> {
  const r = await api.patch("/settings/tax", data);
  return normalize(r.data?.data ?? r.data);
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return normalize(d.payment ?? d);
}

export async function updatePaymentSettings(data: Partial<PaymentSettings>): Promise<PaymentSettings> {
  const r = await api.patch("/settings/payment", data);
  return normalize(r.data?.data ?? r.data);
}

export async function getRegionalSettings(): Promise<RegionalSettings> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return normalize(d.regional ?? d);
}

export async function updateRegionalSettings(data: Partial<RegionalSettings>): Promise<RegionalSettings> {
  const r = await api.patch("/settings/regional", data);
  return normalize(r.data?.data ?? r.data);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return normalize(d.notifications ?? d);
}

export async function updateNotificationSettings(data: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const r = await api.patch("/settings/notifications", data);
  return normalize(r.data?.data ?? r.data);
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return normalize(d.shipping ?? d);
}

export async function updateShippingSettings(data: Partial<ShippingSettings>): Promise<ShippingSettings> {
  const r = await api.patch("/settings/shipping", data);
  return normalize(r.data?.data ?? r.data);
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await api.post("/settings/change-password", data);
}

export async function getAllSettings(): Promise<{
  general: GeneralSettings;
  tax: TaxSettings;
  payment: PaymentSettings;
  regional: RegionalSettings;
  notifications: NotificationSettings;
  shipping: ShippingSettings;
}> {
  const r = await api.get("/settings");
  const d = r.data?.data ?? r.data ?? {};
  return {
    general: normalize(d.general),
    tax: normalize(d.tax),
    payment: normalize(d.payment),
    regional: normalize(d.regional),
    notifications: normalize(d.notifications),
    shipping: normalize(d.shipping),
  };
}
