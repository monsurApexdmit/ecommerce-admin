import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { apiErrorMessage } from "@/lib/format";
import { getImageUrl } from "@/lib/images";
import { getBrands, getCategories } from "@/services/catalog";
import { createCollection, previewCollection, updateCollection } from "@/services/collections";
import { PickerField } from "@/components/products/PickerField";
import { ProductPickerSheet } from "@/components/collections/ProductPickerSheet";
import { RuleEditor, ruleProblem } from "@/components/collections/RuleEditor";
import type { Brand, Category } from "@/types/catalog";
import type {
  Collection,
  CollectionImageFile,
  CollectionMatch,
  CollectionPreview,
  CollectionProductLite,
  CollectionProductSort,
  CollectionRule,
  CollectionType,
} from "@/types/collection";

const SORT_OPTIONS: { value: CollectionProductSort; label: string }[] = [
  { value: "manual", label: "Manual order" },
  { value: "best_selling", label: "Best selling" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name (A–Z)" },
];

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

type Props = {
  initial?: Collection | null;
  title: string;
  readOnly?: boolean;
  onSaved: (collection: Collection) => void;
  onBack: () => void;
  /** Extra header action (e.g. delete) shown in edit mode. */
  headerRight?: React.ReactNode;
};

export function CollectionForm({ initial, title, readOnly = false, onSaved, onBack, headerRight }: Props) {
  const { formatCurrency } = useCurrency();
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<CollectionType>(initial?.type ?? "manual");
  const [match, setMatch] = useState<CollectionMatch>(initial?.match ?? "all");
  const [rules, setRules] = useState<CollectionRule[]>(initial?.rules ?? []);
  const [products, setProducts] = useState<CollectionProductLite[]>(initial?.products ?? []);
  const [productSort, setProductSort] = useState<CollectionProductSort>(initial?.productSort ?? "manual");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [showOnHomepage, setShowOnHomepage] = useState(initial?.showOnHomepage ?? false);
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [imageFile, setImageFile] = useState<CollectionImageFile | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSeq = useRef(0);

  useEffect(() => {
    void getCategories().then(setCategories).catch(() => setCategories([]));
    void getBrands().then(setBrands).catch(() => setBrands([]));
  }, []);

  // Auto slug from name until the slug is edited by hand.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Manual collections default to manual order; automatic has no manual order.
  useEffect(() => {
    if (type === "automatic" && productSort === "manual") setProductSort("best_selling");
  }, [type, productSort]);

  const sortOptions = type === "automatic" ? SORT_OPTIONS.filter((o) => o.value !== "manual") : SORT_OPTIONS;

  const rulesProblem = useMemo(() => {
    for (const rule of rules) {
      const p = ruleProblem(rule);
      if (p) return p;
    }
    return null;
  }, [rules]);

  // Live preview of rule matches (debounced).
  useEffect(() => {
    if (type !== "automatic") return;
    if (rules.length === 0 || rulesProblem) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewCollection({ type, match, rules, limit: 6 })
        .then((res) => {
          if (seq !== previewSeq.current) return;
          setPreview(res);
          setPreviewError(null);
        })
        .catch((error) => {
          if (seq !== previewSeq.current) return;
          setPreview(null);
          setPreviewError(apiErrorMessage(error, "Could not load the preview."));
        })
        .finally(() => {
          if (seq === previewSeq.current) setPreviewLoading(false);
        });
    }, 600);
    return () => clearTimeout(t);
  }, [type, match, rules, rulesProblem]);

  const existingImage = removeImage ? null : getImageUrl(initial?.imageUrl ?? initial?.image ?? null);
  const imageUri = imageFile?.uri ?? existingImage;

  const pickImage = async (source: "library" | "camera") => {
    const permission =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        source === "library" ? "Media library access is required to choose an image." : "Camera access is required to take a photo.",
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsEditing: true, aspect: [4, 3] };
    const result =
      source === "library" ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageFile({
      uri: asset.uri,
      name: asset.fileName ?? `collection-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    });
    setRemoveImage(false);
  };

  const chooseImage = () => {
    Alert.alert("Collection image", undefined, [
      { text: "Choose from library", onPress: () => void pickImage("library") },
      { text: "Take photo", onPress: () => void pickImage("camera") },
      ...(imageUri
        ? [{ text: "Remove image", style: "destructive" as const, onPress: () => { setImageFile(null); setRemoveImage(true); } }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const moveProduct = (index: number, delta: -1 | 1) => {
    setProducts((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Enter a collection name.");
      return;
    }
    if (type === "automatic") {
      if (rules.length === 0) {
        Alert.alert("Add a condition", "Automatic collections need at least one condition.");
        return;
      }
      if (rulesProblem) {
        Alert.alert("Incomplete condition", rulesProblem);
        return;
      }
    }

    const productIds = products.map((p) => p.id);
    try {
      setSaving(true);
      const draft = {
        name,
        slug: slug || slugify(name),
        description,
        type,
        match,
        rules,
        productSort,
        isPublished,
        showOnHomepage,
        seoTitle,
        seoDescription,
        imageFile,
        removeImage: removeImage && !imageFile,
        productIds: type === "manual" ? productIds : undefined,
      };
      // Create/update also save the manual product list in order (productIds).
      const saved = isEdit && initial ? await updateCollection(initial.id, draft) : await createCollection(draft);
      onSaved(saved);
    } catch (error) {
      Alert.alert("Save failed", apiErrorMessage(error, "Could not save the collection."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Pressable onPress={onBack} hitSlop={12} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={s.headerRight}>
          {headerRight}
          {!readOnly ? (
            <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Save</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {readOnly ? (
            <View style={s.notice}>
              <Ionicons name="eye-outline" size={16} color={colors.info} />
              <Text style={s.noticeText}>View only — you don't have permission to edit collections.</Text>
            </View>
          ) : null}

          {/* Basics */}
          <View style={s.card}>
            <Pressable style={s.imageBox} onPress={readOnly ? undefined : chooseImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={s.image} resizeMode="cover" />
              ) : (
                <View style={s.imageEmpty}>
                  <Ionicons name="image-outline" size={28} color={colors.muted} />
                  <Text style={s.imageHint}>{readOnly ? "No image" : "Add collection image"}</Text>
                </View>
              )}
              {!readOnly && imageUri ? (
                <View style={s.imageEdit}>
                  <Ionicons name="camera-outline" size={14} color="#fff" />
                  <Text style={s.imageEditText}>Change</Text>
                </View>
              ) : null}
            </Pressable>

            <Field label="Name *" value={name} onChange={setName} placeholder="e.g. Summer Essentials" editable={!readOnly} autoCapitalize="sentences" />
            <Field
              label="Slug"
              value={slug}
              onChange={(v) => {
                setSlugTouched(true);
                setSlug(slugify(v));
              }}
              placeholder="summer-essentials"
              editable={!readOnly}
              hint={`URL: /collections/${slug || "…"}`}
            />
            <Field
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="What's in this collection?"
              multiline
              editable={!readOnly}
              autoCapitalize="sentences"
            />
          </View>

          {/* Type */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Collection type</Text>
            <View style={s.typeRow}>
              <TypeOption
                active={type === "manual"}
                icon="hand-left-outline"
                title="Manual"
                body="Pick products and set their order."
                onPress={() => !readOnly && setType("manual")}
              />
              <TypeOption
                active={type === "automatic"}
                icon="flash-outline"
                title="Automatic"
                body="Products that match conditions are added automatically."
                onPress={() => !readOnly && setType("automatic")}
              />
            </View>
          </View>

          {/* Products / Rules */}
          {type === "manual" ? (
            <View style={s.card}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Products ({products.length})</Text>
                {!readOnly ? (
                  <Pressable style={s.smallBtn} onPress={() => setPickerOpen(true)}>
                    <Ionicons name="add" size={16} color={colors.primaryDark} />
                    <Text style={s.smallBtnText}>Add</Text>
                  </Pressable>
                ) : null}
              </View>
              {products.length === 0 ? (
                <Text style={s.hint}>No products yet. Tap Add to pick products.</Text>
              ) : (
                products.map((p, index) => {
                  const uri = getImageUrl(p.image);
                  return (
                    <View key={p.id} style={s.productRow}>
                      <Text style={s.position}>{index + 1}</Text>
                      {uri ? (
                        <Image source={{ uri }} style={s.thumb} />
                      ) : (
                        <View style={[s.thumb, s.thumbEmpty]}>
                          <Ionicons name="cube-outline" size={16} color={colors.muted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.productName} numberOfLines={1}>{p.name || `Product #${p.id}`}</Text>
                        {p.price !== undefined ? (
                          <Text style={s.productMeta}>
                            {formatCurrency(p.price)}
                            {p.visibleOnStorefront === false ? "  ·  Hidden online" : ""}
                          </Text>
                        ) : null}
                      </View>
                      {!readOnly ? (
                        <View style={s.rowActions}>
                          <Pressable onPress={() => moveProduct(index, -1)} disabled={index === 0} hitSlop={6} style={s.arrowBtn}>
                            <Ionicons name="chevron-up" size={16} color={index === 0 ? "#cbd5e1" : colors.text} />
                          </Pressable>
                          <Pressable
                            onPress={() => moveProduct(index, 1)}
                            disabled={index === products.length - 1}
                            hitSlop={6}
                            style={s.arrowBtn}
                          >
                            <Ionicons name="chevron-down" size={16} color={index === products.length - 1 ? "#cbd5e1" : colors.text} />
                          </Pressable>
                          <Pressable
                            onPress={() => setProducts((cur) => cur.filter((x) => x.id !== p.id))}
                            hitSlop={6}
                            style={[s.arrowBtn, { backgroundColor: "#fee2e2" }]}
                          >
                            <Ionicons name="close" size={16} color={colors.danger} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Conditions</Text>
              <View pointerEvents={readOnly ? "none" : "auto"}>
                <RuleEditor
                  match={match}
                  rules={rules}
                  categories={categories}
                  brands={brands}
                  onMatchChange={setMatch}
                  onRulesChange={setRules}
                />
              </View>

              <View style={s.previewBox}>
                <View style={s.sectionHead}>
                  <Text style={s.previewTitle}>Matching products</Text>
                  {previewLoading ? (
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                  ) : preview ? (
                    <View style={s.countPill}>
                      <Text style={s.countText}>{preview.total}</Text>
                    </View>
                  ) : null}
                </View>
                {rules.length === 0 || rulesProblem ? (
                  <Text style={s.hint}>{rulesProblem ?? "Add a condition to preview matching products."}</Text>
                ) : previewError ? (
                  <Text style={[s.hint, { color: colors.danger }]}>{previewError}</Text>
                ) : preview && preview.products.length === 0 && !previewLoading ? (
                  <Text style={s.hint}>No products match these conditions yet.</Text>
                ) : (
                  preview?.products.slice(0, 6).map((p) => {
                    const uri = getImageUrl(p.image);
                    return (
                      <View key={p.id} style={s.productRow}>
                        {uri ? (
                          <Image source={{ uri }} style={s.thumb} />
                        ) : (
                          <View style={[s.thumb, s.thumbEmpty]}>
                            <Ionicons name="cube-outline" size={16} color={colors.muted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                          <Text style={s.productMeta}>
                            {p.price !== undefined ? formatCurrency(p.price) : ""}
                            {p.visibleOnStorefront === false ? "  ·  Hidden online" : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
                {preview && preview.total > preview.products.length ? (
                  <Text style={s.hint}>
                    Showing {preview.products.length} of {preview.total} products.
                  </Text>
                ) : null}
                {preview && preview.total > 0 ? (
                  <Text style={[s.hint, preview.hint ? { color: colors.warning } : null]}>
                    {preview.hint ?? "Only published products visible online appear on the storefront."}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Display */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Display</Text>
            <View pointerEvents={readOnly ? "none" : "auto"} style={{ gap: 12 }}>
              <PickerField
                label="Default product sort"
                placeholder="Select sort"
                value={productSort}
                options={sortOptions}
                onChange={(v) => setProductSort(v as CollectionProductSort)}
              />
              <ToggleRow
                label="Published"
                hint="Visible on the storefront"
                value={isPublished}
                onChange={setIsPublished}
                disabled={readOnly}
              />
              <ToggleRow
                label="Show on homepage"
                hint="Feature this collection on the store homepage"
                value={showOnHomepage}
                onChange={setShowOnHomepage}
                disabled={readOnly}
              />
            </View>
          </View>

          {/* SEO */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>Search engine listing</Text>
            <Field
              label="SEO title"
              value={seoTitle}
              onChange={setSeoTitle}
              placeholder={name || "Page title"}
              editable={!readOnly}
              autoCapitalize="sentences"
              hint={`${seoTitle.length}/70`}
            />
            <Field
              label="SEO description"
              value={seoDescription}
              onChange={setSeoDescription}
              placeholder="Short summary for search results"
              multiline
              editable={!readOnly}
              autoCapitalize="sentences"
              hint={`${seoDescription.length}/160`}
            />
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ProductPickerSheet
        visible={pickerOpen}
        excludeIds={products.map((p) => p.id)}
        onClose={() => setPickerOpen(false)}
        onAdd={(added) => setProducts((cur) => [...cur, ...added.filter((a) => !cur.some((c) => c.id === a.id))])}
      />
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline, editable = true, hint, autoCapitalize = "none" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  hint?: string;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti, !editable && { opacity: 0.7 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        editable={editable}
        autoCapitalize={autoCapitalize}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange, disabled }: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: "#cbd5e1" }}
      />
    </View>
  );
}

function TypeOption({ active, icon, title, body, onPress }: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.typeCard, active && s.typeCardActive]} onPress={onPress}>
      <View style={s.typeHead}>
        <Ionicons name={icon} size={18} color={active ? colors.primaryDark : colors.muted} />
        <Text style={[s.typeTitle, active && { color: colors.primaryDark }]}>{title}</Text>
        {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} style={{ marginLeft: "auto" }} /> : null}
      </View>
      <Text style={s.typeBody}>{body}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveBtn: {
    minWidth: 72, height: 38, borderRadius: 12, paddingHorizontal: 16,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  content: { padding: 16, gap: 14 },
  notice: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#eff6ff", borderRadius: 12, padding: 12,
  },
  noticeText: { flex: 1, color: colors.info, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 16, gap: 12,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12 },
  input: {
    minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 15,
  },
  inputMulti: { minHeight: 96, paddingTop: 12 },
  imageBox: {
    height: 160, borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", backgroundColor: colors.background,
  },
  image: { width: "100%", height: "100%" },
  imageEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  imageHint: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  imageEdit: {
    position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(15,23,42,0.65)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  imageEditText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  typeRow: { gap: 10 },
  typeCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 4 },
  typeCardActive: { borderColor: colors.primary, backgroundColor: "#ecfdf5" },
  typeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  typeBody: { color: colors.muted, fontSize: 12 },
  smallBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#ecfdf5",
  },
  smallBtnText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  productRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  position: { width: 20, color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center" },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f1f5f9" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  productName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  productMeta: { color: colors.muted, fontSize: 12 },
  rowActions: { flexDirection: "row", gap: 4 },
  arrowBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  previewBox: {
    borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    padding: 12, gap: 6,
  },
  previewTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  countPill: { backgroundColor: colors.primaryDark, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  countText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
});
