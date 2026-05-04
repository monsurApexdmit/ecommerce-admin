import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { buildProductFileAsset, createProduct, updateProduct } from "@/services/products";
import { getAttributes, getCategories, getVendors, getWarehouses } from "@/services/catalog";
import { formatCurrency } from "@/lib/format";
import { generateBarcodeCode, generateProductSku, generateVariantDrafts } from "@/lib/variants";
import { getImageUrl } from "@/lib/images";
import type { Attribute, Category, Vendor, Warehouse } from "@/types/catalog";
import type {
  Product,
  ProductAttributeSelection,
  ProductDraft,
  ProductFileAsset,
  ProductVariant,
} from "@/types/product";
import { PickerField } from "./PickerField";
import { ProductStatusPill } from "./ProductStatusPill";

type ProductFormProps = {
  product?: Product | null;
  onSaved: (product: Product) => void;
  onCancel?: () => void;
};

type FormState = {
  name: string;
  description: string;
  category: string;
  categoryId: string;
  vendorId: string;
  locationId: string;
  price: string;
  salePrice: string;
  costPrice: string;
  profitMargin: string;
  marginType: string;
  stock: string;
  sku: string;
  barcode: string;
  receiptNumber: string;
  published: boolean;
  isHotDeal: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  dealLabel: string;
};

function getInitialForm(product?: Product | null): FormState {
  if (!product) {
    return {
      name: "",
      description: "",
      category: "",
      categoryId: "",
      vendorId: "",
      locationId: "",
      price: "",
      salePrice: "",
      costPrice: "",
      profitMargin: "",
      marginType: "percentage",
      stock: "",
      sku: generateProductSku(),
      barcode: generateBarcodeCode(),
      receiptNumber: "",
      published: true,
      isHotDeal: false,
      isBestSeller: false,
      isFeatured: false,
      dealLabel: "",
    };
  }

  return {
    name: product.name,
    description: product.description,
    category: product.category,
    categoryId: product.categoryId ? String(product.categoryId) : "",
    vendorId: product.vendorId ? String(product.vendorId) : "",
    locationId: product.locationId ? String(product.locationId) : "",
    price: product.price ? String(product.price) : "",
    salePrice: product.salePrice ? String(product.salePrice) : "",
    costPrice: product.costPrice ? String(product.costPrice) : "",
    profitMargin: product.profitMargin ? String(product.profitMargin) : "",
    marginType: product.marginType ?? "percentage",
    stock: String(product.stock),
    sku: product.sku ?? "",
    barcode: product.barcode ?? generateBarcodeCode(),
    receiptNumber: product.receiptNumber ?? "",
    published: product.published,
    isHotDeal: Boolean(product.isHotDeal),
    isBestSeller: Boolean(product.isBestSeller),
    isFeatured: Boolean(product.isFeatured),
    dealLabel: product.dealLabel ?? "",
  };
}

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<FormState>(() => getInitialForm(product));
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>(
    product?.attributes.map((attribute) => attribute.id) ?? [],
  );
  const [productAttributes, setProductAttributes] = useState<ProductAttributeSelection[]>(
    product?.attributes ?? [],
  );
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [existingImages, setExistingImages] = useState(product?.images ?? []);
  const [localImages, setLocalImages] = useState<ProductFileAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(Boolean(product?.sku));

  useEffect(() => {
    setForm(getInitialForm(product));
    setSelectedAttributeIds(product?.attributes.map((attribute) => attribute.id) ?? []);
    setProductAttributes(product?.attributes ?? []);
    setVariants(product?.variants ?? []);
    setExistingImages(product?.images ?? []);
    setLocalImages([]);
    setSkuManuallyEdited(Boolean(product?.sku));
  }, [product]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setLoading(true);
        const [nextCategories, nextVendors, nextWarehouses, nextAttributes] =
          await Promise.all([
            getCategories(),
            getVendors(),
            getWarehouses(),
            getAttributes(),
          ]);

        setCategories(nextCategories);
        setVendors(nextVendors);
        setWarehouses(nextWarehouses);
        setAttributes(nextAttributes);

        if (!product && nextWarehouses.length > 0 && !form.locationId) {
          const defaultWarehouse =
            nextWarehouses.find((warehouse) => warehouse.isDefault) ?? nextWarehouses[0];
          setForm((current) => ({
            ...current,
            locationId: String(defaultWarehouse.id),
          }));
        }
      } catch (nextError: any) {
        setError(nextError?.message ?? "Failed to load product form data");
      } finally {
        setLoading(false);
      }
    };

    void loadLookups();
  }, []);

  useEffect(() => {
    const cost = Number(form.costPrice);
    const margin = Number(form.profitMargin);
    if (!Number.isFinite(cost) || !Number.isFinite(margin) || cost < 0 || margin < 0) return;

    const sale =
      form.marginType === "flat" ? cost + margin : cost + (cost * margin) / 100;
    if (Number.isFinite(sale)) {
      setForm((current) => ({ ...current, salePrice: sale.toFixed(2) }));
    }
  }, [form.costPrice, form.profitMargin, form.marginType]);

  useEffect(() => {
    if (variants.length === 0) return;

    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    setForm((current) => ({ ...current, stock: String(totalStock) }));
  }, [variants]);

  useEffect(() => {
    if (product || skuManuallyEdited) return;
    setForm((current) => ({
      ...current,
      sku: generateProductSku(),
    }));
  }, [product, skuManuallyEdited]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.parentId ? `└ ${category.categoryName}` : category.categoryName,
      })),
    [categories],
  );
  const vendorOptions = useMemo(
    () => vendors.map((vendor) => ({ value: String(vendor.id), label: vendor.name })),
    [vendors],
  );
  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: String(warehouse.id),
        label: warehouse.name,
      })),
    [warehouses],
  );

  const imagePreviews = useMemo(
    () => [
      ...existingImages.map((image) => ({ key: `existing-${image.path}`, uri: getImageUrl(image.path), existing: true, path: image.path })),
      ...localImages.map((image) => ({ key: `local-${image.uri}`, uri: image.uri, existing: false, path: image.uri })),
    ],
    [existingImages, localImages],
  );

  const setField = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleAttribute = (attribute: Attribute) => {
    const id = String(attribute.id);
    const isSelected = selectedAttributeIds.includes(id);

    if (isSelected) {
      setSelectedAttributeIds((current) => current.filter((item) => item !== id));
      setProductAttributes((current) => current.filter((item) => item.id !== id));
      setVariants((current) =>
        current.filter((variant) => !Object.prototype.hasOwnProperty.call(variant.attributes, attribute.name)),
      );
      return;
    }

    setSelectedAttributeIds((current) => [...current, id]);
    setProductAttributes((current) => [
      ...current,
      {
        id,
        name: attribute.name,
        value: [],
      },
    ]);
  };

  const updateAttributeValues = (attributeId: string, value: string | string[]) => {
    setProductAttributes((current) =>
      current.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, value } : attribute,
      ),
    );
  };

  const addImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Media library access is required to upload product images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6,
    });

    if (result.canceled) return;

    setLocalImages((current) => [
      ...current,
      ...result.assets.map((asset) => buildProductFileAsset(asset)),
    ]);
  };

  const removePreview = (path: string, existing: boolean) => {
    if (existing) {
      setExistingImages((current) => current.filter((image) => image.path !== path));
      return;
    }

    setLocalImages((current) => current.filter((image) => image.uri !== path));
  };

  const handleGenerateVariants = () => {
    const generated = generateVariantDrafts({
      attributes: productAttributes,
      basePrice: Number(form.price) || 0,
      baseSalePrice: Number(form.salePrice) || 0,
      totalStock: Number(form.stock) || 0,
      baseSku: form.sku,
      locationId: Number(form.locationId) || undefined,
    });

    setVariants(generated);
  };

  const updateVariant = (variantId: string, field: keyof ProductVariant, value: string) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              [field]:
                field === "name" || field === "sku" || field === "barcode"
                  ? value
                  : Number(value),
            }
          : variant,
      ),
    );
  };

  const removeVariant = (variantId: string) => {
    setVariants((current) => current.filter((variant) => variant.id !== variantId));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.categoryId || !form.locationId || !form.price || !form.salePrice) {
      setError("Name, category, location, price, and sale price are required.");
      return;
    }

    setSaving(true);
    setError(null);

    const draft: ProductDraft = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      categoryId: Number(form.categoryId),
      locationId: Number(form.locationId),
      price: Number(form.price),
      salePrice: Number(form.salePrice),
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      profitMargin: form.profitMargin ? Number(form.profitMargin) : undefined,
      marginType: form.marginType,
      stock: Number(form.stock) || 0,
      published: form.published,
      isHotDeal: form.isHotDeal,
      isBestSeller: form.isBestSeller,
      isFeatured: form.isFeatured,
      dealLabel: form.dealLabel.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      receiptNumber: form.receiptNumber.trim(),
      vendorId: form.vendorId ? Number(form.vendorId) : undefined,
      attributes: productAttributes,
      variants,
      localImages,
      keepImages: existingImages.map((image) => image.path),
      deleteImages: product ? existingImages.length === 0 && localImages.length === 0 : false,
    };

    try {
      const saved = product
        ? await updateProduct(product.id, draft)
        : await createProduct(draft);
      onSaved(saved);
    } catch (nextError: any) {
      setError(nextError?.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primaryDark} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Core details</Text>
          <ProductStatusPill
            label={product ? "Editing" : "New product"}
            tone={product ? "info" : "success"}
          />
        </View>
        <Field label="Product name">
          <TextInput
            value={form.name}
            onChangeText={(value) => setField("name", value)}
            placeholder="Product title"
            style={styles.input}
          />
        </Field>
        <Field label="">
          <View style={styles.fieldHeading}>
            <Text style={styles.fieldLabel}>Product SKU</Text>
            {!product && !skuManuallyEdited ? (
              <ProductStatusPill label="Auto-Generated" tone="success" />
            ) : null}
          </View>
          <View style={styles.inline}>
            <TextInput
              value={form.sku}
              onChangeText={(value) => {
                setSkuManuallyEdited(true);
                setField("sku", value.toUpperCase());
              }}
              placeholder="Product SKU"
              autoCapitalize="characters"
              style={[styles.input, styles.flex]}
            />
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setSkuManuallyEdited(false);
                setField("sku", generateProductSku());
              }}
            >
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </Pressable>
          </View>
        </Field>
        <Field label="Barcode">
          <View style={styles.inline}>
            <TextInput
              value={form.barcode}
              onChangeText={(value) => setField("barcode", value)}
              placeholder="Product barcode"
              autoCapitalize="characters"
              style={[styles.input, styles.flex]}
            />
            <Pressable style={styles.secondaryButton} onPress={() => setField("barcode", generateBarcodeCode())}>
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </Pressable>
          </View>
        </Field>
        <Field label="Receipt number">
          <TextInput
            value={form.receiptNumber}
            onChangeText={(value) => setField("receiptNumber", value)}
            placeholder="Optional"
            style={styles.input}
          />
        </Field>
        <PickerField
          label="Category"
          placeholder="Select category"
          value={form.categoryId}
          options={categoryOptions}
          onChange={(value) => {
            const selected = categories.find((category) => String(category.id) === value);
            setForm((current) => ({
              ...current,
              categoryId: value,
              category: selected?.categoryName ?? current.category,
            }));
          }}
        />
        <PickerField
          label="Vendor"
          placeholder="Select vendor"
          value={form.vendorId}
          options={vendorOptions}
          onChange={(value) => setField("vendorId", value)}
          allowEmpty
        />
        <PickerField
          label="Location"
          placeholder="Select location"
          value={form.locationId}
          options={warehouseOptions}
          onChange={(value) => setField("locationId", value)}
        />
        <Field label="Description">
          <TextInput
            value={form.description}
            onChangeText={(value) => setField("description", value)}
            placeholder="Product description"
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing and stock</Text>
        <View style={styles.twoUp}>
          <Field label="Price">
            <TextInput
              value={form.price}
              onChangeText={(value) => setField("price", value)}
              keyboardType="decimal-pad"
              placeholder="0"
              style={styles.input}
            />
          </Field>
          <Field label="Cost price">
            <TextInput
              value={form.costPrice}
              onChangeText={(value) => setField("costPrice", value)}
              keyboardType="decimal-pad"
              placeholder="0"
              style={styles.input}
            />
          </Field>
          <Field label={form.marginType === "flat" ? "Flat margin" : "Margin %"}>
            <TextInput
              value={form.profitMargin}
              onChangeText={(value) => setField("profitMargin", value)}
              keyboardType="decimal-pad"
              placeholder="0"
              style={styles.input}
            />
          </Field>
          <Field label="Sale price">
            <TextInput
              value={form.salePrice}
              onChangeText={(value) => setField("salePrice", value)}
              keyboardType="decimal-pad"
              placeholder="0"
              style={styles.input}
            />
          </Field>
        </View>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.segment, form.marginType === "percentage" ? styles.segmentActive : null]}
            onPress={() => setField("marginType", "percentage")}
          >
            <Text style={[styles.segmentText, form.marginType === "percentage" ? styles.segmentTextActive : null]}>
              Percentage
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, form.marginType === "flat" ? styles.segmentActive : null]}
            onPress={() => setField("marginType", "flat")}
          >
            <Text style={[styles.segmentText, form.marginType === "flat" ? styles.segmentTextActive : null]}>
              Flat
            </Text>
          </Pressable>
        </View>
        <View style={styles.priceInfo}>
          <Text style={styles.priceInfoText}>
            Selling at {formatCurrency(Number(form.salePrice) || 0)}
          </Text>
        </View>
        <Field label="Stock">
          <TextInput
            value={form.stock}
            onChangeText={(value) => setField("stock", value)}
            keyboardType="number-pad"
            placeholder="0"
            style={styles.input}
          />
        </Field>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storefront flags</Text>
        <ToggleRow label="Published" value={form.published} onChange={(value) => setField("published", value)} />
        <ToggleRow label="Hot deal" value={form.isHotDeal} onChange={(value) => setField("isHotDeal", value)} />
        <ToggleRow label="Best seller" value={form.isBestSeller} onChange={(value) => setField("isBestSeller", value)} />
        <ToggleRow label="Featured" value={form.isFeatured} onChange={(value) => setField("isFeatured", value)} />
        <Field label="Deal label">
          <TextInput
            value={form.dealLabel}
            onChangeText={(value) => setField("dealLabel", value)}
            placeholder="Flash Sale, Limited Offer, 40% Off"
            style={styles.input}
          />
        </Field>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Images</Text>
          <Pressable style={styles.secondaryButton} onPress={addImages}>
            <Ionicons name="images-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.secondaryButtonText}>Add images</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
          {imagePreviews.map((image, index) => (
            <View key={image.key} style={styles.previewCard}>
              {image.uri ? <Image source={{ uri: image.uri }} style={styles.previewImage} /> : null}
              <Pressable
                style={styles.removeBadge}
                onPress={() => removePreview(image.path, image.existing)}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
              {index === 0 ? <Text style={styles.primaryLabel}>Primary</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attributes and variants</Text>
        <View style={styles.attributeGrid}>
          {attributes.map((attribute) => {
            const selected = selectedAttributeIds.includes(String(attribute.id));
            return (
              <Pressable
                key={attribute.id}
                style={[styles.attributeToggle, selected ? styles.attributeToggleActive : null]}
                onPress={() => toggleAttribute(attribute)}
              >
                <Text style={[styles.attributeText, selected ? styles.attributeTextActive : null]}>
                  {attribute.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {productAttributes.map((attribute) => {
          const attributeDefinition = attributes.find((item) => String(item.id) === attribute.id);
          const selectedValues = Array.isArray(attribute.value) ? attribute.value : [attribute.value];

          return (
            <View key={attribute.id} style={styles.attributePanel}>
              <Text style={styles.attributePanelTitle}>
                {attributeDefinition?.displayName ?? attribute.name}
              </Text>
              {attributeDefinition?.values?.length ? (
                <View style={styles.attributeValues}>
                  {attributeDefinition.values.map((value) => {
                    const isSelected = selectedValues.includes(value);
                    return (
                      <Pressable
                        key={value}
                        style={[styles.attributeValueChip, isSelected ? styles.attributeValueChipActive : null]}
                        onPress={() => {
                          const nextValues = isSelected
                            ? selectedValues.filter((item) => item !== value)
                            : [...selectedValues.filter(Boolean), value];
                          updateAttributeValues(attribute.id, nextValues);
                        }}
                      >
                        <Text
                          style={[
                            styles.attributeValueText,
                            isSelected ? styles.attributeValueTextActive : null,
                          ]}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  value={Array.isArray(attribute.value) ? attribute.value.join(", ") : attribute.value}
                  onChangeText={(value) => updateAttributeValues(attribute.id, value)}
                  placeholder={`Enter ${attribute.name}`}
                  style={styles.input}
                />
              )}
            </View>
          );
        })}

        {productAttributes.length > 0 ? (
          <Pressable style={styles.primaryButton} onPress={handleGenerateVariants}>
            <Text style={styles.primaryButtonText}>Generate variants</Text>
          </Pressable>
        ) : null}

        {variants.map((variant) => (
          <View key={variant.id} style={styles.variantCard}>
            <View style={styles.variantHeader}>
              <Text style={styles.variantName}>{variant.name}</Text>
              <Pressable onPress={() => removeVariant(variant.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.twoUp}>
              <Field label="Price">
                <TextInput
                  value={String(variant.price)}
                  onChangeText={(value) => updateVariant(variant.id, "price", value)}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="Sale price">
                <TextInput
                  value={String(variant.salePrice)}
                  onChangeText={(value) => updateVariant(variant.id, "salePrice", value)}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="Stock">
                <TextInput
                  value={String(variant.stock)}
                  onChangeText={(value) => updateVariant(variant.id, "stock", value)}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="SKU">
                <TextInput
                  value={variant.sku}
                  onChangeText={(value) => updateVariant(variant.id, "sku", value)}
                  style={styles.input}
                />
              </Field>
            </View>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footer}>
        {onCancel ? (
          <Pressable style={styles.footerSecondaryButton} onPress={onCancel}>
            <Text style={styles.footerSecondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.footerPrimaryButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.footerPrimaryButtonText}>
              {product ? "Update product" : "Create product"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleItem}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  field: {
    gap: 8,
  },
  fieldHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textarea: {
    minHeight: 120,
  },
  twoUp: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 12,
    alignItems: "center",
  },
  segmentActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: colors.primaryDark,
  },
  priceInfo: {
    borderRadius: 14,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceInfoText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "700",
  },
  toggleItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  imageRow: {
    gap: 12,
  },
  previewCard: {
    width: 104,
    height: 116,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 6,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 82,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  removeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  attributeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  attributeToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attributeToggleActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  attributeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  attributeTextActive: {
    color: colors.primaryDark,
  },
  attributePanel: {
    gap: 10,
  },
  attributePanelTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  attributeValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attributeValueChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attributeValueChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  attributeValueText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  attributeValueTextActive: {
    color: "#fff",
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  variantCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  variantHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  variantName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  footerSecondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    alignItems: "center",
  },
  footerSecondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  footerPrimaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrimaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
