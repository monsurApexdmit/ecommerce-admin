import { Redirect, Stack } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { colors } from "@/constants/theme"

export default function TailorLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/(auth)/login" />
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade_from_bottom",
        contentStyle: { backgroundColor: colors.background },
        animationDuration: 220,
      }}
    />
  )
}
