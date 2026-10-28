import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/constants/theme";
import { FinanceFiltersProvider } from "@/components/finance/filters";

export default function FinanceStackLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <FinanceFiltersProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade_from_bottom",
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="transactions" />
        <Stack.Screen name="accounts" />
        <Stack.Screen name="payouts" />
        <Stack.Screen name="receivables" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="inventory" />
        <Stack.Screen name="reports" />
      </Stack>
    </FinanceFiltersProvider>
  );
}
