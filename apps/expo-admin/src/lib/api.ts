import axios from "axios";
import type { AuthSession } from "@/types/auth";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!baseURL) {
  console.warn("EXPO_PUBLIC_API_BASE_URL is not set for Expo Admin.");
}

let currentSession: AuthSession | null = null;

export function setApiSession(session: AuthSession | null) {
  currentSession = session;
}

export function getApiSession() {
  return currentSession;
}

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (currentSession?.token) {
    config.headers.Authorization = `Bearer ${currentSession.token}`;
  }

  if (currentSession?.companyId) {
    config.params = {
      ...(config.params ?? {}),
      company_id: currentSession.companyId,
    };
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      currentSession = null;
    }

    return Promise.reject(error);
  },
);
