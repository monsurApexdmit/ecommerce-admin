import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { usePathname, router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "@/constants/theme"

const TABS = [
  { icon: "grid-outline",           iconActive: "grid",                label: "Dashboard", route: "/tabs" },
  { icon: "receipt-outline",        iconActive: "receipt",             label: "Orders",    route: "/tailor" },
  { icon: "people-outline",         iconActive: "people",              label: "Customers", route: "/tabs/customers" },
  { icon: "person-circle-outline",  iconActive: "person-circle",       label: "Account",   route: "/tabs/account" },
] as const

export function BottomNav() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

  const isActive = (route: string) => {
    if (route === "/tailor") return pathname.startsWith("/tailor") && !pathname.startsWith("/tabs")
    if (route === "/tabs") return pathname === "/tabs" || pathname === "/tabs/index"
    return pathname === route
  }

  return (
    <View style={[s.container, { paddingBottom: insets.bottom || 8 }]}>
      {TABS.map(tab => {
        const active = isActive(tab.route)
        return (
          <TouchableOpacity
            key={tab.route}
            style={s.tab}
            onPress={() => {
              if (active) {
                router.replace(tab.route as any)
              } else {
                router.navigate(tab.route as any)
              }
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={(active ? tab.iconActive : tab.icon) as any}
              size={22}
              color={active ? "#7c3aed" : colors.muted}
            />
            <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  label: { fontSize: 10, fontWeight: "600", color: colors.muted },
  labelActive: { color: "#7c3aed", fontWeight: "800" },
})
