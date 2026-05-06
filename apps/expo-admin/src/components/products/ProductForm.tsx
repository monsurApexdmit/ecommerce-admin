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
import { useCurrency } from "@/context/CurrencyContext";
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
  offerPrice: string;
  offerType: string;
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
      offerPrice: "",
      offerType: "percentage",
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
    offerPrice: product.offerPrice ? String(product.offerPrice) : "",
    offerType: product.offerType ?? "percentage",
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
  const { currency, formatCurrency } = useCurrency();
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

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is required to take product photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
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
      baseOfferPrice: form.offerPrice ? Number(form.offerPrice) : undefined,
      baseOfferType: form.offerPrice ? form.offerType : undefined,
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
                field === "name" || field === "sku" || field === "barcode" || field === "offerType"
                  ? value
                  : field === "offerPrice"
                  ? (value === "" ? undefined : Number(value))
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
      offerPrice: form.offerPrice ? Number(form.offerPrice) : undefined,
      offerType: form.offerPrice ? form.offerType : undefined,
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
      <View style={s.loadingWrap}>
        <View style={s.loadingCard}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
          <Text style={s.loadingText}>Loading product data…</Text>
        </View>
      </View>
    );
  }

  const salePreview = Number(form.salePrice) || 0;
  const priceNum = Number(form.price) || 0;
  const hasDiscount = priceNum > 0 && salePreview > 0 && salePreview < priceNum;
  const discountPct = hasDiscount ? Math.round(((priceNum - salePreview) / priceNum) * 100) : 0;
  const offerNum = Number(form.offerPrice) || 0;
  const offerFinalPrice = offerNum > 0
    ? (form.offerType === "percentage"
        ? salePreview * (1 - offerNum / 100)
        : salePreview - offerNum)
    : 0;

  return (
    <ScrollView contentContainerStyle={s.root} showsVerticalScrollIndicator={false}>

      {/* ── SECTION 1: Core Details ───────────────────────────── */}
      <SectionCard step={1} icon="cube-outline" title="Product Info" badge={
        <ProductStatusPill label={product ? "Editing" : "New"} tone={product ? "info" : "success"} />
      }>
        <InputField label="Product name" icon="text-outline" required>
          <TextInput
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder="e.g. Nike Air Max 90"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>

        <InputField label="Description" icon="document-text-outline">
          <TextInput
            value={form.description}
            onChangeText={(v) => setField("description", v)}
            placeholder="Describe the product…"
            placeholderTextColor={colors.muted}
            style={[s.input, s.textarea]}
            multiline
            textAlignVertical="top"
          />
        </InputField>

        <View style={s.row2}>
          <View style={s.rowItem}>
            <PickerField
              label="Category"
              placeholder="Select category"
              value={form.categoryId}
              options={categoryOptions}
              onChange={(value) => {
                const selected = categories.find((c) => String(c.id) === value);
                setForm((cur) => ({
                  ...cur,
                  categoryId: value,
                  category: selected?.categoryName ?? cur.category,
                }));
              }}
            />
          </View>
          <View style={s.rowItem}>
            <PickerField
              label="Vendor"
              placeholder="Select vendor"
              value={form.vendorId}
              options={vendorOptions}
              onChange={(v) => setField("vendorId", v)}
              allowEmpty
            />
          </View>
        </View>

        <PickerField
          label="Warehouse / Location"
          placeholder="Select location"
          value={form.locationId}
          options={warehouseOptions}
          onChange={(v) => setField("locationId", v)}
        />
      </SectionCard>

      {/* ── SECTION 2: Identifiers ────────────────────────────── */}
      <SectionCard step={2} icon="barcode-outline" title="Identifiers">
        <InputField label="Product SKU" icon="code-slash-outline" hint={!product && !skuManuallyEdited ? "Auto-generated" : undefined}>
          <View style={s.inputRow}>
            <TextInput
              value={form.sku}
              onChangeText={(v) => {
                setSkuManuallyEdited(true);
                setField("sku", v.toUpperCase());
              }}
              placeholder="e.g. PROD-0001"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={[s.input, s.flex]}
            />
            <Pressable
              style={s.regenBtn}
              onPress={() => {
                setSkuManuallyEdited(false);
                setField("sku", generateProductSku());
              }}
            >
              <Ionicons name="refresh" size={15} color={colors.primaryDark} />
            </Pressable>
          </View>
        </InputField>

        <InputField label="Barcode" icon="scan-outline">
          <View style={s.inputRow}>
            <TextInput
              value={form.barcode}
              onChangeText={(v) => setField("barcode", v)}
              placeholder="EAN / UPC barcode"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={[s.input, s.flex]}
            />
            <Pressable style={s.regenBtn} onPress={() => setField("barcode", generateBarcodeCode())}>
              <Ionicons name="refresh" size={15} color={colors.primaryDark} />
            </Pressable>
          </View>
        </InputField>

        <InputField label="Receipt number" icon="receipt-outline">
          <TextInput
            value={form.receiptNumber}
            onChangeText={(v) => setField("receiptNumber", v)}
            placeholder="Optional"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>
      </SectionCard>

      {/* ── SECTION 3: Pricing & Stock ───────────────────────── */}
      <SectionCard step={3} icon="pricetag-outline" title="Pricing & Stock">
        <View style={s.row2}>
          <View style={s.rowItem}>
            <InputField label="Selling price" icon="cash-outline" required>
              <CurrencyInput
                value={form.price}
                onChangeText={(v) => setField("price", v)}
                currency={currency}
                placeholder="0.00"
              />
            </InputField>
          </View>
          <View style={s.rowItem}>
            <InputField label="Cost price" icon="card-outline">
              <CurrencyInput
                value={form.costPrice}
                onChangeText={(v) => setField("costPrice", v)}
                currency={currency}
                placeholder="0.00"
              />
            </InputField>
          </View>
        </View>

        {/* Margin row */}
        <View style={s.marginBlock}>
          <View style={s.marginLabelRow}>
            <Text style={s.fieldLabel}>Profit margin</Text>
            <View style={s.segmentPill}>
              <Pressable
                style={[s.segPillItem, form.marginType === "percentage" && s.segPillActive]}
                onPress={() => setField("marginType", "percentage")}
              >
                <Text style={[s.segPillText, form.marginType === "percentage" && s.segPillTextActive]}>%</Text>
              </Pressable>
              <Pressable
                style={[s.segPillItem, form.marginType === "flat" && s.segPillActive]}
                onPress={() => setField("marginType", "flat")}
              >
                <Text style={[s.segPillText, form.marginType === "flat" && s.segPillTextActive]}>Flat</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            value={form.profitMargin}
            onChangeText={(v) => setField("profitMargin", v)}
            keyboardType="decimal-pad"
            placeholder={form.marginType === "percentage" ? "e.g. 20" : "e.g. 50"}
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </View>

        <InputField label="Sale / discounted price" icon="flash-outline" required>
          <CurrencyInput
            value={form.salePrice}
            onChangeText={(v) => setField("salePrice", v)}
            currency={currency}
            placeholder="0.00"
          />
        </InputField>

        {/* Price summary card */}
        <View style={s.priceSummary}>
          <View style={s.priceSummaryRow}>
            <Ionicons name="storefront-outline" size={14} color="#166534" />
            <Text style={s.priceSummaryLabel}>Selling at</Text>
            <Text style={s.priceSummaryValue}>{formatCurrency(salePreview)}</Text>
            {hasDiscount && (
              <View style={s.discountBadge}>
                <Text style={s.discountBadgeText}>-{discountPct}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* Offer / Discount */}
        <View style={s.marginBlock}>
          <View style={s.marginLabelRow}>
            <Text style={s.fieldLabel}>Offer / Discount</Text>
            <View style={s.segmentPill}>
              <Pressable
                style={[s.segPillItem, form.offerType === "percentage" && s.segPillActive]}
                onPress={() => setField("offerType", "percentage")}
              >
                <Text style={[s.segPillText, form.offerType === "percentage" && s.segPillTextActive]}>% Off</Text>
              </Pressable>
              <Pressable
                style={[s.segPillItem, form.offerType === "flat" && s.segPillActive]}
                onPress={() => setField("offerType", "flat")}
              >
                <Text style={[s.segPillText, form.offerType === "flat" && s.segPillTextActive]}>Flat $</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            value={form.offerPrice}
            onChangeText={(v) => setField("offerPrice", v)}
            keyboardType="decimal-pad"
            placeholder={form.offerType === "percentage" ? "e.g. 10 (10% off)" : "e.g. 10 ($10 off)"}
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          {offerNum > 0 && salePreview > 0 && offerFinalPrice > 0 && (
            <View style={[s.priceSummary, { marginTop: 8, backgroundColor: "#fff7ed" }]}>
              <View style={s.priceSummaryRow}>
                <Ionicons name="flash-outline" size={14} color="#c2410c" />
                <Text style={[s.priceSummaryLabel, { color: "#c2410c" }]}>Offer price</Text>
                <Text style={[s.priceSummaryValue, { color: "#c2410c" }]}>{formatCurrency(offerFinalPrice)}</Text>
                <View style={[s.discountBadge, { backgroundColor: "#fed7aa" }]}>
                  <Text style={[s.discountBadgeText, { color: "#c2410c" }]}>
                    {form.offerType === "percentage" ? `-${offerNum}%` : `-${formatCurrency(offerNum)}`}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <InputField label="Stock quantity" icon="layers-outline">
          <TextInput
            value={form.stock}
            onChangeText={(v) => setField("stock", v)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={s.input}
            editable={variants.length === 0}
          />
          {variants.length > 0 && (
            <Text style={s.stockNote}>Stock is managed per variant below</Text>
          )}
        </InputField>
      </SectionCard>

      {/* ── SECTION 4: Storefront Flags ──────────────────────── */}
      <SectionCard step={4} icon="star-outline" title="Storefront">
        <ToggleCard
          icon="globe-outline"
          label="Published"
          description="Visible on your storefront"
          value={form.published}
          onChange={(v) => setField("published", v)}
          accentColor="#2563eb"
          accentBg="#dbeafe"
        />
        <ToggleCard
          icon="flame-outline"
          label="Hot deal"
          description="Shows hot deal badge"
          value={form.isHotDeal}
          onChange={(v) => setField("isHotDeal", v)}
          accentColor="#dc2626"
          accentBg="#fee2e2"
        />
        <ToggleCard
          icon="trending-up-outline"
          label="Best seller"
          description="Shows best seller badge"
          value={form.isBestSeller}
          onChange={(v) => setField("isBestSeller", v)}
          accentColor="#d97706"
          accentBg="#fef3c7"
        />
        <ToggleCard
          icon="ribbon-outline"
          label="Featured"
          description="Featured on homepage"
          value={form.isFeatured}
          onChange={(v) => setField("isFeatured", v)}
          accentColor={colors.primaryDark}
          accentBg="#dcfce7"
        />
        <InputField label="Deal label" icon="pricetag-outline" hint="e.g. Flash Sale, 40% Off">
          <TextInput
            value={form.dealLabel}
            onChangeText={(v) => setField("dealLabel", v)}
            placeholder="Flash Sale, Limited Offer…"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>
      </SectionCard>

      {/* ── SECTION 5: Images ───────────────────────────────── */}
      <SectionCard step={5} icon="images-outline" title="Product Images">
        {imagePreviews.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.imageRow}>
              {imagePreviews.map((image, index) => (
                <View key={image.key} style={[s.imgThumb, index === 0 && s.imgThumbPrimary]}>
                  {image.uri ? (
                    <Image source={{ uri: image.uri }} style={s.imgThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={s.imgThumbPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={colors.muted} />
                    </View>
                  )}
                  <Pressable
                    style={s.imgRemoveBtn}
                    onPress={() => removePreview(image.path, image.existing)}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                  {index === 0 && (
                    <View style={s.primaryBadge}>
                      <Text style={s.primaryBadgeText}>Cover</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={s.imgBtnRow}>
              <Pressable style={[s.addImageBtn, s.flex]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={15} color={colors.primaryDark} />
                <Text style={s.addImageBtnText}>Take photo</Text>
              </Pressable>
              <Pressable style={[s.addImageBtn, s.flex]} onPress={addImages}>
                <Ionicons name="images-outline" size={15} color={colors.primaryDark} />
                <Text style={s.addImageBtnText}>Choose from gallery</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={s.emptyImages}>
            <View style={s.emptyImagesIcon}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.primaryDark} />
            </View>
            <Text style={s.emptyImagesTitle}>Add product images</Text>
            <Text style={s.emptyImagesSub}>Take a photo or pick from gallery</Text>
            <View style={s.emptyImagesBtns}>
              <Pressable style={s.emptyImagesBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={18} color={colors.primaryDark} />
                <Text style={s.emptyImagesBtnText}>Take photo</Text>
              </Pressable>
              <Pressable style={s.emptyImagesBtn} onPress={addImages}>
                <Ionicons name="images" size={18} color={colors.primaryDark} />
                <Text style={s.emptyImagesBtnText}>Choose from gallery</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SectionCard>

      {/* ── SECTION 6: Attributes & Variants ────────────────── */}
      <SectionCard step={6} icon="options-outline" title="Attributes & Variants">
        {attributes.length > 0 && (
          <>
            <Text style={s.subLabel}>Select attributes for this product</Text>
            <View style={s.attrGrid}>
              {attributes.map((attribute) => {
                const selected = selectedAttributeIds.includes(String(attribute.id));
                return (
                  <Pressable
                    key={attribute.id}
                    style={[s.attrChip, selected && s.attrChipActive]}
                    onPress={() => toggleAttribute(attribute)}
                  >
                    {selected && <Ionicons name="checkmark" size={12} color={colors.primaryDark} />}
                    <Text style={[s.attrChipText, selected && s.attrChipTextActive]}>
                      {attribute.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {productAttributes.map((attribute) => {
          const def = attributes.find((item) => String(item.id) === attribute.id);
          const selectedValues = Array.isArray(attribute.value) ? attribute.value : [attribute.value];

          return (
            <View key={attribute.id} style={s.attrPanel}>
              <View style={s.attrPanelHeader}>
                <View style={s.attrPanelDot} />
                <Text style={s.attrPanelTitle}>{def?.displayName ?? attribute.name}</Text>
              </View>
              {def?.values?.length ? (
                <View style={s.attrValues}>
                  {def.values.map((value) => {
                    const isSelected = selectedValues.includes(value);
                    return (
                      <Pressable
                        key={value}
                        style={[s.attrValueChip, isSelected && s.attrValueChipActive]}
                        onPress={() => {
                          const next = isSelected
                            ? selectedValues.filter((item) => item !== value)
                            : [...selectedValues.filter(Boolean), value];
                          updateAttributeValues(attribute.id, next);
                        }}
                      >
                        <Text style={[s.attrValueText, isSelected && s.attrValueTextActive]}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  value={Array.isArray(attribute.value) ? attribute.value.join(", ") : attribute.value}
                  onChangeText={(v) => updateAttributeValues(attribute.id, v)}
                  placeholder={`Enter ${attribute.name} values`}
                  placeholderTextColor={colors.muted}
                  style={s.input}
                />
              )}
            </View>
          );
        })}

        {productAttributes.length > 0 && (
          <Pressable style={s.generateBtn} onPress={handleGenerateVariants}>
            <Ionicons name="git-branch-outline" size={16} color="#fff" />
            <Text style={s.generateBtnText}>Generate variants</Text>
          </Pressable>
        )}

        {variants.length > 0 && (
          <View style={s.variantsList}>
            <Text style={s.variantsHeader}>{variants.length} variant{variants.length !== 1 ? "s" : ""}</Text>
            {variants.map((variant, idx) => (
              <View key={variant.id} style={s.variantCard}>
                <View style={s.variantCardHeader}>
                  <View style={s.variantNumBadge}>
                    <Text style={s.variantNum}>{idx + 1}</Text>
                  </View>
                  <Text style={s.variantName}>{variant.name}</Text>
                  <Pressable onPress={() => removeVariant(variant.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Pressable>
                </View>
                <View style={s.row2}>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>Price</Text>
                    <CurrencyInput
                      value={String(variant.price)}
                      onChangeText={(v) => updateVariant(variant.id, "price", v)}
                      currency={currency}
                      placeholder="0.00"
                    />
                  </View>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>Sale price</Text>
                    <CurrencyInput
                      value={String(variant.salePrice)}
                      onChangeText={(v) => updateVariant(variant.id, "salePrice", v)}
                      currency={currency}
                      placeholder="0.00"
                    />
                  </View>
                  <View style={s.rowItem}>
                    <Text style={[s.fieldLabel, { color: "#c2410c" }]}>Offer price</Text>
                    <CurrencyInput
                      value={variant.offerPrice ? String(variant.offerPrice) : ""}
                      onChangeText={(v) => updateVariant(variant.id, "offerPrice", v)}
                      currency={currency}
                      placeholder="0 = none"
                    />
                  </View>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>Stock</Text>
                    <TextInput
                      value={String(variant.stock)}
                      onChangeText={(v) => updateVariant(variant.id, "stock", v)}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.muted}
                      style={s.input}
                    />
                  </View>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>SKU</Text>
                    <TextInput
                      value={variant.sku}
                      onChangeText={(v) => updateVariant(variant.id, "sku", v)}
                      autoCapitalize="characters"
                      placeholderTextColor={colors.muted}
                      style={s.input}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* ── Error ───────────────────────────────────────────── */}
      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Footer actions ──────────────────────────────────── */}
      <View style={s.footer}>
        {onCancel ? (
          <Pressable style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name={product ? "checkmark-circle" : "add-circle"} size={18} color="#fff" />
              <Text style={s.saveBtnText}>{product ? "Update product" : "Create product"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  step,
  icon,
  title,
  badge,
  action,
  children,
}: {
  step: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={s.sectionCard}>
      <View style={s.sectionHead}>
        <View style={s.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={colors.primaryDark} />
        </View>
        <View style={s.sectionTitleBlock}>
          <Text style={s.sectionTitle}>{title}</Text>
          <Text style={s.sectionStep}>Step {step} of 6</Text>
        </View>
        {badge ?? action ?? null}
      </View>
      <View style={s.sectionDivider} />
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function InputField({
  label,
  icon,
  required,
  hint,
  children,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        {icon && <Ionicons name={icon} size={13} color={colors.muted} />}
        <Text style={s.fieldLabel}>{label}</Text>
        {required && <Text style={s.requiredDot}>*</Text>}
        {hint && <Text style={s.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function CurrencyInput({
  value,
  onChangeText,
  currency,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  currency: string;
  placeholder?: string;
}) {
  const SYMBOLS: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥",
    BDT: "৳", INR: "₹", PKR: "₨", NPR: "₨", LKR: "₨",
    AUD: "A$", CAD: "C$", HKD: "HK$", SGD: "S$", NZD: "NZ$",
    AED: "د.إ", SAR: "﷼", KWD: "KD", MYR: "RM", THB: "฿",
    IDR: "Rp", PHP: "₱", VND: "₫", KRW: "₩", TRY: "₺",
    BRL: "R$", MXN: "MX$", ZAR: "R", NGN: "₦", GHS: "₵",
  };
  const symbol = SYMBOLS[currency?.toUpperCase()] ?? currency;
  return (
    <View style={s.currencyRow}>
      <View style={s.currencySymbolWrap}>
        <Text style={s.currencySymbol}>{symbol}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder ?? "0.00"}
        placeholderTextColor={colors.muted}
        style={[s.input, s.currencyInput]}
      />
    </View>
  );
}

function ToggleCard({
  icon,
  label,
  description,
  value,
  onChange,
  accentColor,
  accentBg,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accentColor: string;
  accentBg: string;
}) {
  return (
    <View style={[s.toggleCard, value && { borderColor: accentColor + "44", backgroundColor: accentBg + "55" }]}>
      <View style={[s.toggleIconWrap, { backgroundColor: value ? accentBg : colors.background }]}>
        <Ionicons name={icon} size={18} color={value ? accentColor : colors.muted} />
      </View>
      <View style={s.toggleInfo}>
        <Text style={[s.toggleLabel, value && { color: accentColor }]}>{label}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: accentColor, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },

  // Section card
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 14,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionStep: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  sectionBody: {
    padding: 16,
    gap: 14,
  },

  // Field
  field: {
    gap: 8,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  requiredDot: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  subLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  // Input
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
    minHeight: 110,
  },

  // Input row (with regen button)
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flex: { flex: 1 },
  regenBtn: {
    width: 44,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2-column row
  row2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  rowItem: {
    flex: 1,
    minWidth: 140,
  },

  // Currency input
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  currencySymbolWrap: {
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  currencySymbol: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  currencyInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    minHeight: 48,
  },

  // Margin block
  marginBlock: {
    gap: 8,
  },
  marginLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  segmentPill: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  segPillItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  segPillActive: {
    backgroundColor: colors.primaryDark,
  },
  segPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  segPillTextActive: {
    color: "#fff",
  },

  // Price summary
  priceSummary: {
    borderRadius: 14,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceSummaryLabel: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  priceSummaryValue: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "800",
  },
  discountBadge: {
    borderRadius: 999,
    backgroundColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // Stock note
  stockNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },

  // Toggle card
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  toggleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  toggleDesc: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },

  // Add image buttons
  imgBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  addImageBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },

  // Image thumbnails
  imageRow: {
    gap: 10,
    paddingVertical: 2,
  },
  imgThumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  imgThumbPrimary: {
    borderColor: colors.primaryDark,
    borderWidth: 2,
  },
  imgThumbImg: {
    width: "100%",
    height: "100%",
  },
  imgThumbPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  imgRemoveBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  primaryBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Empty images state
  emptyImages: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  emptyImagesIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyImagesTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyImagesSub: {
    color: colors.muted,
    fontSize: 12,
  },
  emptyImagesBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  emptyImagesBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  emptyImagesBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },

  // Attribute chips
  attrGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  attrChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  attrChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  attrChipTextActive: {
    color: colors.primaryDark,
  },
  attrPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#f0fdf4",
    padding: 14,
    gap: 10,
  },
  attrPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attrPanelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  attrPanelTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  attrValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attrValueChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  attrValueChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  attrValueText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  attrValueTextActive: {
    color: "#fff",
  },

  // Generate button
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    paddingVertical: 14,
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  // Variants
  variantsList: {
    gap: 10,
  },
  variantsHeader: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  variantCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    backgroundColor: colors.background,
  },
  variantCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  variantNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  variantNum: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  variantName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  // Footer
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
