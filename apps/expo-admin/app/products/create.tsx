import { useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { ProductForm } from "@/components/products/ProductForm";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

export default function CreateProductScreen() {
  const navigation = useNavigation();
  const router = useRouter();

  useEffect(() => {
    navigation.setOptions({ title: "Create Product" });
  }, [navigation]);

  const { canRead } = useAuth();
  if (!canRead('Products')) return <AccessDenied />;

  return (
    <Screen>
      <ProductForm
        onSaved={(product) => {
          router.replace(`/products/${product.id}`);
        }}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}
