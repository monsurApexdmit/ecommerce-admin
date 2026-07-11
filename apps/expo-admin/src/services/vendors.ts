import { api } from "@/lib/api";

export interface Vendor {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logo?: string;
  status: "active" | "inactive";
  description?: string;
  totalPaid: number;
  amountPayable: number;
  createdAt: string;
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
    status: v.status ?? "active",
    description: v.description,
    totalPaid: Number(v.totalPaid ?? v.total_paid ?? 0),
    amountPayable: Number(v.amountPayable ?? v.amount_payable ?? 0),
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

export async function createVendor(data: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  description?: string;
  status?: string;
}): Promise<Vendor> {
  const response = await api.post("/vendors/", data);
  return normalize(response.data?.data ?? response.data);
}

export async function updateVendor(id: number, data: Partial<{
  name: string; email: string; phone: string; address: string;
  description: string; status: string; totalPaid: number; amountPayable: number;
}>): Promise<Vendor> {
  const response = await api.put(`/vendors/${id}`, data);
  return normalize(response.data?.data ?? response.data);
}

export async function deleteVendor(id: number): Promise<void> {
  await api.delete(`/vendors/${id}`);
}
