import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/constants/theme";

export default function ProductsStackLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
