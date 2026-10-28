import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { getImageUrl } from "@/lib/images";
import { getDisplayPrice, getProducts } from "@/services/products";
import type { CollectionProductLite } from "@/types/collection";

type Props = {
  visible: boolean;
  /** Ids already in the collection — shown as added and not selectable. */
  excludeIds: number[];
  onClose: () => void;
  onAdd: (products: CollectionProductLite[]) => void;
};

/** Searchable multi-select of catalog products for manual collections. */
export function ProductPickerSheet({ visible, excludeIds, onClose, onAdd }: Props) {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<CollectionProductLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<number, CollectionProductLite>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getProducts({ page: 1, limit: 30, search: debounced || undefined })
      .then((res) => {
        if (cancelled) return;
        setResults(
          res.data.map((p) => ({
            id: p.id,
            name: p.name,
            image: p.image ?? p.images?.[0]?.path ?? null,
            price: getDisplayPrice(p).price,
            sku: p.sku,
            published: p.published,
            visibleOnline: p.visibleOnline,
            visibleOnStorefront: p.published && p.visibleOnline !== false,
            stock: p.stock,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, debounced]);

  const close = () => {
    setSelected({});
    setSearch("");
    onClose();
  };

  const toggle = (p: CollectionProductLite) => {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p;
      return next;
    });
  };

  const count = Object.keys(selected).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} />
      <View style={s.sheet}>
        <View style={s.header}>
          <Text style={s.title}>Add products</Text>
          <Pressable onPress={close} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name, SKU or barcode..."
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

        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.primaryDark} /></View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.list}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<Text style={s.empty}>No products found.</Text>}
            renderItem={({ item }) => {
              const already = excludeIds.includes(item.id);
              const checked = Boolean(selected[item.id]);
              const uri = getImageUrl(item.image);
              return (
                <Pressable
                  style={[s.row, checked && s.rowChecked, already && { opacity: 0.5 }]}
                  onPress={() => !already && toggle(item)}
                  disabled={already}
                >
                  {uri ? (
                    <Image source={{ uri }} style={s.thumb} />
                  ) : (
                    <View style={[s.thumb, s.thumbEmpty]}>
                      <Ionicons name="cube-outline" size={18} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {formatCurrency(item.price ?? 0)}
                      {item.sku ? `  ·  ${item.sku}` : ""}
                      {item.visibleOnStorefront === false ? "  ·  Hidden online" : ""}
                    </Text>
                  </View>
                  {already ? (
                    <Text style={s.added}>Added</Text>
                  ) : (
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={22}
                      color={checked ? colors.primaryDark : colors.muted}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        )}

        <Pressable
          style={[s.addBtn, count === 0 && { opacity: 0.5 }]}
          disabled={count === 0}
          onPress={() => {
            onAdd(Object.values(selected));
            close();
          }}
        >
          <Text style={s.addBtnText}>{count > 0 ? `Add ${count} product${count === 1 ? "" : "s"}` : "Select products"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: "85%",
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 8, height: 44,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingTop: 8 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10,
  },
  rowChecked: { borderColor: colors.primary, backgroundColor: "#ecfdf5" },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#f1f5f9" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12 },
  added: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  addBtn: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 14, backgroundColor: colors.primaryDark,
    paddingVertical: 15, alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
