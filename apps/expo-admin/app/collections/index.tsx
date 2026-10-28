import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { getImageUrl } from "@/lib/images";
import { deleteCollection, getCollections, updateCollectionStatus } from "@/services/collections";
import type { Collection, CollectionType } from "@/types/collection";

const PAGE_SIZE = 20;
type TypeFilter = "all" | CollectionType;

const FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
];

export default function CollectionsScreen() {
  const { canRead, canWrite, canDelete } = useAuth();
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await getCollections({
        page: 1,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setItems(res.data);
      setTotal(res.total);
      setPage(1);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load collections."));
    } finally {
      setLoading(false);
      loadedOnce.current = true;
    }
  }, [debouncedSearch, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh silently when coming back from create / edit.
  useFocusEffect(
    useCallback(() => {
      if (loadedOnce.current) void load(false);
    }, [load]),
  );

  if (!canRead("Collections")) return <AccessDenied />;

  const loadMore = async () => {
    if (loading || loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getCollections({
        page: next,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setItems((prev) => [...prev, ...res.data.filter((c) => !prev.some((p) => p.id === c.id))]);
      setPage(next);
      setTotal(res.total);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const togglePublished = async (item: Collection, value: boolean) => {
    setTogglingId(item.id);
    setItems((cur) => cur.map((c) => (c.id === item.id ? { ...c, isPublished: value } : c)));
    try {
      const updated = await updateCollectionStatus(item.id, value);
      if (updated) setItems((cur) => cur.map((c) => (c.id === item.id ? { ...c, isPublished: updated.isPublished } : c)));
    } catch (err) {
      setItems((cur) => cur.map((c) => (c.id === item.id ? { ...c, isPublished: !value } : c)));
      Alert.alert("Update failed", apiErrorMessage(err, "Could not update the collection."));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = (item: Collection) => {
    Alert.alert("Delete collection", `Delete "${item.name}"? Products are not deleted. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCollection(item.id);
            setItems((cur) => cur.filter((c) => c.id !== item.id));
            setTotal((t) => Math.max(0, t - 1));
          } catch (err) {
            Alert.alert("Delete failed", apiErrorMessage(err, "Could not delete the collection."));
          }
        },
      },
    ]);
  };

  const openMenu = (item: Collection) => {
    Alert.alert(item.name, undefined, [
      { text: canWrite("Collections") ? "Edit" : "View", onPress: () => router.push(`/collections/${item.id}` as any) },
      ...(canDelete("Collections")
        ? [{ text: "Delete", style: "destructive" as const, onPress: () => confirmDelete(item) }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Collections</Text>
          {!loading ? <Text style={styles.subtitle}>{total} total</Text> : null}
        </View>
        {canWrite("Collections") ? (
          <Pressable style={styles.addBtn} onPress={() => router.push("/collections/create" as any)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search collections..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, typeFilter === f.value && styles.filterChipActive]}
            onPress={() => setTypeFilter(f.value)}
          >
            <Text style={[styles.filterText, typeFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item }) => {
            const uri = getImageUrl(item.imageUrl ?? item.image);
            const hidden =
              item.visibleProductCount !== undefined && item.visibleProductCount < item.productCount
                ? item.productCount - item.visibleProductCount
                : 0;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/collections/${item.id}` as any)}
                onLongPress={() => openMenu(item)}
              >
                {uri ? (
                  <Image source={{ uri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="albums-outline" size={22} color={colors.muted} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, item.type === "automatic" ? styles.badgeAuto : styles.badgeManual]}>
                      <Ionicons
                        name={item.type === "automatic" ? "flash-outline" : "hand-left-outline"}
                        size={11}
                        color={item.type === "automatic" ? "#7c3aed" : "#1d4ed8"}
                      />
                      <Text style={[styles.badgeText, { color: item.type === "automatic" ? "#7c3aed" : "#1d4ed8" }]}>
                        {item.type === "automatic" ? "Automatic" : "Manual"}
                      </Text>
                    </View>
                    {item.showOnHomepage ? (
                      <View style={[styles.badge, styles.badgeHome]}>
                        <Ionicons name="home-outline" size={11} color="#b45309" />
                        <Text style={[styles.badgeText, { color: "#b45309" }]}>Homepage</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.productCount} product{item.productCount === 1 ? "" : "s"}
                    {hidden > 0 ? `  ·  ${hidden} hidden online` : ""}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Switch
                    value={item.isPublished}
                    onValueChange={(v) => void togglePublished(item, v)}
                    disabled={!canWrite("Collections") || togglingId === item.id}
                    trackColor={{ true: colors.primary, false: "#cbd5e1" }}
                  />
                  <Text style={[styles.pubText, item.isPublished && { color: colors.primaryDark }]}>
                    {item.isPublished ? "Published" : "Hidden"}
                  </Text>
                  {canDelete("Collections") ? (
                    <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={styles.trashBtn}>
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={error ? "alert-circle-outline" : "albums-outline"} size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>{error ? "Couldn't load collections" : "No collections found"}</Text>
              <Text style={styles.emptyText}>
                {error ?? (search || typeFilter !== "all"
                  ? "Try a different search or filter."
                  : "Group products into collections for your storefront.")}
              </Text>
              {!error && !search && typeFilter === "all" && canWrite("Collections") ? (
                <Pressable style={styles.emptyBtn} onPress={() => router.push("/collections/create" as any)}>
                  <Text style={styles.emptyBtnText}>Create collection</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12 },
  addBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 8, height: 44,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: "#fff" },
  listContent: { padding: 16, paddingTop: 8, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#f1f5f9" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeManual: { backgroundColor: "#dbeafe" },
  badgeAuto: { backgroundColor: "#ede9fe" },
  badgeHome: { backgroundColor: "#fef3c7" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cardMeta: { color: colors.muted, fontSize: 12 },
  cardRight: { alignItems: "center", gap: 2 },
  pubText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  trashBtn: {
    marginTop: 4, width: 28, height: 28, borderRadius: 8, backgroundColor: "#fee2e2",
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  emptyBtn: {
    marginTop: 6, borderRadius: 12, backgroundColor: colors.primaryDark,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
