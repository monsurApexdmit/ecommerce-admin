import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

type Tone = "primary" | "info" | "warning" | "danger";

type StatCardProps = {
  label: string;
  value: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  trend?: number;
};

const toneConfig: Record<Tone, { bg: string; iconBg: string; iconColor: string }> = {
  primary: { bg: "#ecfdf5", iconBg: "#bbf7d0", iconColor: colors.primaryDark },
  info:    { bg: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  warning: { bg: "#fffbeb", iconBg: "#fde68a", iconColor: "#92400e" },
  danger:  { bg: "#fef2f2", iconBg: "#fecaca", iconColor: "#991b1b" },
};

export function StatCard({ label, value, tone = "primary", icon, trend }: StatCardProps) {
  const config = toneConfig[tone];
  const hasTrend = trend !== undefined && trend !== null;
  const trendUp = hasTrend && trend >= 0;

  return (
    <View style={[styles.card, { backgroundColor: config.bg }]}>
      <View style={styles.top}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: config.iconBg }]}>
            <Ionicons name={icon} size={18} color={config.iconColor} />
          </View>
        ) : null}
        {hasTrend ? (
          <View style={[styles.trendBadge, { backgroundColor: trendUp ? "#dcfce7" : "#fee2e2" }]}>
            <Ionicons
              name={trendUp ? "arrow-up" : "arrow-down"}
              size={11}
              color={trendUp ? "#16a34a" : "#dc2626"}
            />
            <Text style={[styles.trendText, { color: trendUp ? "#16a34a" : "#dc2626" }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    minWidth: 0,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "700",
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
});
