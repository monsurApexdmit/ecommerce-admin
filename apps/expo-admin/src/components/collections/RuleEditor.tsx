import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { PickerField } from "@/components/products/PickerField";
import type { Brand, Category } from "@/types/catalog";
import type { CollectionMatch, CollectionRule, CollectionRuleField, CollectionRuleOperator } from "@/types/collection";

type FieldDef = {
  label: string;
  operators: { value: CollectionRuleOperator; label: string }[];
  /** Fresh rule when this field is picked. */
  make: () => CollectionRule;
};

export const RULE_FIELDS: Record<CollectionRuleField, FieldDef> = {
  category: {
    label: "Category",
    operators: [{ value: "is", label: "is" }, { value: "is_not", label: "is not" }],
    make: () => ({ field: "category", operator: "is", value: null }),
  },
  brand: {
    label: "Brand",
    operators: [{ value: "is", label: "is" }, { value: "is_not", label: "is not" }],
    make: () => ({ field: "brand", operator: "is", value: null }),
  },
  tag: {
    label: "Tag",
    operators: [
      { value: "equals", label: "equals" },
      { value: "not_equals", label: "not equals" },
      { value: "contains", label: "contains" },
    ],
    make: () => ({ field: "tag", operator: "equals", value: "" }),
  },
  flag: {
    label: "Product flag",
    operators: [{ value: "is", label: "is on" }, { value: "is_not", label: "is off" }],
    make: () => ({ field: "flag", operator: "is", value: "best_seller" }),
  },
  price: {
    label: "Price",
    operators: [{ value: "greater_than", label: "greater than" }, { value: "less_than", label: "less than" }],
    make: () => ({ field: "price", operator: "greater_than", value: "" }),
  },
  on_offer: {
    label: "On offer",
    operators: [],
    make: () => ({ field: "on_offer", operator: "is", value: true }),
  },
  new_arrivals: {
    label: "New arrivals",
    operators: [],
    make: () => ({ field: "new_arrivals", operator: "within_days", value: 30 }),
  },
  best_sellers: {
    label: "Best sellers",
    operators: [],
    make: () => ({ field: "best_sellers", operator: "top", value: 10, days: 30 }),
  },
  in_stock: {
    label: "In stock only",
    operators: [],
    make: () => ({ field: "in_stock", operator: "is", value: true }),
  },
};

const FLAG_OPTIONS = [
  { value: "best_seller", label: "Best seller" },
  { value: "hot_deal", label: "Hot deal" },
  { value: "featured", label: "Featured" },
];

const FIELD_OPTIONS = (Object.keys(RULE_FIELDS) as CollectionRuleField[]).map((key) => ({
  value: key,
  label: RULE_FIELDS[key].label,
}));

/** Human-readable reason a rule is incomplete, or null when it is valid. */
export function ruleProblem(rule: CollectionRule): string | null {
  const label = RULE_FIELDS[rule.field]?.label ?? rule.field;
  switch (rule.field) {
    case "category":
    case "brand":
      return rule.value ? null : `Pick a ${label.toLowerCase()} for the ${label} rule.`;
    case "tag": {
      const tag = String(rule.value ?? "").trim();
      if (!tag) return "Enter a tag for the Tag rule.";
      return tag.length > 100 ? "Tags can be at most 100 characters." : null;
    }
    case "price": {
      const n = Number(rule.value);
      return rule.value !== "" && rule.value !== null && Number.isFinite(n) && n >= 0 ? null : "Enter a valid amount for the Price rule.";
    }
    case "new_arrivals": {
      const n = Number(rule.value);
      return Number.isInteger(n) && n >= 1 && n <= 3650 ? null : "New arrivals needs a number of days (1–3650).";
    }
    case "best_sellers": {
      const n = Number(rule.value);
      const d = Number(rule.days);
      if (!Number.isInteger(n) || n < 1 || n > 500) return "Best sellers needs a top N between 1 and 500.";
      if (!Number.isInteger(d) || d < 1 || d > 3650) return "Best sellers needs a number of days (1–3650).";
      return null;
    }
    default:
      return null;
  }
}

type Props = {
  match: CollectionMatch;
  rules: CollectionRule[];
  categories: Category[];
  brands: Brand[];
  onMatchChange: (match: CollectionMatch) => void;
  onRulesChange: (rules: CollectionRule[]) => void;
};

export function RuleEditor({ match, rules, categories, brands, onMatchChange, onRulesChange }: Props) {
  const categoryOptions = buildCategoryOptions(categories);
  const brandOptions = brands.map((b) => ({ value: String(b.id), label: b.brandName }));

  const update = (index: number, patch: Partial<CollectionRule>) => {
    onRulesChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };
  const replace = (index: number, rule: CollectionRule) => {
    onRulesChange(rules.map((r, i) => (i === index ? rule : r)));
  };
  const remove = (index: number) => onRulesChange(rules.filter((_, i) => i !== index));
  const add = () => onRulesChange([...rules, RULE_FIELDS.category.make()]);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>Products must match</Text>
      <View style={s.segment}>
        {(["all", "any"] as CollectionMatch[]).map((m) => (
          <Pressable key={m} style={[s.segBtn, match === m && s.segBtnActive]} onPress={() => onMatchChange(m)}>
            <Text style={[s.segText, match === m && s.segTextActive]}>
              {m === "all" ? "All conditions" : "Any condition"}
            </Text>
          </Pressable>
        ))}
      </View>

      {rules.length === 0 ? (
        <Text style={s.hint}>No conditions yet — add one to start matching products.</Text>
      ) : null}

      {rules.map((rule, index) => {
        const def = RULE_FIELDS[rule.field] ?? RULE_FIELDS.category;
        return (
          <View key={index} style={s.ruleCard}>
            <View style={s.ruleHead}>
              <Text style={s.ruleIndex}>
                {index === 0 ? "Where" : match === "all" ? "And" : "Or"}
              </Text>
              <Pressable onPress={() => remove(index)} hitSlop={8} style={s.removeBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>

            <PickerField
              label="Field"
              placeholder="Choose a field"
              value={rule.field}
              options={FIELD_OPTIONS}
              onChange={(v) => replace(index, RULE_FIELDS[v as CollectionRuleField].make())}
            />

            {def.operators.length > 0 ? (
              <View style={s.opRow}>
                {def.operators.map((op) => (
                  <Pressable
                    key={op.value}
                    style={[s.opChip, rule.operator === op.value && s.opChipActive]}
                    onPress={() => update(index, { operator: op.value })}
                  >
                    <Text style={[s.opText, rule.operator === op.value && s.opTextActive]}>{op.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {rule.field === "category" ? (
              <>
                <PickerField
                  label="Category"
                  placeholder="Select category"
                  value={rule.value ? String(rule.value) : undefined}
                  options={categoryOptions}
                  onChange={(v) => update(index, { value: Number(v) })}
                />
                <Text style={s.hint}>Includes products in its subcategories.</Text>
              </>
            ) : null}

            {rule.field === "brand" ? (
              brandOptions.length > 0 ? (
                <PickerField
                  label="Brand"
                  placeholder="Select brand"
                  value={rule.value ? String(rule.value) : undefined}
                  options={brandOptions}
                  onChange={(v) => update(index, { value: Number(v) })}
                />
              ) : (
                <Text style={s.hint}>No brands available (or no permission to view brands).</Text>
              )
            ) : null}

            {rule.field === "tag" ? (
              <Input
                label="Tag"
                value={String(rule.value ?? "")}
                placeholder="e.g. summer"
                onChange={(v) => update(index, { value: v })}
              />
            ) : null}

            {rule.field === "flag" ? (
              <PickerField
                label="Flag"
                placeholder="Select flag"
                value={String(rule.value ?? "best_seller")}
                options={FLAG_OPTIONS}
                onChange={(v) => update(index, { value: v })}
              />
            ) : null}

            {rule.field === "price" ? (
              <Input
                label="Selling price (after offers)"
                value={String(rule.value ?? "")}
                placeholder="0.00"
                keyboardType="decimal-pad"
                onChange={(v) => update(index, { value: v.replace(/[^0-9.]/g, "") })}
              />
            ) : null}

            {rule.field === "new_arrivals" ? (
              <Input
                label="Added in the last (days)"
                value={String(rule.value ?? "")}
                placeholder="30"
                keyboardType="number-pad"
                onChange={(v) => update(index, { value: v.replace(/[^0-9]/g, "") })}
              />
            ) : null}

            {rule.field === "best_sellers" ? (
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Top N products"
                    value={String(rule.value ?? "")}
                    placeholder="10"
                    keyboardType="number-pad"
                    onChange={(v) => update(index, { value: v.replace(/[^0-9]/g, "") })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Over last (days)"
                    value={rule.days === undefined || rule.days === null ? "" : String(rule.days)}
                    placeholder="30"
                    keyboardType="number-pad"
                    onChange={(v) => {
                      const digits = v.replace(/[^0-9]/g, "");
                      update(index, { days: digits === "" ? null : Number(digits) });
                    }}
                  />
                </View>
              </View>
            ) : null}

            {rule.field === "on_offer" ? <Text style={s.hint}>Products with an active offer right now.</Text> : null}
            {rule.field === "in_stock" ? (
              <Text style={s.hint}>Only products with stock available. Always applied, even with "Any condition".</Text>
            ) : null}
          </View>
        );
      })}

      <Pressable style={s.addBtn} onPress={add}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primaryDark} />
        <Text style={s.addText}>Add condition</Text>
      </Pressable>
    </View>
  );
}

/** Flat category list with children indented under their parents. */
function buildCategoryOptions(categories: Category[]) {
  const byParent = new Map<number | null, Category[]>();
  categories.forEach((c) => {
    const key = c.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  });
  const ids = new Set(categories.map((c) => c.id));
  const out: { value: string; label: string }[] = [];
  const walk = (parent: number | null, depth: number) => {
    (byParent.get(parent) ?? []).forEach((c) => {
      out.push({ value: String(c.id), label: `${"— ".repeat(depth)}${c.categoryName}` });
      if (depth < 6) walk(c.id, depth + 1);
    });
  };
  walk(null, 0);
  // Orphans whose parent is not in the list.
  categories
    .filter((c) => c.parentId !== null && !ids.has(c.parentId))
    .forEach((c) => {
      out.push({ value: String(c.id), label: c.categoryName });
      walk(c.id, 1);
    });
  return out;
}

function Input({ label, value, onChange, placeholder, keyboardType }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12 },
  segment: {
    flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 12, padding: 4, gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segBtnActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  segTextActive: { color: colors.primaryDark },
  ruleCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10,
    backgroundColor: colors.background,
  },
  ruleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ruleIndex: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  removeBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: "#fee2e2",
    alignItems: "center", justifyContent: "center",
  },
  opRow: { flexDirection: "row", gap: 8 },
  opChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  opChipActive: { backgroundColor: "#ecfdf5", borderColor: colors.primary },
  opText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  opTextActive: { color: colors.primaryDark },
  twoCol: { flexDirection: "row", gap: 10 },
  input: {
    minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 15,
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, borderRadius: 12,
    paddingVertical: 12,
  },
  addText: { color: colors.primaryDark, fontSize: 14, fontWeight: "700" },
});
