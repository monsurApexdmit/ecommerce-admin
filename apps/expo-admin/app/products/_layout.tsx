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
        animation: "fade_from_bottom",
        animationDuration: 220,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/edit" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/reviews" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/barcode" options={{ headerShown: false }} />
    </Stack>
  );
}
