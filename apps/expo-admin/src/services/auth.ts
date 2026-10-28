import { api } from "@/lib/api";
import type {
  CurrentUserResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  LoginResponse,
  PinLoginPayload,
} from "@/types/auth";

export async function login(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

/** Staff PIN sign-in: returns the same token payload as a normal login (plus staffId). */
export async function pinLogin(payload: PinLoginPayload) {
  const response = await api.post<LoginResponse>("/auth/pin-login", payload);
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
