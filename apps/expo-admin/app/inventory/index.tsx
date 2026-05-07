import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { getInventory, type InventoryItem, type InventoryLocation } from "@/services/inventory";
import { getWarehouses } from "@/services/catalog";
import type { Warehouse } from "@/types/catalog";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

function stockTone(stock: number): { bg: string; text: string; label: string } {
  if (stock <= 0) return { bg: "#fee2e2", text: "#dc2626", label: "Out" };
  if (stock <= 5) return { bg: "#fef3c7", text: "#d97706", label: "Low" };
  return { bg: "#dcfce7", text: "#16a34a", label: "OK" };
}

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWh, setSelectedWh] = useState<number | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [inv, whs] = await Promise.all([
        getInventory({ search: debouncedSearch || undefined, warehouseId: selectedWh }),
        warehouses.length === 0 ? getWarehouses() : Promise.resolve(warehouses),
      ]);
      setItems(inv);
      if (warehouses.length === 0) setWarehouses(whs);
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

  const stats = useMemo(() => ({
    total: items.length,
    outOfStock: items.filter((i) => i.stock <= 0).length,
    lowStock: items.filter((i) => i.stock > 0 && i.stock <= 5).length,
  }), [items]);

  const { canRead } = useAuth();
  if (!canRead('Inventory')) return <AccessDenied />;

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
        <StatChip label="Total SKUs" value={String(stats.total)} bg="#eff6ff" text="#1d4ed8" />
        <StatChip label="Low Stock" value={String(stats.lowStock)} bg="#fef3c7" text="#d97706" />
        <StatChip label="Out of Stock" value={String(stats.outOfStock)} bg="#fee2e2" text="#dc2626" />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products or SKU..."
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

      {/* Warehouse filter tabs */}
      {warehouses.length > 0 && (
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
              <Text style={[styles.whChipText, selectedWh === undefined && styles.whChipTextActive]}>All</Text>
            </Pressable>
            {warehouses.map((wh) => (
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
          data={items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <InventoryCard item={item} selectedWh={selectedWh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="layers-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptyText}>
                {search ? "Try a different search term." : "No inventory data available."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function InventoryCard({ item, selectedWh }: { item: InventoryItem; selectedWh?: number }) {
  const tone = stockTone(item.stock);
  const filteredLocations: InventoryLocation[] = selectedWh
    ? item.inventory.filter((loc) => loc.locationId === selectedWh)
    : item.inventory;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.top}>
        <View style={cardStyles.nameBlock}>
          <Text style={cardStyles.name} numberOfLines={1}>{item.productName}</Text>
          {item.variantName ? (
            <Text style={cardStyles.variant}>{item.variantName}</Text>
          ) : null}
          <Text style={cardStyles.sku}>SKU: {item.sku}</Text>
        </View>
        <View style={[cardStyles.stockBadge, { backgroundColor: tone.bg }]}>
          <Text style={[cardStyles.stockNum, { color: tone.text }]}>{item.stock}</Text>
          <Text style={[cardStyles.stockLabel, { color: tone.text }]}>{tone.label}</Text>
        </View>
      </View>

      {filteredLocations.length > 0 && (
        <View style={cardStyles.locations}>
          {filteredLocations.map((loc) => {
            const t = stockTone(loc.quantity);
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
    </View>
  );
}

function StatChip({ label, value, bg, text }: { label: string; value: string; bg: string; text: string }) {
  return (
    <View style={[statStyles.chip, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color: text }]}>{value}</Text>
      <Text style={[statStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 2 },
  value: { fontSize: 20, fontWeight: "800" },
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
  listContent: { padding: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
