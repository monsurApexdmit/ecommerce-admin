import { api } from "@/lib/api";

export interface StaffMember {
  id: number;
  userId?: number;
  name: string;
  email: string;
  contact?: string;
  joiningDate?: string;
  role?: string;
  status: "Active" | "Inactive";
  published?: boolean;
  avatar?: string;
  salary: number;
  bankAccount?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface StaffStats {
  total: number;
  active: number;
  inactive: number;
}

export interface StaffListResult {
  data: StaffMember[];
  total: number;
  page: number;
}

export interface SalaryPayment {
  id: number;
  staffId: number;
  staffName?: string;
  month: string;
  amount: number;
  paidAmount: number;
  status: "Paid" | "Pending" | "Partial";
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

export interface SalaryPaymentListResult {
  data: SalaryPayment[];
  total: number;
  page: number;
}

function normalizeStaff(s: any): StaffMember {
  return {
    id: s.id,
    userId: s.userId ?? s.user_id,
    name: s.name ?? "",
    email: s.email ?? "",
    contact: s.contact ?? s.phone,
    joiningDate: s.joiningDate ?? s.joining_date,
    role: s.role,
    status: s.status ?? "Active",
    published: s.published,
    avatar: s.avatar,
    salary: Number(s.salary ?? 0),
    bankAccount: s.bankAccount ?? s.bank_account,
    paymentMethod: s.paymentMethod ?? s.payment_method,
    createdAt: s.createdAt ?? s.created_at ?? "",
  };
}

function normalizeSalary(p: any): SalaryPayment {
  return {
    id: p.id,
    staffId: p.staffId ?? p.staff_id,
    staffName: p.staff?.name ?? p.staffName ?? p.staff_name,
    month: p.month ?? "",
    amount: Number(p.amount ?? 0),
    paidAmount: Number(p.paidAmount ?? p.paid_amount ?? 0),
    status: p.status ?? "Pending",
    paymentDate: p.paymentDate ?? p.payment_date,
    paymentMethod: p.paymentMethod ?? p.payment_method,
    notes: p.notes,
    createdAt: p.createdAt ?? p.created_at ?? "",
  };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaff(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<StaffListResult> {
  const response = await api.get("/staff", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeStaff),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
  };
}

export async function getStaffById(id: number): Promise<StaffMember> {
  const response = await api.get(`/staff/${id}`);
  return normalizeStaff(response.data?.data ?? response.data);
}

export async function getStaffStats(): Promise<StaffStats> {
  const response = await api.get("/staff/stats");
  const d = response.data?.data ?? {};
  return {
    total: Number(d.total ?? 0),
    active: Number(d.active ?? 0),
    inactive: Number(d.inactive ?? 0),
  };
}

export async function createStaff(data: {
  name: string;
  email: string;
  contact?: string;
  joiningDate?: string;
  role?: string;
  salary?: number;
  paymentMethod?: string;
  bankAccount?: string;
  status?: string;
}): Promise<StaffMember> {
  const response = await api.post("/staff", data);
  return normalizeStaff(response.data?.data ?? response.data);
}

export async function updateStaff(id: number, data: Partial<{
  name: string; email: string; contact: string; joiningDate: string;
  role: string; salary: number; paymentMethod: string; bankAccount: string; status: string;
}>): Promise<StaffMember> {
  const response = await api.put(`/staff/${id}`, data);
  return normalizeStaff(response.data?.data ?? response.data);
}

export async function deleteStaff(id: number): Promise<void> {
  await api.delete(`/staff/${id}`);
}

// ─── Salary payments ──────────────────────────────────────────────────────────

export async function getSalaryPayments(params?: {
  page?: number;
  limit?: number;
  staffId?: number;
  month?: string;
}): Promise<SalaryPaymentListResult> {
  const response = await api.get("/salary-payments", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeSalary),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
  };
}

export async function createSalaryPayment(data: {
  staffId: number;
  month: string;
  amount: number;
  paidAmount: number;
  status: "Paid" | "Pending" | "Partial";
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
}): Promise<SalaryPayment> {
  const response = await api.post("/salary-payments", data);
  return normalizeSalary(response.data?.data ?? response.data);
}

export async function updateSalaryPayment(id: number, data: Partial<{
  staffId: number; month: string; amount: number; paidAmount: number;
  status: "Paid" | "Pending" | "Partial"; paymentDate: string; paymentMethod: string; notes: string;
}>): Promise<SalaryPayment> {
  const response = await api.put(`/salary-payments/${id}`, data);
  return normalizeSalary(response.data?.data ?? response.data);
}

export async function deleteSalaryPayment(id: number): Promise<void> {
  await api.delete(`/salary-payments/${id}`);
}
