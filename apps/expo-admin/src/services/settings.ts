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
  const raw = d.regional;
  const regional: Partial<RegionalSettings> =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (regional.currency) return regional as RegionalSettings;

  // The company currency (BDT → ৳) lives in the company settings, as on the web admin.
  try {
    const c = await api.get("/auth/company/settings");
    const company = c.data?.data ?? c.data ?? {};
    return {
      language: regional.language ?? company.language ?? "en",
      currency: company.currency ?? "BDT",
      timezone: regional.timezone ?? company.timezone ?? "UTC",
      weightUnit: regional.weightUnit ?? company.weightUnit,
      dateFormat: regional.dateFormat ?? company.dateFormat,
      timeFormat: regional.timeFormat ?? company.timeFormat,
    };
  } catch {
    return { language: "en", timezone: "UTC", ...regional, currency: "BDT" } as RegionalSettings;
  }
}

// ─── Read-only: payment methods & delivery options ───────────────────────────

export interface EnabledPaymentMethod {
  slug: string;
  name: string;
  /** "pos" and/or "online" */
  channels: string[];
}

export interface PaymentMethodsSummary {
  methods: EnabledPaymentMethod[];
  posMethods: string[];
  default: string | null;
  posDefault: string | null;
}

/** Enabled payment methods + default (GET /settings/payment). Empty when never configured. */
export async function getEnabledPaymentMethods(): Promise<PaymentMethodsSummary> {
  const r = await api.get("/settings/payment");
  const d = r.data?.data ?? {};
  return {
    methods: Array.isArray(d.methods)
      ? d.methods.map((m: any) => ({
          slug: String(m.slug ?? ""),
          name: m.name ?? String(m.slug ?? ""),
          channels: Array.isArray(m.channels) ? m.channels : ["pos", "online"],
        }))
      : [],
    posMethods: Array.isArray(d.posMethods) ? d.posMethods : [],
    default: d.default ?? null,
    posDefault: d.posDefault ?? null,
  };
}

export interface DeliveryOption {
  id: number;
  name: string;
  type: string;
  description: string | null;
  areasCovered: string | null;
  /** Fixed delivery charge */
  price: number;
  expressRate: number;
  estimatedDays: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** Shipping methods (fixed-price delivery options) — GET /shipping-methods. */
export async function getDeliveryOptions(): Promise<DeliveryOption[]> {
  const r = await api.get("/shipping-methods");
  const d = r.data?.data ?? [];
  const rows: any[] = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [];
  return rows
    .map((m) => ({
      id: Number(m.id),
      name: m.name ?? "",
      type: m.type ?? "delivery",
      description: m.description ?? null,
      areasCovered: m.areasCovered ?? m.areas_covered ?? null,
      price: Number(m.price ?? 0),
      expressRate: Number(m.expressRate ?? m.express_rate ?? 0),
      estimatedDays: m.estimatedDays ?? m.estimated_days ?? null,
      isActive: Boolean(m.isActive ?? m.is_active ?? false),
      sortOrder: Number(m.sortOrder ?? m.sort_order ?? 0),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
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
  // Regional falls back to the company currency/timezone so saving never resets it to a default.
  const regional = await getRegionalSettings().catch(() => normalize(d.regional));
  return {
    general: normalize(d.general),
    tax: normalize(d.tax),
    payment: normalize(d.payment),
    regional,
    notifications: normalize(d.notifications),
    shipping: normalize(d.shipping),
  };
}
