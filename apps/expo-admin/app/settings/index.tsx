import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";
import {
  changePassword,
  getAllSettings,
  updateGeneralSettings,
  updateNotificationSettings,
  updatePaymentSettings,
  updateRegionalSettings,
  updateShippingSettings,
  updateTaxSettings,
  type GeneralSettings,
  type NotificationSettings,
  type PaymentSettings,
  type RegionalSettings,
  type ShippingSettings,
  type TaxSettings,
} from "@/services/settings";

type Section = "store" | "regional" | "tax" | "payment" | "shipping" | "notifications" | "security";

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: "store", label: "Store", icon: "storefront-outline" },
  { key: "regional", label: "Regional", icon: "globe-outline" },
  { key: "tax", label: "Tax", icon: "receipt-outline" },
  { key: "payment", label: "Payment", icon: "card-outline" },
  { key: "shipping", label: "Shipping", icon: "cube-outline" },
  { key: "notifications", label: "Notifications", icon: "notifications-outline" },
  { key: "security", label: "Security", icon: "lock-closed-outline" },
];

export default function SettingsScreen() {
  const { session, signOut, canRead } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("store");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);

  // All settings state
  const [general, setGeneral] = useState<GeneralSettings>({
    storeName: "", storeEmail: "", storePhone: "", storeAddress: "", storeDescription: "",
  });
  const [tax, setTax] = useState<TaxSettings>({
    defaultTaxRate: 0, taxInclusivePrice: false,
    enableGSTTracking: false, enableTaxExemption: false, defaultShippingTax: 0,
  });
  const [payment, setPayment] = useState<PaymentSettings>({
    enableCash: true, enableCard: true, enableOnline: false, cardProcessingFee: 0,
  });
  const [regional, setRegional] = useState<RegionalSettings>({
    language: "en", currency: "USD", timezone: "UTC",
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true, orderNotifications: true, marketingEmails: false,
  });
  const [shipping, setShipping] = useState<ShippingSettings>({
    enableShipping: false, defaultShippingCost: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllSettings();
      if (all.general && Object.keys(all.general).length) setGeneral(all.general);
      if (all.tax && Object.keys(all.tax).length) setTax(all.tax);
      if (all.payment && Object.keys(all.payment).length) setPayment(all.payment);
      if (all.regional && Object.keys(all.regional).length) setRegional(all.regional);
      if (all.notifications && Object.keys(all.notifications).length) setNotifications(all.notifications);
      if (all.shipping && Object.keys(all.shipping).length) setShipping(all.shipping);
    } catch {
      // sections may 404 individually — silently ignore
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!canRead('Settings')) return <AccessDenied />;

  const save = async () => {
    setSaving(true);
    try {
      switch (activeSection) {
        case "store": await updateGeneralSettings(general); break;
        case "tax": await updateTaxSettings(tax); break;
        case "payment": await updatePaymentSettings(payment); break;
        case "regional": await updateRegionalSettings(regional); break;
        case "notifications": await updateNotificationSettings(notifications); break;
        case "shipping": await updateShippingSettings(shipping); break;
      }
      Alert.alert("Saved", "Settings updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Save failed.");
    } finally { setSaving(false); }
  };

  const hasSaveBtn = activeSection !== "security";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        {hasSaveBtn ? (
          <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </Pressable>
        ) : <View style={{ width: 56 }} />}
      </View>

      {/* Company badge */}
      {session && (
        <View style={styles.companyBadge}>
          <View style={styles.companyIcon}>
            <Ionicons name="business-outline" size={18} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName} numberOfLines={1}>{session.companyName}</Text>
            <Text style={styles.companyMeta}>{session.userEmail} · {session.userRole}</Text>
          </View>
        </View>
      )}

      {/* Section tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.tab, activeSection === s.key && styles.tabActive]}
              onPress={() => setActiveSection(s.key)}
            >
              <Ionicons
                name={s.icon as any}
                size={14}
                color={activeSection === s.key ? colors.primaryDark : colors.muted}
              />
              <Text style={[styles.tabText, activeSection === s.key && styles.tabTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeSection === "store" && (
            <StoreSection general={general} onChange={setGeneral} />
          )}
          {activeSection === "regional" && (
            <RegionalSection regional={regional} onChange={setRegional} />
          )}
          {activeSection === "tax" && (
            <TaxSection tax={tax} onChange={setTax} />
          )}
          {activeSection === "payment" && (
            <PaymentSection payment={payment} onChange={setPayment} />
          )}
          {activeSection === "shipping" && (
            <ShippingSection shipping={shipping} onChange={setShipping} />
          )}
          {activeSection === "notifications" && (
            <NotificationsSection notifications={notifications} onChange={setNotifications} />
          )}
          {activeSection === "security" && (
            <SecuritySection
              onChangePassword={() => setPwModalOpen(true)}
              onSignOut={() => {
                Alert.alert("Sign Out", "Sign out of your account?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign Out", style: "destructive", onPress: signOut },
                ]);
              }}
            />
          )}
        </ScrollView>
      )}

      <ChangePasswordModal
        visible={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Section: Store ───────────────────────────────────────────────────────────

function StoreSection({ general, onChange }: {
  general: GeneralSettings; onChange: (v: GeneralSettings) => void;
}) {
  const set = (k: keyof GeneralSettings) => (v: string) => onChange({ ...general, [k]: v });
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="storefront-outline" title="Store Information" />
      <Field label="Store Name" value={general.storeName} onChange={set("storeName")} />
      <Field label="Store Email" value={general.storeEmail} onChange={set("storeEmail")} keyboardType="email-address" />
      <Field label="Phone" value={general.storePhone} onChange={set("storePhone")} keyboardType="phone-pad" />
      <Field label="Address" value={general.storeAddress} onChange={set("storeAddress")} />
      <Field label="Description" value={general.storeDescription} onChange={set("storeDescription")} multiline />
    </View>
  );
}

// ─── Section: Regional ────────────────────────────────────────────────────────

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "BDT", "INR", "SGD"];
const LANGUAGES = ["en", "fr", "de", "es", "ar", "bn", "zh"];
const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dhaka", "Asia/Kolkata", "Asia/Tokyo", "Asia/Singapore"];
const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

function RegionalSection({ regional, onChange }: {
  regional: RegionalSettings; onChange: (v: RegionalSettings) => void;
}) {
  const set = (k: keyof RegionalSettings) => (v: string) => onChange({ ...regional, [k]: v });
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="globe-outline" title="Regional Settings" />
      <SelectField label="Currency" value={regional.currency} options={CURRENCIES} onChange={set("currency")} />
      <SelectField label="Language" value={regional.language} options={LANGUAGES} onChange={set("language")} />
      <SelectField label="Timezone" value={regional.timezone} options={TIMEZONES} onChange={set("timezone")} />
      <SelectField label="Date Format" value={regional.dateFormat ?? "MM/DD/YYYY"} options={DATE_FORMATS} onChange={set("dateFormat")} />
      <SelectField
        label="Time Format"
        value={regional.timeFormat ?? "12h"}
        options={["12h", "24h"]}
        onChange={set("timeFormat")}
      />
      <SelectField
        label="Weight Unit"
        value={regional.weightUnit ?? "kg"}
        options={["kg", "lb", "g", "oz"]}
        onChange={set("weightUnit")}
      />
    </View>
  );
}

// ─── Section: Tax ─────────────────────────────────────────────────────────────

function TaxSection({ tax, onChange }: {
  tax: TaxSettings; onChange: (v: TaxSettings) => void;
}) {
  const setNum = (k: keyof TaxSettings) => (v: string) => onChange({ ...tax, [k]: Number(v) || 0 });
  const setBool = (k: keyof TaxSettings) => (v: boolean) => onChange({ ...tax, [k]: v });
  const setStr = (k: keyof TaxSettings) => (v: string) => onChange({ ...tax, [k]: v });
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="receipt-outline" title="Tax Settings" />
      <Field label="Default Tax Rate (%)" value={String(tax.defaultTaxRate)} onChange={setNum("defaultTaxRate")} keyboardType="decimal-pad" />
      <Field label="Default Shipping Tax (%)" value={String(tax.defaultShippingTax)} onChange={setNum("defaultShippingTax")} keyboardType="decimal-pad" />
      <ToggleRow label="Tax Inclusive Prices" value={tax.taxInclusivePrice} onChange={setBool("taxInclusivePrice")} desc="Show prices with tax included" />
      <ToggleRow label="GST Tracking" value={tax.enableGSTTracking} onChange={setBool("enableGSTTracking")} desc="Enable GST reporting" />
      {tax.enableGSTTracking && (
        <Field label="GST Number" value={tax.gstNumber ?? ""} onChange={setStr("gstNumber")} />
      )}
      <ToggleRow label="Tax Exemptions" value={tax.enableTaxExemption} onChange={setBool("enableTaxExemption")} desc="Allow tax-exempt customers" />
    </View>
  );
}

// ─── Section: Payment ─────────────────────────────────────────────────────────

function PaymentSection({ payment, onChange }: {
  payment: PaymentSettings; onChange: (v: PaymentSettings) => void;
}) {
  const setBool = (k: keyof PaymentSettings) => (v: boolean) => onChange({ ...payment, [k]: v });
  const setStr = (k: keyof PaymentSettings) => (v: string) => onChange({ ...payment, [k]: v });
  const setNum = (k: keyof PaymentSettings) => (v: string) => onChange({ ...payment, [k]: Number(v) || 0 });
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="card-outline" title="Payment Methods" />
      <ToggleRow label="Cash Payments" value={payment.enableCash} onChange={setBool("enableCash")} desc="Accept cash at POS" />
      <ToggleRow label="Card Payments" value={payment.enableCard} onChange={setBool("enableCard")} desc="Accept credit/debit cards" />
      <ToggleRow label="Online Payments" value={payment.enableOnline} onChange={setBool("enableOnline")} desc="Accept online gateway payments" />
      <Field label="Card Processing Fee (%)" value={String(payment.cardProcessingFee)} onChange={setNum("cardProcessingFee")} keyboardType="decimal-pad" />
      {payment.enableOnline && (
        <Field label="Stripe Publishable Key" value={payment.stripeKey ?? ""} onChange={setStr("stripeKey")} placeholder="pk_live_..." />
      )}
    </View>
  );
}

// ─── Section: Shipping ────────────────────────────────────────────────────────

function ShippingSection({ shipping, onChange }: {
  shipping: ShippingSettings; onChange: (v: ShippingSettings) => void;
}) {
  const setBool = (k: keyof ShippingSettings) => (v: boolean) => onChange({ ...shipping, [k]: v });
  const setNum = (k: keyof ShippingSettings) => (v: string) => onChange({ ...shipping, [k]: Number(v) || 0 });
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="cube-outline" title="Shipping Settings" />
      <ToggleRow label="Enable Shipping" value={shipping.enableShipping} onChange={setBool("enableShipping")} desc="Offer shipping for orders" />
      {shipping.enableShipping && (
        <>
          <Field label="Default Shipping Cost" value={String(shipping.defaultShippingCost)} onChange={setNum("defaultShippingCost")} keyboardType="decimal-pad" />
          <Field
            label="Free Shipping Threshold"
            value={String(shipping.freeShippingThreshold ?? "")}
            onChange={setNum("freeShippingThreshold")}
            keyboardType="decimal-pad"
            placeholder="e.g. 100 (leave empty to disable)"
          />
        </>
      )}
    </View>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────

function NotificationsSection({ notifications, onChange }: {
  notifications: NotificationSettings; onChange: (v: NotificationSettings) => void;
}) {
  const setBool = (k: keyof NotificationSettings) => (v: boolean) => onChange({ ...notifications, [k]: v });
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="notifications-outline" title="Notification Preferences" />
      <ToggleRow label="Email Notifications" value={notifications.emailNotifications} onChange={setBool("emailNotifications")} desc="Receive email alerts for events" />
      <ToggleRow label="Order Notifications" value={notifications.orderNotifications} onChange={setBool("orderNotifications")} desc="Get notified on new orders" />
      <ToggleRow label="Marketing Emails" value={notifications.marketingEmails} onChange={setBool("marketingEmails")} desc="Promotional and feature updates" />
    </View>
  );
}

// ─── Section: Security ────────────────────────────────────────────────────────

function SecuritySection({ onChangePassword, onSignOut }: {
  onChangePassword: () => void; onSignOut: () => void;
}) {
  return (
    <View style={sStyles.section}>
      <SectionHeader icon="lock-closed-outline" title="Security" />
      <MenuRow
        icon="key-outline"
        label="Change Password"
        desc="Update your account password"
        onPress={onChangePassword}
        chevron
      />
      <View style={sStyles.divider} />
      <SectionHeader icon="person-outline" title="Account" />
      <MenuRow
        icon="log-out-outline"
        label="Sign Out"
        desc="Sign out of all devices"
        onPress={onSignOut}
        danger
      />
    </View>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setCurrent(""); setNewPw(""); setConfirm(""); };

  const handleSave = async () => {
    if (!current || !newPw || !confirm) { Alert.alert("Error", "All fields required."); return; }
    if (newPw !== confirm) { Alert.alert("Error", "New passwords don't match."); return; }
    if (newPw.length < 8) { Alert.alert("Error", "Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      await changePassword({ currentPassword: current, newPassword: newPw, confirmPassword: confirm });
      Alert.alert("Success", "Password changed successfully.");
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Password change failed.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <View style={mStyles.sheet}>
        <View style={mStyles.sheetHeader}>
          <Text style={mStyles.sheetTitle}>Change Password</Text>
          <Pressable onPress={() => { reset(); onClose(); }} style={mStyles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={mStyles.fields} keyboardShouldPersistTaps="handled">
          <PwField label="Current Password" value={current} onChange={setCurrent} />
          <PwField label="New Password" value={newPw} onChange={setNewPw} />
          <PwField label="Confirm New Password" value={confirm} onChange={setConfirm} />
          <Pressable style={[mStyles.saveBtn, saving && { opacity: 0.55 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Update Password</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={sStyles.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={colors.primaryDark} />
      <Text style={sStyles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, value, onChange, keyboardType, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={sStyles.field}>
      <Text style={sStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={[sStyles.input, multiline && sStyles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <View style={sStyles.field}>
      <Text style={sStyles.fieldLabel}>{label}</Text>
      <View style={sStyles.pwWrap}>
        <TextInput
          style={sStyles.pwInput}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={label}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
        />
        <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onChange, desc }: {
  label: string; value: boolean; onChange: (v: boolean) => void; desc?: string;
}) {
  return (
    <View style={sStyles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={sStyles.toggleLabel}>{label}</Text>
        {desc && <Text style={sStyles.toggleDesc}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primaryDark }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={sStyles.field}>
      <Text style={sStyles.fieldLabel}>{label}</Text>
      <Pressable style={sStyles.selectBtn} onPress={() => setOpen(!open)}>
        <Text style={sStyles.selectValue}>{value}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={sStyles.dropdown}>
          {options.map((o) => (
            <Pressable
              key={o}
              style={[sStyles.dropdownItem, o === value && sStyles.dropdownItemActive]}
              onPress={() => { onChange(o); setOpen(false); }}
            >
              <Text style={[sStyles.dropdownItemText, o === value && sStyles.dropdownItemTextActive]}>{o}</Text>
              {o === value && <Ionicons name="checkmark" size={14} color={colors.primaryDark} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function MenuRow({ icon, label, desc, onPress, chevron, danger }: {
  icon: string; label: string; desc?: string;
  onPress: () => void; chevron?: boolean; danger?: boolean;
}) {
  return (
    <Pressable style={sStyles.menuRow} onPress={onPress}>
      <View style={[sStyles.menuIcon, danger && sStyles.menuIconDanger]}>
        <Ionicons name={icon as any} size={16} color={danger ? "#dc2626" : colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sStyles.menuLabel, danger && sStyles.menuLabelDanger]}>{label}</Text>
        {desc && <Text style={sStyles.menuDesc}>{desc}</Text>}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sStyles = StyleSheet.create({
  section: { gap: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  field: { gap: 4, marginBottom: 10 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, color: colors.text, fontSize: 14, backgroundColor: "#f8fafc",
  },
  inputMulti: { height: 80, paddingTop: 12 },
  pwWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, backgroundColor: "#f8fafc",
  },
  pwInput: { flex: 1, color: colors.text, fontSize: 14 },
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  toggleDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, backgroundColor: "#f8fafc",
  },
  selectValue: { color: colors.text, fontSize: 14 },
  dropdown: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.surface, overflow: "hidden", marginTop: 4,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: "#ecfdf5" },
  dropdownItemText: { color: colors.text, fontSize: 14 },
  dropdownItemTextActive: { color: colors.primaryDark, fontWeight: "700" },
  menuRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
  },
  menuIconDanger: { backgroundColor: "#fff5f5" },
  menuLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  menuLabelDanger: { color: "#dc2626" },
  menuDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
});

const mStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  fields: { padding: 20, gap: 14, paddingBottom: 32 },
  saveBtn: { borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  saveBtn: {
    borderRadius: 10, backgroundColor: colors.primaryDark,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  companyBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: "#eff6ff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  companyIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  companyName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  companyMeta: { color: "#1d4ed8", fontSize: 12, marginTop: 1 },
  tabsWrap: { height: 48 },
  tabs: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 48 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7,
  },
  tabActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
});
