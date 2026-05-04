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
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { forgotPassword } from "@/services/auth";

type ScreenState = "form" | "sent";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<ScreenState>("form");

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword({ email: trimmed });
      setState("sent");
    } catch (error: any) {
      const message = error?.response?.data?.message ?? "Something went wrong. Please try again.";
      Alert.alert("Request failed", message);
    } finally {
      setLoading(false);
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
          {/* Back button */}
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back to login</Text>
          </Pressable>

          {state === "form" ? (
            <FormView
              email={email}
              setEmail={setEmail}
              loading={loading}
              onSubmit={() => void handleSubmit()}
            />
          ) : (
            <SentView email={email} onBackToLogin={() => router.replace("/(auth)/login")} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormView({
  email,
  setEmail,
  loading,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          Enter your admin email and we'll send you a link to reset your password.
        </Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Email address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor="#94a3b8"
              returnKeyType="send"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={onSubmit}
            />
          </View>
        </View>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Sending..." : "Send Reset Link"}</Text>
          {!loading && <Ionicons name="send-outline" size={17} color="#fff" />}
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.loginLinkWrap} hitSlop={8}>
            <Text style={styles.loginLinkText}>Remember your password? </Text>
            <Text style={[styles.loginLinkText, styles.loginLinkBold]}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

function SentView({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
  return (
    <>
      {/* Success icon */}
      <View style={styles.brand}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
        </View>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          We sent a password reset link to
        </Text>
        <Text style={styles.emailHighlight}>{email}</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
          <Text style={styles.infoText}>
            The link will expire in 60 minutes. Check your spam folder if you don't see it.
          </Text>
        </View>

        <Pressable style={styles.button} onPress={onBackToLogin}>
          <Ionicons name="arrow-back" size={17} color="#fff" />
          <Text style={styles.buttonText}>Back to Login</Text>
        </Pressable>
      </View>
    </>
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  brand: {
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successIconWrap: {
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },
  emailHighlight: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
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
  loginLinkWrap: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  loginLinkText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  loginLinkBold: {
    color: colors.primary,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
