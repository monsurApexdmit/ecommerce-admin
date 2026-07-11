import { api } from "@/lib/api";
import type {
  CurrentUserResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  LoginResponse,
} from "@/types/auth";

export async function login(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export async function me() {
  const response = await api.get<CurrentUserResponse>("/auth/me");
  return response.data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const response = await api.post<ForgotPasswordResponse>("/auth/forgot-password", payload);
  return response.data;
}
