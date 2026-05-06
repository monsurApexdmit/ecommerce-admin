import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { getProductById } from "@/services/products";
import type { Product } from "@/types/product";
import { BarcodeGraphic } from "@/components/products/BarcodeGraphic";

export default function ProductBarcodeScreen() {
  const { formatCurrency } = useCurrency();
  const params = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const nextProduct = await getProductById(Number(params.id));
        setProduct(nextProduct);
        navigation.setOptions({ title: "Product Barcode" });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigation, params.id]);

  if (loading || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryDark} size="large" />
      </View>
    );
  }

  const barcodeValue = product.barcode || product.sku || String(product.id);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.sku}>SKU: {product.sku || "-"}</Text>
        <View style={styles.barcodeWrap}>
          <BarcodeGraphic value={barcodeValue} />
        </View>
        <Text style={styles.barcodeValue}>{barcodeValue}</Text>
        <Text style={styles.price}>{formatCurrency(product.salePrice || product.price)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void Share.share({ message: `${product.name}\nBarcode: ${barcodeValue}\nSKU: ${product.sku || "-"}` })}
        >
          <Text style={styles.secondaryButtonText}>Share code</Text>
        </Pressable>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Barcode ready</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 16,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  productName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  sku: {
    color: colors.muted,
    fontSize: 13,
  },
  barcodeWrap: {
    paddingVertical: 10,
    alignItems: "center",
  },
  barcodeValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  price: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
