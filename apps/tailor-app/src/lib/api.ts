import axios from "axios";
import type { AuthSession } from "@/types/auth";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

let currentSession: AuthSession | null = null;

export function setApiSession(session: AuthSession | null) {
  currentSession = session;
}

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (currentSession?.token) {
    config.headers.Authorization = `Bearer ${currentSession.token}`;
  }
  return config;
});
