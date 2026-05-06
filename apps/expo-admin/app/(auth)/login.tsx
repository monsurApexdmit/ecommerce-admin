"use client";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { session, signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    try {
      await signIn({ email: email.trim(), password });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        (error?.request && !error?.response
          ? "Unable to reach the server. Check that your phone and backend are on the same network and that the API URL uses your PC LAN IP."
          : "Unable to sign in. Check your credentials.");
      Alert.alert("Login failed", message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Ionicons name="storefront" size={32} color={colors.primary} />
            </View>
            <Text style={styles.kicker}>Ecommerce Admin</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your admin dashboard</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@company.com"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputPassword]}
                  secureTextEntry={!showPassword}
                  placeholder="Your password"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleLogin()}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Forgot password */}
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable style={styles.forgotWrap} hitSlop={8}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </Link>

            {/* Submit */}
            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={() => void handleLogin()}
              disabled={loading}
            >
              {loading ? (
                <Text style={styles.buttonText}>Signing in...</Text>
              ) : (
                <>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
    gap: 24,
  },
  brand: {
    alignItems: "center",
    gap: 8,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kicker: {
    color: colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  inputIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  inputPassword: {
    paddingRight: 8,
  },
  eyeButton: {
    flexShrink: 0,
    padding: 2,
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});
