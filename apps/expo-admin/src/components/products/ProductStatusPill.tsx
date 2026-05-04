import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

type ProductStatusPillProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

const toneMap = {
  neutral: { backgroundColor: "#e2e8f0", color: colors.text },
  success: { backgroundColor: "#dcfce7", color: "#166534" },
  warning: { backgroundColor: "#fef3c7", color: "#92400e" },
  danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  info: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
} as const;

export function ProductStatusPill({
  label,
  tone = "neutral",
}: ProductStatusPillProps) {
  const palette = toneMap[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.text, { color: palette.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 0,
  },
});
