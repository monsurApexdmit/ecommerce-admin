import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "@/types/auth";

const KEY = "tailor_app_auth_session";

export async function saveSession(session: AuthSession) {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthSession; }
  catch { await AsyncStorage.removeItem(KEY); return null; }
}

export async function clearSession() {
  await AsyncStorage.removeItem(KEY);
}
