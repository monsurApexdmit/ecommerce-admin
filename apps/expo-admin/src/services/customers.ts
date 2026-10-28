import { api } from "@/lib/api";

export type CustomerGroup = "retail" | "wholesale" | "vip";
export type CustomerKind = "individual" | "business";

export interface CustomerRecentOrder {
  id: number;
  invoiceNo: string;
  date: string;
  amount: number;
  status: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  district?: string;
  area?: string;
  /** Alias of customerGroup kept for old callers */
  customerType: CustomerGroup;
  customerGroup: CustomerGroup;
  type: CustomerKind;
  businessName?: string;
  licenceBin?: string;
  creditLimit: number;
  openingBalance: number;
  creditUsed: number;
  creditUsedPercent: number;
  birthday?: string | null;
  tags: string[];
  smsOptIn: boolean;
  status: "active" | "inactive";
  notes?: string;
  storeCredit: number;
  totalOrders?: number;
  totalSpent?: number;
  dueAmount?: number;
  lastOrderAt?: string | null;
  duplicatePhone?: boolean;
  recentOrders?: CustomerRecentOrder[];
  createdAt: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  individuals?: number;
  businesses?: number;
  owing?: number;
  totalDue?: number;
}

export interface CustomerCounts {
  total: number;
  active: number;
  inactive: number;
  byGroup: Record<CustomerGroup, number>;
  byType: Record<CustomerKind, number>;
}

export interface CustomerListResult {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  counts?: CustomerCounts;
}

/** Create / update body (camelCase, PHASE3 contract). */
export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  district?: string;
  area?: string;
  country?: string;
  type?: CustomerKind;
  businessName?: string;
  licenceBin?: string;
  customerGroup?: CustomerGroup;
  creditLimit?: number;
  openingBalance?: number;
  birthday?: string | null;
  tags?: string[];
  smsOptIn?: boolean;
  status?: "active" | "inactive";
  notes?: string;
  storeCredit?: number;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function normalize(c: any): Customer {
  const group: CustomerGroup = (c.customerGroup ?? c.customer_group ?? c.customerType ?? c.customer_type ?? "retail") as CustomerGroup;
  return {
    id: c.id,
    name: c.name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? undefined,
    address: c.address ?? undefined,
    city: c.city ?? undefined,
    state: c.state ?? undefined,
    zipCode: c.zipCode ?? c.zip_code ?? undefined,
    country: c.country ?? undefined,
    district: c.district ?? undefined,
    area: c.area ?? undefined,
    customerType: group,
    customerGroup: group,
    type: c.type === "business" ? "business" : "individual",
    businessName: c.businessName ?? c.business_name ?? undefined,
    licenceBin: c.licenceBin ?? c.licence_bin ?? undefined,
    creditLimit: num(c.creditLimit ?? c.credit_limit),
    openingBalance: num(c.openingBalance ?? c.opening_balance),
    creditUsed: num(c.creditUsed),
    creditUsedPercent: num(c.creditUsedPercent),
    birthday: c.birthday ?? null,
    tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
    smsOptIn: c.smsOptIn ?? c.sms_opt_in ?? true,
    status: c.status === "inactive" ? "inactive" : "active",
    notes: c.notes ?? undefined,
    storeCredit: num(c.storeCredit ?? c.store_credit),
    totalOrders: c.totalOrders ?? c.total_orders,
    totalSpent: c.totalSpent ?? c.total_spent,
    dueAmount: c.dueAmount != null ? num(c.dueAmount) : undefined,
    lastOrderAt: c.lastOrderAt ?? null,
    duplicatePhone: Boolean(c.duplicatePhone),
    recentOrders: Array.isArray(c.recentOrders)
      ? c.recentOrders.map((o: any) => ({
          id: Number(o.id),
          invoiceNo: String(o.invoiceNo ?? o.id),
          date: o.date ?? "",
          amount: num(o.amount),
          status: String(o.status ?? ""),
        }))
      : undefined,
    createdAt: c.createdAt ?? c.created_at ?? "",
  };
}

export async function getCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  group?: CustomerGroup | "all" | "";
  type?: CustomerKind | "all" | "";
  sort?: "recent" | "name" | "spent" | "orders" | "due";
}): Promise<CustomerListResult> {
  const cleaned = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "" && v !== "all"),
  );
  const response = await api.get("/customers", { params: cleaned });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  const c = d.counts;
  return {
    data: items.map(normalize),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
    limit: d.per_page ?? params?.limit ?? 20,
    counts: c
      ? {
          total: num(c.total),
          active: num(c.active),
          inactive: num(c.inactive),
          byGroup: { retail: num(c.byGroup?.retail), wholesale: num(c.byGroup?.wholesale), vip: num(c.byGroup?.vip) },
          byType: { individual: num(c.byType?.individual), business: num(c.byType?.business) },
        }
      : undefined,
  };
}

export async function getCustomerById(id: number): Promise<Customer> {
  const response = await api.get(`/customers/${id}`);
  return normalize(response.data?.data ?? response.data);
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const response = await api.get("/customers/stats");
  const d = response.data?.data ?? {};
  return {
    total: Number(d.total ?? 0),
    active: Number(d.active ?? 0),
    inactive: Number(d.inactive ?? 0),
    individuals: d.individuals != null ? Number(d.individuals) : undefined,
    businesses: d.businesses != null ? Number(d.businesses) : undefined,
    owing: d.owing != null ? Number(d.owing) : undefined,
    totalDue: d.totalDue != null ? Number(d.totalDue) : undefined,
  };
}

/** Drops blank optional strings so the server keeps/clears them consistently. */
function toBody(data: Partial<CustomerInput>) {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    body[k] = typeof v === "string" ? v.trim() : v;
  }
  if (body.email === "") body.email = null;
  if (body.birthday === "") body.birthday = null;
  if (body.type !== "business") delete body.businessName;
  return body;
}

export async function createCustomer(data: CustomerInput): Promise<Customer> {
  const response = await api.post("/customers", toBody(data));
  return normalize(response.data?.data ?? response.data);
}

export async function updateCustomer(id: number, data: Partial<CustomerInput>): Promise<Customer> {
  const response = await api.put(`/customers/${id}`, toBody(data));
  return normalize(response.data?.data ?? response.data);
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}`);
}

export async function getCustomerOrders(customerId: number): Promise<any[]> {
  const response = await api.get("/sells", { params: { customer_id: customerId, limit: 20 } });
  const d = response.data?.data ?? {};
  return Array.isArray(d) ? d : (d.data ?? []);
}

/**
 * Client-side copy of the server rules (PHASE3): name + phone required on create, phone 7-15 digits,
 * email format, business name for businesses, birthday not in the future, amounts not negative.
 */
export function validateCustomer(data: Partial<CustomerInput>, mode: "create" | "update" = "create"): Record<string, string> {
  const err: Record<string, string> = {};
  const name = (data.name ?? "").trim();
  const phone = (data.phone ?? "").trim();
  if (mode === "create" || data.name !== undefined) {
    if (!name) err.name = "Name is required.";
    else if (name.length > 255) err.name = "Name must be 255 characters or fewer.";
  }
  if (mode === "create" || data.phone !== undefined) {
    const digits = phone.replace(/[\s+\-()]/g, "");
    if (!phone) err.phone = "Phone is required.";
    else if (!/^\d{7,15}$/.test(digits)) err.phone = "Phone must be 7 to 15 digits.";
  }
  const email = (data.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = "Enter a valid email address.";
  if (data.type === "business" && !(data.businessName ?? "").trim()) err.businessName = "Business name is required for a business.";
  if (data.birthday) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.birthday);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getMonth() !== Number(m![2]) - 1) err.birthday = "Use the format YYYY-MM-DD.";
    else if (d.getTime() > Date.now()) err.birthday = "Birthday cannot be in the future.";
  }
  if (data.creditLimit !== undefined && (!Number.isFinite(data.creditLimit) || data.creditLimit < 0)) err.creditLimit = "Credit limit cannot be negative.";
  if (data.openingBalance !== undefined && (!Number.isFinite(data.openingBalance) || data.openingBalance < 0)) err.openingBalance = "Opening balance cannot be negative.";
  return err;
}
