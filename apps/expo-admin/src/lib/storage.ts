import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "@/types/auth";

const AUTH_STORAGE_KEY = "expo_admin_auth_session";

export async function saveSession(session: AuthSession) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}
