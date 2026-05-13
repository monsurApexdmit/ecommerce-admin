import { Redirect, Stack } from "expo-router"
import { View } from "react-native"
import { useAuth } from "@/context/AuthContext"
import { BottomNav } from "@/components/BottomNav"
import { colors } from "@/constants/theme"

export default function TailorLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/auth/login" />
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade_from_bottom",
          contentStyle: { backgroundColor: colors.background },
          animationDuration: 220,
        }}
      />
      <BottomNav />
    </View>
  )
}
