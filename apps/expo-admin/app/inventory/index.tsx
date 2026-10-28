import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import {
  getInventoryOverview,
  type StockHealth,
  type StockHealthFilter,
  type StockOverview,
  type StockOverviewRow,
} from "@/services/inventory";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { StockAdjustSheet, type StockAdjustTarget } from "@/components/products/StockAdjustSheet";

const HEALTH_TONE: Record<StockHealth, { bg: string; text: string; label: string }> = {
  ok: { bg: "#dcfce7", text: "#16a34a", label: "OK" },
  low: { bg: "#fef3c7", text: "#d97706", label: "Low" },
  out: { bg: "#fee2e2", text: "#dc2626", label: "Out" },
  over: { bg: "#e0e7ff", text: "#4338ca", label: "Over" },
};

const HEALTH_TABS: Array<{ key: StockHealthFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "low", label: "Low" },
  { key: "out", label: "Out" },
  { key: "ok", label: "OK" },
  { key: "over", label: "Overstock" },
];

function qtyTone(quantity: number): { bg: string; text: string } {
  if (quantity <= 0) return { bg: "#fee2e2", text: "#dc2626" };
  return { bg: "#dcfce7", text: "#16a34a" };
}

export default function InventoryScreen() {
  const { formatCurrency } = useCurrency();
  const { canRead, canWrite } = useAuth();
  const [data, setData] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWh, setSelectedWh] = useState<number | undefined>(undefined);
  const [health, setHealth] = useState<StockHealthFilter>("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [adjustRow, setAdjustRow] = useState<StockOverviewRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await getInventoryOverview({ search: debouncedSearch || undefined, locationId: selectedWh }));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedWh]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  // Health filter is applied locally so the counts on the chips stay stable.
  const rows = useMemo(() => {
    const all = data?.items ?? [];
    if (health === "all") return all;
    if (health === "attention") return all.filter((r) => r.health === "low" || r.health === "out");
    return all.filter((r) => r.health === health);
  }, [data, health]);

  const locations = data?.locations ?? [];

  const adjustTargets = useMemo<StockAdjustTarget[]>(() => {
    if (!adjustRow) return [];
    const toMap = (r: StockOverviewRow) => Object.fromEntries(r.locations.map((l) => [l.locationId, l.quantity]));
    if (adjustRow.type === "variant") {
      return [{ variantId: adjustRow.id, label: adjustRow.variantName ?? adjustRow.name, byLocation: toMap(adjustRow) }];
    }
    if (adjustRow.variants.length > 0) {
      // Variant parents: stock is the sum of the variants — a variant must be chosen.
      return adjustRow.variants.map((v) => ({ variantId: v.id, label: v.variantName ?? v.name, byLocation: toMap(v) }));
    }
    return [{ variantId: null, label: adjustRow.name, byLocation: toMap(adjustRow) }];
  }, [adjustRow]);

  if (!canRead('Inventory')) return <AccessDenied />;

  const stats = data?.stats;
  const counts = data?.counts;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Inventory</Text>
        <Pressable
          style={styles.transferBtn}
          onPress={() => router.push("/inventory/transfer")}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
          <Text style={styles.transferBtnText}>Transfer</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatChip label="SKUs" value={String(stats?.skus ?? 0)} bg="#eff6ff" text="#1d4ed8" />
        <StatChip label="Needs attention" value={String(stats?.attention ?? 0)} bg="#fef3c7" text="#d97706" />
        <StatChip label="Stock value" value={formatCurrency(stats?.stockValue ?? 0)} bg="#ecfdf5" text="#047857" />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, SKU or barcode..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Health filter */}
      <View style={styles.whRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.whContent}>
          {HEALTH_TABS.map((tab) => {
            const active = health === tab.key;
            const count = counts?.[tab.key];
            return (
              <Pressable
                key={tab.key}
                style={[styles.whChip, active && (tab.key === "attention" ? styles.attentionChipActive : styles.whChipActive)]}
                onPress={() => setHealth(tab.key)}
              >
                <Text style={[styles.whChipText, active && (tab.key === "attention" ? styles.attentionChipTextActive : styles.whChipTextActive)]}>
                  {tab.label}{count !== undefined ? ` ${count}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Warehouse filter tabs */}
      {locations.length > 1 && (
        <View style={styles.whRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.whContent}
          >
            <Pressable
              style={[styles.whChip, selectedWh === undefined && styles.whChipActive]}
              onPress={() => setSelectedWh(undefined)}
            >
              <Text style={[styles.whChipText, selectedWh === undefined && styles.whChipTextActive]}>All locations</Text>
            </Pressable>
            {locations.map((wh) => (
              <Pressable
                key={wh.id}
                style={[styles.whChip, selectedWh === wh.id && styles.whChipActive]}
                onPress={() => setSelectedWh(wh.id)}
              >
                <Text style={[styles.whChipText, selectedWh === wh.id && styles.whChipTextActive]}>
                  {wh.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              selectedWh={selectedWh}
              expanded={Boolean(expanded[item.productId])}
              onToggle={() => setExpanded((cur) => ({ ...cur, [item.productId]: !cur[item.productId] }))}
              onAdjust={canWrite("Inventory") ? (row) => setAdjustRow(row) : undefined}
              onOpenProduct={() => router.push(`/products/${item.productId}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="layers-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>{health === "attention" ? "Nothing needs attention" : "No items found"}</Text>
              <Text style={styles.emptyText}>
                {search ? "Try a different search term." : health !== "all" ? "Try another filter." : "No inventory data available."}
              </Text>
            </View>
          }
        />
      )}

      {adjustRow ? (
        <StockAdjustSheet
          visible
          productId={adjustRow.productId}
          productName={adjustRow.name}
          targets={adjustTargets}
          locations={locations}
          initialVariantId={adjustRow.type === "variant" ? adjustRow.id : undefined}
          initialLocationId={selectedWh}
          onClose={() => setAdjustRow(null)}
          onDone={(result) => {
            setAdjustRow(null);
            Alert.alert(
              "Stock adjusted",
              `${result.number ? `${result.number} · ` : ""}${result.variantName ? `${result.variantName}: ` : ""}${result.before} → ${result.after}`,
            );
            void load(true);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function InventoryCard({ item, selectedWh, expanded, onToggle, onAdjust, onOpenProduct }: {
  item: StockOverviewRow;
  selectedWh?: number;
  expanded: boolean;
  onToggle: () => void;
  onAdjust?: (row: StockOverviewRow) => void;
  onOpenProduct: () => void;
}) {
  const tone = HEALTH_TONE[item.health];
  const hasVariants = item.variants.length > 0;
  const filteredLocations = selectedWh
    ? item.locations.filter((loc) => loc.locationId === selectedWh)
    : item.locations;

  return (
    <View style={cardStyles.card}>
      <Pressable style={cardStyles.top} onPress={onOpenProduct}>
        <View style={cardStyles.nameBlock}>
          <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
          {item.variantName ? <Text style={cardStyles.variant}>{item.variantName}</Text> : null}
          <Text style={cardStyles.sku}>
            {item.sku ? `SKU: ${item.sku}` : "No SKU"}
            {item.reorderPoint > 0 ? ` · alert at ${item.reorderPoint}` : " · alert off"}
          </Text>
          {item.reserved > 0 ? (
            <Text style={cardStyles.sku}>{item.reserved} reserved · {item.available} available</Text>
          ) : null}
        </View>
        <View style={[cardStyles.stockBadge, { backgroundColor: tone.bg }]}>
          <Text style={[cardStyles.stockNum, { color: tone.text }]}>{item.onHand}</Text>
          <Text style={[cardStyles.stockLabel, { color: tone.text }]}>{tone.label}</Text>
        </View>
      </Pressable>

      {!hasVariants && filteredLocations.length > 0 && (
        <View style={cardStyles.locations}>
          {filteredLocations.map((loc) => {
            const t = qtyTone(loc.quantity);
            return (
              <View key={loc.locationId} style={cardStyles.locRow}>
                <Ionicons name="location-outline" size={12} color={colors.muted} />
                <Text style={cardStyles.locName} numberOfLines={1}>{loc.locationName}</Text>
                <View style={[cardStyles.locBadge, { backgroundColor: t.bg }]}>
                  <Text style={[cardStyles.locQty, { color: t.text }]}>{loc.quantity}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={cardStyles.actions}>
        {hasVariants ? (
          <Pressable style={cardStyles.linkBtn} onPress={onToggle}>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primaryDark} />
            <Text style={cardStyles.linkText}>
              {item.variants.length} variant{item.variants.length === 1 ? "" : "s"}
            </Text>
          </Pressable>
        ) : <View />}
        {onAdjust ? (
          <Pressable style={cardStyles.adjustBtn} onPress={() => onAdjust(item)}>
            <Ionicons name="swap-vertical-outline" size={14} color={colors.primaryDark} />
            <Text style={cardStyles.linkText}>Adjust</Text>
          </Pressable>
        ) : null}
      </View>

      {hasVariants && expanded ? (
        <View style={cardStyles.locations}>
          {item.variants.map((v) => {
            const vt = HEALTH_TONE[v.health];
            const vLocs = selectedWh ? v.locations.filter((l) => l.locationId === selectedWh) : v.locations;
            return (
              <View key={v.id} style={cardStyles.variantRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={cardStyles.variantName}>{v.variantName ?? v.name}</Text>
                  <Text style={cardStyles.sku} numberOfLines={1}>
                    {vLocs.map((l) => `${l.locationName} ${l.quantity}`).join(" · ") || "No stock rows"}
                  </Text>
                </View>
                <View style={[cardStyles.locBadge, { backgroundColor: vt.bg }]}>
                  <Text style={[cardStyles.locQty, { color: vt.text }]}>{v.onHand} · {vt.label}</Text>
                </View>
                {onAdjust ? (
                  <Pressable onPress={() => onAdjust(v)} hitSlop={8}>
                    <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function StatChip({ label, value, bg, text }: { label: string; value: string; bg: string; text: string }) {
  return (
    <View style={[statStyles.chip, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color: text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[statStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 2 },
  value: { fontSize: 17, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "700" },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  nameBlock: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  variant: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" },
  sku: { color: colors.muted, fontSize: 12 },
  stockBadge: {
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 52,
  },
  stockNum: { fontSize: 18, fontWeight: "800" },
  stockLabel: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  locations: { gap: 6 },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locName: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "600" },
  locBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  locQty: { fontSize: 12, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  linkText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  variantName: { color: colors.text, fontSize: 13, fontWeight: "700" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  transferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transferBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  whRow: {
    height: 46,
    marginBottom: 8,
  },
  whContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    height: 46,
  },
  whChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  whChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  whChipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  whChipTextActive: { color: colors.primaryDark },
  attentionChipActive: { borderColor: "#d97706", backgroundColor: "#fffbeb" },
  attentionChipTextActive: { color: "#b45309" },
  listContent: { padding: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
