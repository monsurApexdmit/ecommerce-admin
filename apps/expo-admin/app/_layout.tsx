import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { PushNotificationProvider } from "@/context/PushNotificationProvider";
import { colors } from "@/constants/theme";

function RootNavigation() {
  const { bootstrapped } = useAuth();

  if (!bootstrapped) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushNotificationProvider>
          <NotificationProvider>
            <RootNavigation />
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
