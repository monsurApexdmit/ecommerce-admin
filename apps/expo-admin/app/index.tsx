import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function IndexScreen() {
  const { session } = useAuth();
  return <Redirect href={session ? "/(tabs)" : "/(auth)/login"} />;
}
