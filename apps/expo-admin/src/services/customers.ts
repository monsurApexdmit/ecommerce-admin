import { api } from "@/lib/api";

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
  customerType: "retail" | "wholesale";
  status: "active" | "inactive";
  notes?: string;
  storeCredit: number;
  totalOrders?: number;
  totalSpent?: number;
  createdAt: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
}

export interface CustomerListResult {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

function normalize(c: any): Customer {
  return {
    id: c.id,
    name: c.name ?? "",
    email: c.email ?? "",
    phone: c.phone,
    address: c.address,
    city: c.city,
    state: c.state,
    zipCode: c.zipCode ?? c.zip_code,
    country: c.country,
    customerType: c.customerType ?? c.customer_type ?? "retail",
    status: c.status ?? "active",
    notes: c.notes,
    storeCredit: Number(c.storeCredit ?? c.store_credit ?? 0),
    totalOrders: c.totalOrders ?? c.total_orders,
    totalSpent: c.totalSpent ?? c.total_spent,
    createdAt: c.createdAt ?? c.created_at ?? "",
  };
}

export async function getCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<CustomerListResult> {
  const response = await api.get("/customers", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalize),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
    limit: d.per_page ?? params?.limit ?? 20,
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
  };
}

export async function createCustomer(data: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  customerType?: string;
  status?: string;
  notes?: string;
}): Promise<Customer> {
  const response = await api.post("/customers", data);
  return normalize(response.data?.data ?? response.data);
}

export async function updateCustomer(id: number, data: Partial<{
  name: string; email: string; phone: string; address: string;
  city: string; state: string; country: string;
  customerType: string; status: string; notes: string; storeCredit: number;
}>): Promise<Customer> {
  const response = await api.put(`/customers/${id}`, data);
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
