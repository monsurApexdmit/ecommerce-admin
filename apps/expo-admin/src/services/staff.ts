import { api } from "@/lib/api";

export type StaffStatus = "Active" | "Invited" | "On leave" | "Inactive";
export const STAFF_STATUSES: StaffStatus[] = ["Active", "On leave", "Inactive"];

/** Same rule as the server: digits, optional leading +, spaces/dashes/brackets, 6–20 chars. */
export const STAFF_PHONE_PATTERN = /^\+?[0-9][0-9\s\-()]{5,19}$/;

export interface StaffMember {
  id: number;
  userId?: number;
  name: string;
  email: string;
  contact?: string;
  joiningDate?: string;
  role?: string;
  staffRoleId?: number | null;
  status: StaffStatus;
  /** "email" = signs in with email + password, "pin" = 4-digit POS PIN. */
  loginMethod?: "email" | "pin";
  hasPin?: boolean;
  isOwner?: boolean;
  /** The company's only Owner cannot be removed, deactivated or moved to another role. */
  isOnlyOwner?: boolean;
  lastActiveAt?: string | null;
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
  baseAmount?: number;
  bonus?: number;
  deduction?: number;
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
    role: s.role ?? s.roleName,
    staffRoleId: s.staffRoleId ?? s.roleId ?? null,
    status: s.status ?? "Active",
    loginMethod: s.loginMethod === "pin" ? "pin" : s.loginMethod === "email" ? "email" : undefined,
    hasPin: s.hasPin ?? undefined,
    isOwner: s.isOwner ?? undefined,
    isOnlyOwner: s.isOnlyOwner ?? undefined,
    lastActiveAt: s.lastActiveAt ?? null,
    published: s.published,
    avatar: s.avatar,
    salary: Number(s.salary ?? 0),
    bankAccount: s.bankAccount ?? s.bank_account,
    paymentMethod: s.paymentMethod ?? s.payment_method,
    createdAt: s.createdAt ?? s.created_at ?? "",
  };
}

/** The server stores lowercase statuses (paid / partial / pending). */
function normalizeSalaryStatus(value: unknown): SalaryPayment["status"] {
  const v = String(value ?? "").toLowerCase();
  if (v === "paid") return "Paid";
  if (v === "partial") return "Partial";
  return "Pending";
}

/** Salary month key the API expects ("YYYY-MM"). */
export function toSalaryMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" → "Oct 2026" (legacy "Oct 2026" values pass through). */
export function formatSalaryMonth(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleString("en-US", { month: "short" }) + " " + d.getFullYear();
}

function normalizeSalary(p: any): SalaryPayment {
  return {
    id: p.id,
    staffId: p.staffId ?? p.staff_id,
    staffName: p.staff?.name ?? p.staffName ?? p.staff_name,
    month: p.month ?? "",
    amount: Number(p.amount ?? 0),
    paidAmount: Number(p.paidAmount ?? p.paid_amount ?? 0),
    status: normalizeSalaryStatus(p.status),
    paymentDate: p.paymentDate ?? p.payment_date,
    paymentMethod: p.paymentMethod ?? p.payment_method,
    baseAmount: p.baseAmount !== undefined ? Number(p.baseAmount) : undefined,
    bonus: p.bonus !== undefined ? Number(p.bonus) : undefined,
    deduction: p.deduction !== undefined ? Number(p.deduction) : undefined,
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

/**
 * Owner flags + login info per staff id from GET /staff/overview
 * (isOwner / isOnlyOwner are only computed there).
 */
export async function getStaffOverviewFlags(): Promise<Record<number, Pick<StaffMember, "isOwner" | "isOnlyOwner" | "loginMethod" | "hasPin" | "role">>> {
  const response = await api.get("/staff/overview", { params: { per_page: 500 } });
  const rows: any[] = response.data?.data?.rows ?? [];
  const out: Record<number, Pick<StaffMember, "isOwner" | "isOnlyOwner" | "loginMethod" | "hasPin" | "role">> = {};
  for (const r of rows) {
    out[Number(r.id)] = {
      isOwner: Boolean(r.isOwner),
      isOnlyOwner: Boolean(r.isOnlyOwner),
      loginMethod: r.loginMethod === "pin" ? "pin" : "email",
      hasPin: Boolean(r.hasPin),
      role: r.roleName ?? undefined,
    };
  }
  return out;
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
  /** "YYYY-MM" */
  month?: string;
}): Promise<SalaryPaymentListResult> {
  const response = await api.get("/salary-payments", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeSalary),
    total: d.pagination?.total ?? d.total ?? items.length,
    page: d.pagination?.page ?? d.current_page ?? params?.page ?? 1,
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
