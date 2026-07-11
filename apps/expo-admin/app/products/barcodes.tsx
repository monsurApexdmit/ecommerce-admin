import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { getProducts } from "@/services/products";
import type { Product } from "@/types/product";
import { BarcodeGraphic } from "@/components/products/BarcodeGraphic";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

type QueueItem = {
  product: Product;
  quantity: number;
};

export default function BulkBarcodesScreen() {
  const { formatCurrency } = useCurrency();
  const navigation = useNavigation();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: "Bulk Barcodes" });
  }, [navigation]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }

      const response = await getProducts({ search, limit: 10 });
      setResults(response.data);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const expandedQueue = useMemo(
    () =>
      queue.flatMap((item) =>
        Array.from({ length: item.quantity }, (_, index) => ({
          key: `${item.product.id}-${index}`,
          product: item.product,
        })),
      ),
    [queue],
  );

  const { canRead } = useAuth();
  if (!canRead('Print Barcode')) return <AccessDenied />;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search product by name or SKU"
          style={styles.searchInput}
        />
      </View>

      {results.length > 0 ? (
        <View style={styles.results}>
          {results.map((product) => (
            <Pressable
              key={product.id}
              style={styles.resultItem}
              onPress={() => {
                setQueue((current) => {
                  const existing = current.find((item) => item.product.id === product.id);
                  if (existing) {
                    return current.map((item) =>
                      item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item,
                    );
                  }

                  return [...current, { product, quantity: 1 }];
                });
                setSearch("");
                setResults([]);
              }}
            >
              <Text style={styles.resultName}>{product.name}</Text>
              <Text style={styles.resultMeta}>{product.sku || "-"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={queue}
        keyExtractor={(item) => String(item.product.id)}
        renderItem={({ item }) => (
          <View style={styles.queueCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.queueTitle}>{item.product.name}</Text>
              <Text style={styles.queueMeta}>
                {item.product.sku || "-"} · {formatCurrency(item.product.salePrice || item.product.price)}
              </Text>
            </View>
            <View style={styles.quantityWrap}>
              <Pressable
                style={styles.qtyButton}
                onPress={() =>
                  setQueue((current) =>
                    current
                      .map((entry) =>
                        entry.product.id === item.product.id
                          ? { ...entry, quantity: Math.max(1, entry.quantity - 1) }
                          : entry,
                      )
                      .filter((entry) => entry.quantity > 0),
                  )
                }
              >
                <Ionicons name="remove" size={16} color={colors.text} />
              </Pressable>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <Pressable
                style={styles.qtyButton}
                onPress={() =>
                  setQueue((current) =>
                    current.map((entry) =>
                      entry.product.id === item.product.id
                        ? { ...entry, quantity: entry.quantity + 1 }
                        : entry,
                    ),
                  )
                }
              >
                <Ionicons name="add" size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>Print queue</Text>
            <Text style={styles.subtitle}>
              Add products from search, then review the live barcode preview below.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.previewSection}>
            <Text style={styles.heading}>Preview</Text>
            <View style={styles.previewGrid}>
              {expandedQueue.map((entry) => {
                const value = entry.product.barcode || entry.product.sku || String(entry.product.id);
                return (
                  <View key={entry.key} style={styles.previewCard}>
                    <Text style={styles.previewTitle} numberOfLines={2}>
                      {entry.product.name}
                    </Text>
                    <BarcodeGraphic value={value} singleBarWidth={1.2} height={54} />
                    <Text style={styles.previewCode}>{value}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 12,
  },
  searchWrap: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  results: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  listContent: {
    paddingBottom: 40,
    gap: 14,
  },
  headerBlock: {
    gap: 4,
    marginBottom: 10,
  },
  heading: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  queueCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  queueTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  queueMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  quantityWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    minWidth: 18,
    textAlign: "center",
  },
  previewSection: {
    gap: 12,
    marginTop: 18,
  },
  previewGrid: {
    gap: 12,
  },
  previewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  previewTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  previewCode: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
