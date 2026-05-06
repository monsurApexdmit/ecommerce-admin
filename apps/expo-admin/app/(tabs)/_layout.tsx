import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { colors } from "@/constants/theme";

const iconMap: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "grid", inactive: "grid-outline" },
  products: { active: "cube", inactive: "cube-outline" },
  pos: { active: "cart", inactive: "cart-outline" },
  orders: { active: "receipt", inactive: "receipt-outline" },
  account: { active: "person-circle", inactive: "person-circle-outline" },
  more: { active: "grid", inactive: "grid-outline" },
};

export default function TabsLayout() {
  const { session } = useAuth();
  const { unreadCount } = useNotifications();

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => {
            const config = iconMap.index;
            return <Ionicons name={focused ? config.active : config.inactive} size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => {
            const config = iconMap.products;
            return <Ionicons name={focused ? config.active : config.inactive} size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: "POS",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => {
            const config = iconMap.pos;
            return <Ionicons name={focused ? config.active : config.inactive} size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => {
            const config = iconMap.orders;
            return <Ionicons name={focused ? config.active : config.inactive} size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          href: null,
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => {
            const config = iconMap.account;
            return <Ionicons name={focused ? config.active : config.inactive} size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          headerShown: false,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "menu" : "menu-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
