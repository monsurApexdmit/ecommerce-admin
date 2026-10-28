import { api } from "@/lib/api";

/** UI status (the API uses "Active" / "Inactive" / "Blocked"). */
export type VendorStatus = "active" | "inactive" | "blocked";

export interface Vendor {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logo?: string;
  status: VendorStatus;
  description?: string;
  totalPaid: number;
  amountPayable: number;
  contactPerson?: string;
  paymentTerms?: string;
  openingBalance?: number;
  leadTimeDays?: number | null;
  safetyDays?: number | null;
  createdAt: string;
}

export type VendorInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  status: VendorStatus;
  contactPerson: string;
  paymentTerms: string;
  openingBalance: number;
  leadTimeDays: number | null;
  safetyDays: number | null;
};

function normalizeStatus(value: unknown): VendorStatus {
  const v = String(value ?? "active").toLowerCase();
  return v === "inactive" ? "inactive" : v === "blocked" ? "blocked" : "active";
}

/** "active" → "Active" (the API only accepts Active / Inactive / Blocked). */
function toApiStatus(value: VendorStatus): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toPayload(data: Partial<VendorInput>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if (data.status) out.status = toApiStatus(data.status);
  // Empty strings mean "not provided".
  for (const key of ["email", "phone", "address", "description", "contactPerson", "paymentTerms"] as const) {
    if (key in out && typeof out[key] === "string" && !(out[key] as string).trim()) out[key] = null;
  }
  return out;
}

export interface VendorStats {
  total: number;
  active: number;
  inactive: number;
}

export interface VendorListResult {
  data: Vendor[];
  total: number;
  page: number;
  limit: number;
}

function normalize(v: any): Vendor {
  return {
    id: v.id,
    name: v.name ?? "",
    email: v.email ?? "",
    phone: v.phone,
    address: v.address,
    logo: v.logo,
    status: normalizeStatus(v.status),
    description: v.description,
    totalPaid: Number(v.totalPaid ?? v.total_paid ?? 0),
    amountPayable: Number(v.amountPayable ?? v.amount_payable ?? 0),
    contactPerson: v.contactPerson ?? undefined,
    paymentTerms: v.paymentTerms ?? undefined,
    openingBalance: v.openingBalance !== undefined && v.openingBalance !== null ? Number(v.openingBalance) : undefined,
    leadTimeDays: v.leadTimeDays ?? null,
    safetyDays: v.safetyDays ?? null,
    createdAt: v.createdAt ?? v.created_at ?? "",
  };
}

export async function getVendors(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<VendorListResult> {
  const response = await api.get("/vendors/", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalize),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
    limit: d.per_page ?? params?.limit ?? 20,
  };
}

export async function getVendorById(id: number): Promise<Vendor> {
  const response = await api.get(`/vendors/${id}`);
  return normalize(response.data?.data ?? response.data);
}

export async function getVendorStats(): Promise<VendorStats> {
  const response = await api.get("/vendors/stats");
  const d = response.data?.data ?? {};
  return {
    total: Number(d.total ?? 0),
    active: Number(d.active ?? 0),
    inactive: Number(d.inactive ?? 0),
  };
}

/** Duplicate supplier names → 422 "A supplier named 'X' already exists." */
export async function createVendor(data: Partial<VendorInput> & { name: string }): Promise<Vendor> {
  const response = await api.post("/vendors/", toPayload(data));
  return normalize(response.data?.data ?? response.data);
}

export async function updateVendor(id: number, data: Partial<VendorInput>): Promise<Vendor> {
  const response = await api.put(`/vendors/${id}`, toPayload(data));
  return normalize(response.data?.data ?? response.data);
}

export async function deleteVendor(id: number): Promise<void> {
  await api.delete(`/vendors/${id}`);
}
