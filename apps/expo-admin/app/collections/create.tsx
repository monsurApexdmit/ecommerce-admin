import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";
import { CollectionForm } from "@/components/collections/CollectionForm";

export default function CreateCollectionScreen() {
  const router = useRouter();
  const { canWrite } = useAuth();
  if (!canWrite("Collections")) return <AccessDenied />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <CollectionForm
        title="New collection"
        onBack={() => router.back()}
        onSaved={(collection) => router.replace(`/collections/${collection.id}` as any)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
