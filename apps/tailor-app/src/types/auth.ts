export type UserRole = "owner" | "admin" | "manager" | "staff";

export interface AuthSession {
  token: string;
  companyId: number;
  companyName: string;
  userRole: UserRole;
  userEmail: string;
}

export interface Company {
  id: number;
  name: string;
  status: "trial" | "active" | "expired" | "suspended";
  trialDaysRemaining?: number;
  licenseType?: "trial" | "paid";
  planModules?: string[];
}

export interface User {
  id: number;
  companyId: number;
  email: string;
  fullName: string;
  role: UserRole;
  status: "active" | "invited" | "inactive";
  joinedDate: string;
  lastLogin?: string;
  /** null = full access (owner/admin). Object = per-module flags. */
  permissions: Record<string, { read: boolean; write: boolean; delete: boolean }> | null;
  roleId?: number | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  data?: {
    resetTokenSent?: boolean;
  };
}

export interface LoginResponse {
  message: string;
  data: {
    userId: number;
    userEmail: string;
    companyId: number;
    companyName: string;
    companyStatus: Company["status"];
    userRole: UserRole;
    token: string;
    licenseKey: string;
    licenseType: "trial" | "paid";
    trialDaysRemaining?: number;
    subscriptionEndDate?: string;
  };
}

export interface CurrentUserResponse {
  message: string;
  data: {
    user: User;
    company: Company;
  };
}
