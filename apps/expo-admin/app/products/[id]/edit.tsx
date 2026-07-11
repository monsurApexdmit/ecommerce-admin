import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { ProductForm } from "@/components/products/ProductForm";
import { colors } from "@/constants/theme";
import { getProductById } from "@/services/products";
import type { Product } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

export default function EditProductScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: "Edit Product" });
  }, [navigation]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setProduct(await getProductById(Number(params.id)));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.id]);

  const { canRead } = useAuth();
  if (!canRead('Products')) return <AccessDenied />;

  return (
    <Screen scroll={false}>
      {loading || !product ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      ) : (
        <ProductForm
          product={product}
          onSaved={(nextProduct) => router.replace(`/products/${nextProduct.id}`)}
          onCancel={() => router.back()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 40,
    alignItems: "center",
  },
});
