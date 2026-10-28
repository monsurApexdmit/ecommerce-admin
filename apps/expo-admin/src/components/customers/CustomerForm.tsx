import { Pressable, StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { colors } from "@/constants/theme";
import type { Customer, CustomerGroup, CustomerInput, CustomerKind } from "@/services/customers";

export interface CustomerFormValues {
  type: CustomerKind;
  businessName: string;
  licenceBin: string;
  name: string;
  phone: string;
  email: string;
  customerGroup: CustomerGroup;
  creditLimit: string;
  openingBalance: string;
  birthday: string;
  tags: string;
  smsOptIn: boolean;
  status: "active" | "inactive";
  address: string;
  area: string;
  district: string;
  city: string;
  country: string;
  notes: string;
}

export const emptyCustomerForm: CustomerFormValues = {
  type: "individual",
  businessName: "",
  licenceBin: "",
  name: "",
  phone: "",
  email: "",
  customerGroup: "retail",
  creditLimit: "",
  openingBalance: "",
  birthday: "",
  tags: "",
  smsOptIn: true,
  status: "active",
  address: "",
  area: "",
  district: "",
  city: "",
  country: "Bangladesh",
  notes: "",
};

export function customerToForm(c: Customer): CustomerFormValues {
  return {
    type: c.type,
    businessName: c.businessName ?? "",
    licenceBin: c.licenceBin ?? "",
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    customerGroup: c.customerGroup,
    creditLimit: c.creditLimit ? String(c.creditLimit) : "",
    openingBalance: c.openingBalance ? String(c.openingBalance) : "",
    birthday: c.birthday ?? "",
    tags: c.tags.join(", "),
    smsOptIn: c.smsOptIn,
    status: c.status,
    address: c.address ?? "",
    area: c.area ?? "",
    district: c.district ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    notes: c.notes ?? "",
  };
}

const amount = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(/,/g, "")));

export function formToInput(v: CustomerFormValues, mode: "create" | "update"): CustomerInput {
  const input: CustomerInput = {
    name: v.name,
    phone: v.phone,
    email: v.email,
    type: v.type,
    businessName: v.type === "business" ? v.businessName : undefined,
    licenceBin: v.licenceBin,
    customerGroup: v.customerGroup,
    creditLimit: amount(v.creditLimit),
    birthday: v.birthday.trim() || null,
    tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
    smsOptIn: v.smsOptIn,
    status: v.status,
    address: v.address,
    area: v.area,
    district: v.district,
    city: v.city,
    country: v.country,
    notes: v.notes,
  };
  if (mode === "create") input.openingBalance = amount(v.openingBalance);
  return input;
}

type Props = {
  values: CustomerFormValues;
  onChange: (patch: Partial<CustomerFormValues>) => void;
  errors: Record<string, string>;
  mode: "create" | "update";
};

const GROUPS: { value: CustomerGroup; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "vip", label: "VIP" },
];

/** Customer fields (PHASE3): type, business, group, credit, birthday, tags, SMS opt-in, status, address. */
export function CustomerFormFields({ values: v, onChange, errors, mode }: Props) {
  return (
    <View style={s.wrap}>
      <ChipGroup
        label="Customer type"
        options={[{ value: "individual", label: "Individual" }, { value: "business", label: "Business" }]}
        value={v.type}
        onChange={(type) => onChange({ type: type as CustomerKind })}
      />
      {v.type === "business" ? (
        <>
          <Field label="Business name *" value={v.businessName} onChange={(businessName) => onChange({ businessName })} placeholder="Company / shop name" error={errors.businessName} autoCapitalize="words" />
          <Field label="Trade licence / BIN" value={v.licenceBin} onChange={(licenceBin) => onChange({ licenceBin })} placeholder="Optional" error={errors.licenceBin} />
        </>
      ) : null}
      <Field label={v.type === "business" ? "Contact name *" : "Name *"} value={v.name} onChange={(name) => onChange({ name })} placeholder="Full name" error={errors.name} autoCapitalize="words" />
      <Field label="Phone *" value={v.phone} onChange={(phone) => onChange({ phone })} placeholder="01XXXXXXXXX" keyboardType="phone-pad" error={errors.phone} />
      <Field label="Email" value={v.email} onChange={(email) => onChange({ email })} placeholder="email@example.com" keyboardType="email-address" error={errors.email} />

      <ChipGroup
        label="Group"
        options={GROUPS}
        value={v.customerGroup}
        onChange={(g) => onChange({ customerGroup: g as CustomerGroup })}
        hint={v.customerGroup === "vip" ? "VIP customers get the VIP discount on sales automatically." : undefined}
      />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field label="Credit limit" value={v.creditLimit} onChange={(creditLimit) => onChange({ creditLimit })} placeholder="0 = no limit" keyboardType="decimal-pad" error={errors.creditLimit} />
        </View>
        {mode === "create" ? (
          <View style={{ flex: 1 }}>
            <Field label="Opening balance" value={v.openingBalance} onChange={(openingBalance) => onChange({ openingBalance })} placeholder="0" keyboardType="decimal-pad" error={errors.openingBalance} />
          </View>
        ) : null}
      </View>

      <Field label="Birthday" value={v.birthday} onChange={(birthday) => onChange({ birthday })} placeholder="YYYY-MM-DD" error={errors.birthday} />
      <Field label="Tags" value={v.tags} onChange={(tags) => onChange({ tags })} placeholder="Comma separated, e.g. regular, corporate" error={errors.tags} />

      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>SMS opt-in</Text>
          <Text style={s.hint}>Receives offers and order SMS</Text>
        </View>
        <Switch value={v.smsOptIn} onValueChange={(smsOptIn) => onChange({ smsOptIn })} trackColor={{ true: colors.primary }} />
      </View>

      <ChipGroup
        label="Status"
        options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
        value={v.status}
        onChange={(status) => onChange({ status: status as "active" | "inactive" })}
      />

      <Field label="Address" value={v.address} onChange={(address) => onChange({ address })} placeholder="House, road" error={errors.address} autoCapitalize="sentences" />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field label="Area" value={v.area} onChange={(area) => onChange({ area })} placeholder="Area / thana" error={errors.area} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="District" value={v.district} onChange={(district) => onChange({ district })} placeholder="District" error={errors.district} autoCapitalize="words" />
        </View>
      </View>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field label="City" value={v.city} onChange={(city) => onChange({ city })} placeholder="City" error={errors.city} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Country" value={v.country} onChange={(country) => onChange({ country })} placeholder="Country" error={errors.country} autoCapitalize="words" />
        </View>
      </View>
      <Field label="Notes" value={v.notes} onChange={(notes) => onChange({ notes })} placeholder="Anything to remember" multiline error={errors.notes} autoCapitalize="sentences" />
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, error, multiline, autoCapitalize = "none" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti, error ? s.inputError : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function ChipGroup({ label, options, value, onChange, hint }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={o.value} style={[s.chip, active && s.chipActive]} onPress={() => onChange(o.value)}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 14 },
  row: { flexDirection: "row", gap: 10 },
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12 },
  input: {
    minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 14, color: colors.text, fontSize: 14,
  },
  inputMulti: { minHeight: 80, paddingVertical: 10, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.primaryDark },
  switchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
});
