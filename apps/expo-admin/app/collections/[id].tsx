import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { apiErrorMessage } from "@/lib/format";
import { deleteCollection, getCollection } from "@/services/collections";
import type { Collection } from "@/types/collection";

export default function CollectionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const collectionId = Number(params.id);
  const { canRead, canWrite, canDelete } = useAuth();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a save so the form re-mounts with the server's normalised values.
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCollection(await getCollection(collectionId));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load the collection."));
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    if (Number.isFinite(collectionId)) void load();
  }, [load, collectionId]);

  if (!canRead("Collections")) return <AccessDenied />;

  const handleDelete = () => {
    if (!collection) return;
    Alert.alert("Delete collection", `Delete "${collection.name}"? Products are not deleted. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCollection(collection.id);
            router.back();
          } catch (err) {
            Alert.alert("Delete failed", apiErrorMessage(err, "Could not delete the collection."));
          }
        },
      },
    ]);
  };

  if (loading || !collection) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Collection</Text>
        </View>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.primaryDark} size="large" />
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
              <Text style={styles.errorText}>{error ?? "Collection not found."}</Text>
              <Pressable style={styles.retryBtn} onPress={load}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <CollectionForm
        key={`${collection.id}-${formKey}`}
        initial={collection}
        title={collection.name || "Collection"}
        readOnly={!canWrite("Collections")}
        onBack={() => router.back()}
        onSaved={(saved) => {
          setCollection(saved);
          setFormKey((k) => k + 1);
          Alert.alert("Saved", "Collection updated.");
        }}
        headerRight={
          canDelete("Collections") ? (
            <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  retryBtn: { borderRadius: 12, backgroundColor: colors.primaryDark, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "800" },
  deleteBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: "#fee2e2",
    alignItems: "center", justifyContent: "center",
  },
});
