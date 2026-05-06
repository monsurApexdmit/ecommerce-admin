import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/constants/theme";

export default function OrdersStackLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade_from_bottom",
        animationDuration: 220,
      }}
    />
  );
}
