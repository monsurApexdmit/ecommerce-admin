import { useRouter } from "expo-router";
import { ProductForm } from "@/components/products/ProductForm";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

export default function CreateProductScreen() {
  const router = useRouter();

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
