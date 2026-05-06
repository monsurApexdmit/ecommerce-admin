import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import {
  createShipment,
  getOrderByInvoice,
  getShipmentById,
  getShipmentStats,
  getShipments,
  updateShipmentStatus,
} from "@/services/order-service";
import type { CreateShipmentDraft, Order, Shipment, ShipmentStatus } from "@/types/order";
import { ShipmentStatusPill } from "@/components/orders/OrderStatusPill";

const shipmentFlow: ShipmentStatus[] = [
  "pending",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
];

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  pending:          { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  picked_up:        { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  in_transit:       { bg: "#ede9fe", text: "#6d28d9", dot: "#8b5cf6" },
  out_for_delivery: { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  delivered:        { bg: "#dcfce7", text: "#166534", dot: "#10b981" },
  failed:           { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  returned:         { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
};

function statusDot(status: string) {
  return STATUS_COLOR[status]?.dot ?? colors.muted;
}

function allowedNextStatuses(current: ShipmentStatus) {
  const index = shipmentFlow.indexOf(current);
  return shipmentFlow.slice(Math.max(0, index));
}

const emptyDraft: CreateShipmentDraft = {
  sellId: 0,
  trackingNumber: "",
  carrier: "",
  shippingMethod: "",
  status: "pending",
  estimatedDelivery: "",
  shippingCost: 0,
  weight: 0,
  dimensions: "",
  notes: "",
};

export default function ShipmentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { formatCurrency } = useCurrency();
  const [shipments, setShipments]       = useState<Shipment[]>([]);
  const [stats, setStats]               = useState({ total: 0, pending: 0, inTransit: 0, delivered: 0, failed: 0 });
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "">("");
  const [page, setPage]                 = useState(1);
  const [hasNext, setHasNext]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [viewVisible, setViewVisible]     = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [draft, setDraft]               = useState<CreateShipmentDraft>(emptyDraft);
  const [invoiceLookup, setInvoiceLookup] = useState("");
  const [linkedOrder, setLinkedOrder]   = useState<Order | null>(null);
  const [saving, setSaving]             = useState(false);
  const [statusDraft, setStatusDraft]   = useState({ status: "pending" as ShipmentStatus, location: "", description: "" });

  useEffect(() => { navigation.setOptions({ title: "Shipments" }); }, [navigation]);

  const load = useCallback(async (nextPage: number, mode: "reset" | "append") => {
    const [listRes, statsRes] = await Promise.all([
      getShipments({ page: nextPage, limit: 20, search: searchQuery || undefined, status: statusFilter || undefined }),
      getShipmentStats(),
    ]);
    setShipments((current) => mode === "append" ? [...current, ...listRes.data] : listRes.data);
    setStats({ total: statsRes.total, pending: statsRes.pending, inTransit: statsRes.inTransit, delivered: statsRes.delivered, failed: statsRes.failed });
    setPage(listRes.page);
    setHasNext(listRes.page * listRes.perPage < listRes.total);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const bootstrap = async () => { try { setLoading(true); await load(1, "reset"); } finally { setLoading(false); } };
    void bootstrap();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await load(1, "reset"); } finally { setRefreshing(false); }
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;
    try { setLoadingMore(true); await load(page + 1, "append"); } finally { setLoadingMore(false); }
  }, [hasNext, loadingMore, loading, load, page]);

  const openCreate = () => { setDraft(emptyDraft); setInvoiceLookup(""); setLinkedOrder(null); setCreateVisible(true); };

  const openView = async (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setViewVisible(true);
    const full = await getShipmentById(shipment.id);
    setSelectedShipment(full);
  };

  const openStatusUpdate = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setStatusDraft({ status: shipment.status, location: "", description: "" });
    setStatusVisible(true);
  };

  const searchActive = searchQuery.trim().length > 0;
  const compactHeader = searchActive || statusFilter !== "";
  const statusOptions = useMemo(() => allowedNextStatuses(selectedShipment?.status ?? "pending"), [selectedShipment?.status]);
  const visibleShipments = useMemo(
    () => (statusFilter ? shipments.filter((item) => item.status === statusFilter) : shipments),
    [shipments, statusFilter],
  );

  const statCards = [
    { label: "Total",      value: stats.total,      bg: "#f1f5f9", text: colors.text },
    { label: "Pending",    value: stats.pending,    bg: "#fef3c7", text: "#92400e" },
    { label: "In Transit", value: stats.inTransit,  bg: "#ede9fe", text: "#6d28d9" },
    { label: "Delivered",  value: stats.delivered,  bg: "#dcfce7", text: "#166534" },
    { label: "Failed",     value: stats.failed,     bg: "#fee2e2", text: "#991b1b" },
  ];

  const listHeader = (
    <>
      <View style={[s.header, compactHeader && { paddingTop: 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Shipments</Text>
          {!compactHeader && <Text style={s.subtitle}>Track deliveries and update status</Text>}
        </View>
        <Pressable style={s.createBtn} onPress={openCreate}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.createBtnText}>Create</Text>
        </Pressable>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search tracking, order, customer…" style={s.searchInput} placeholderTextColor="#94a3b8" />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {!compactHeader && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statScroll} contentContainerStyle={s.statRow}>
          {statCards.map((c) => (
            <View key={c.label} style={[s.statChip, { backgroundColor: c.bg }]}>
              <Text style={[s.statValue, { color: c.text }]}>{c.value}</Text>
              <Text style={[s.statLabel, { color: c.text }]}>{c.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {["", ...shipmentFlow].map((value) => {
          const label = value ? value.replace(/_/g, " ") : "All";
          const active = value === statusFilter;
          const dot = value ? statusDot(value) : colors.muted;
          return (
            <Pressable key={label} style={[s.tab, active && s.tabActive]} onPress={() => setStatusFilter(value as ShipmentStatus | "")}>
              {value ? <View style={[s.tabDot, { backgroundColor: dot }]} /> : null}
              <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          style={s.list}
          data={visibleShipments}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            const dot = statusDot(item.status);
            return (
              <Pressable style={[s.card, { borderLeftColor: dot }]} onPress={() => void openView(item)}>
                {/* Row 1: tracking + status */}
                <View style={s.cardTop}>
                  <View style={[s.statusDotBig, { backgroundColor: dot + "22" }]}>
                    <Ionicons name="cube-outline" size={18} color={dot} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.tracking} numberOfLines={1}>{item.trackingNumber || "No tracking #"}</Text>
                    <Text style={s.cardMeta} numberOfLines={1}>
                      #{item.sell?.invoiceNo ?? item.sellId} · {item.sell?.customerName ?? "Customer"}
                    </Text>
                  </View>
                  <ShipmentStatusPill status={item.status} />
                </View>

                {/* Row 2: carrier + method */}
                {(item.carrier || item.shippingMethod) ? (
                  <View style={s.cardMid}>
                    <Ionicons name="car-outline" size={13} color={colors.muted} />
                    <Text style={s.cardMeta}>{[item.carrier, item.shippingMethod].filter(Boolean).join(" · ")}</Text>
                  </View>
                ) : null}

                {/* Row 3: time + update btn */}
                <View style={s.cardBottom}>
                  <View style={s.cardMid}>
                    <Ionicons name="time-outline" size={13} color={colors.muted} />
                    <Text style={s.cardMeta}>{formatDateTime(item.shippedAt || item.createdAt)}</Text>
                  </View>
                  <Pressable style={s.updateBtn} onPress={() => openStatusUpdate(item)}>
                    <Ionicons name="refresh-outline" size={13} color={colors.primaryDark} />
                    <Text style={s.updateBtnText}>Update</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primaryDark} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => void onEndReached()}
          ListFooterComponent={loadingMore ? <View style={s.footerLoader}><ActivityIndicator color={colors.primaryDark} /></View> : <View style={{ height: 24 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={40} color={colors.muted} />
              <Text style={s.emptyTitle}>No shipments found</Text>
              <Text style={s.emptyText}>Adjust filters or create a new shipment.</Text>
            </View>
          }
          contentContainerStyle={[s.listContent, visibleShipments.length === 0 && s.listContentEmpty]}
        />
      )}

      {/* ── Create Modal ── */}
      <Modal visible={createVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setCreateVisible(false)}>
        <Pressable style={s.backdrop} onPress={() => setCreateVisible(false)}>
          <Pressable style={s.sheet} onPress={() => undefined}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Create Shipment</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: Math.max(insets.bottom, 12) }}>
              <LabeledInput label="Invoice number" value={invoiceLookup} onChangeText={setInvoiceLookup} placeholder="#INV-1001" />
              <Pressable style={s.lookupBtn} onPress={async () => {
                const found = await getOrderByInvoice(invoiceLookup);
                setLinkedOrder(found);
                setDraft((d) => ({ ...d, sellId: found.id }));
              }}>
                <Ionicons name="search-outline" size={15} color="#fff" />
                <Text style={s.lookupBtnText}>Load Order</Text>
              </Pressable>
              {linkedOrder ? (
                <View style={s.linkedOrder}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
                  <View>
                    <Text style={s.linkedOrderTitle}>#{linkedOrder.invoiceNo}</Text>
                    <Text style={s.linkedOrderMeta}>{linkedOrder.customerName}</Text>
                  </View>
                </View>
              ) : null}
              <LabeledInput label="Tracking number" value={draft.trackingNumber ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, trackingNumber: v }))} placeholder="DHL-BD-123456789" />
              <LabeledInput label="Carrier" value={draft.carrier ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, carrier: v }))} placeholder="DHL Express" />
              <LabeledInput label="Shipping method" value={draft.shippingMethod ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, shippingMethod: v }))} placeholder="Express Delivery" />
              <DateField
                label="Estimated delivery"
                value={draft.estimatedDelivery ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, estimatedDelivery: v }))}
              />
              <LabeledInput label="Shipping cost" value={String(draft.shippingCost ?? 0)} onChangeText={(v) => setDraft((d) => ({ ...d, shippingCost: Number(v) || 0 }))} placeholder="150.00" />
              <LabeledInput label="Weight (kg)" value={String(draft.weight ?? 0)} onChangeText={(v) => setDraft((d) => ({ ...d, weight: Number(v) || 0 }))} placeholder="2.5" />
              <LabeledInput label="Dimensions" value={draft.dimensions ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, dimensions: v }))} placeholder="30x20x15 cm" />
              <LabeledInput label="Notes" value={draft.notes ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, notes: v }))} placeholder="Special handling…" multiline />
              <View style={s.sheetActions}>
                <Pressable style={s.cancelBtn} onPress={() => setCreateVisible(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.confirmBtn, (!draft.sellId || saving) && s.confirmBtnDisabled]} onPress={async () => {
                  try { setSaving(true); await createShipment(draft); setCreateVisible(false); await load(1, "reset"); } finally { setSaving(false); }
                }} disabled={!draft.sellId || saving}>
                  <Text style={s.confirmBtnText}>{saving ? "Creating…" : "Create Shipment"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── View Details Modal ── */}
      <Modal visible={viewVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setViewVisible(false)}>
        <View style={s.backdrop}>
          <Pressable style={s.backdropTouchable} onPress={() => setViewVisible(false)} />
          <View style={s.detailSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Shipment Details</Text>
            {selectedShipment ? (
              <View style={s.detailSheetBody}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
                  nestedScrollEnabled
                >
                  {/* Status banner */}
                  <View style={[s.statusBanner, { backgroundColor: (STATUS_COLOR[selectedShipment.status]?.bg ?? "#f1f5f9") }]}>
                    <View style={[s.statusBannerDot, { backgroundColor: statusDot(selectedShipment.status) }]} />
                    <Text style={[s.statusBannerText, { color: STATUS_COLOR[selectedShipment.status]?.text ?? colors.text }]}>
                      {selectedShipment.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                  </View>

                  {/* Info cards */}
                  <View style={s.infoCard}>
                    <Text style={s.infoCardTitle}>Order Info</Text>
                    <InfoRow icon="receipt-outline" label="Order" value={`#${selectedShipment.sell?.invoiceNo ?? selectedShipment.sellId}`} />
                    <InfoRow icon="person-outline" label="Customer" value={selectedShipment.sell?.customerName ?? "—"} />
                  </View>

                  <View style={s.infoCard}>
                    <Text style={s.infoCardTitle}>Delivery Info</Text>
                    <InfoRow icon="barcode-outline" label="Tracking" value={selectedShipment.trackingNumber || "—"} />
                    <InfoRow icon="car-outline" label="Carrier" value={selectedShipment.carrier || "—"} />
                    <InfoRow icon="navigate-outline" label="Method" value={selectedShipment.shippingMethod || "—"} />
                    <InfoRow icon="cash-outline" label="Cost" value={formatCurrency(Number(selectedShipment.shippingCost ?? 0))} />
                  </View>

                  <View style={s.infoCard}>
                    <Text style={s.infoCardTitle}>Timeline</Text>
                    <InfoRow icon="send-outline" label="Shipped" value={formatDateTime(selectedShipment.shippedAt || selectedShipment.createdAt)} />
                    <InfoRow icon="calendar-outline" label="Estimated" value={formatDateTime(selectedShipment.estimatedDelivery)} />
                    <InfoRow icon="checkmark-circle-outline" label="Delivered" value={formatDateTime(selectedShipment.deliveredAt)} />
                  </View>

                  {selectedShipment.notes ? (
                    <View style={s.notesCard}>
                      <Ionicons name="document-text-outline" size={14} color={colors.muted} />
                      <Text style={s.notesText}>{selectedShipment.notes}</Text>
                    </View>
                  ) : null}

                  {(selectedShipment.trackingHistory ?? []).length > 0 ? (
                    <View style={{ gap: 8 }}>
                      <Text style={s.historyTitle}>Tracking History</Text>
                      {(selectedShipment.trackingHistory ?? []).map((event, idx) => {
                        const dot = statusDot(event.status);
                        return (
                          <View key={event.id} style={s.historyItem}>
                            <View style={s.historyLine}>
                              <View style={[s.historyDot, { backgroundColor: dot }]} />
                              {idx < (selectedShipment.trackingHistory ?? []).length - 1 && <View style={s.historyConnector} />}
                            </View>
                            <View style={s.historyContent}>
                              <View style={s.historyHeader}>
                                <Text style={[s.historyStatus, { color: dot }]}>
                                  {event.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </Text>
                                <Text style={s.historyTime}>{formatDateTime(event.eventTime)}</Text>
                              </View>
                              {event.location ? <Text style={s.historyMeta}><Ionicons name="location-outline" size={11} /> {event.location}</Text> : null}
                              {event.description ? <Text style={s.historyDesc}>{event.description}</Text> : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </ScrollView>

                <View style={[s.detailActionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <Pressable style={s.updateStatusBtn} onPress={() => { setViewVisible(false); if (selectedShipment) openStatusUpdate(selectedShipment); }}>
                    <Ionicons name="refresh-outline" size={16} color="#fff" />
                    <Text style={s.updateStatusBtnText}>Update Status</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={s.center}><ActivityIndicator color={colors.primaryDark} /></View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Status Update Modal ── */}
      <Modal visible={statusVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setStatusVisible(false)}>
        <Pressable style={s.backdrop} onPress={() => setStatusVisible(false)}>
          <Pressable style={s.sheet} onPress={() => undefined}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Update Status</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: Math.max(insets.bottom, 12) }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusChips}>
                {statusOptions.map((status) => {
                  const active = statusDraft.status === status;
                  const dot = statusDot(status);
                  return (
                    <Pressable
                      key={status}
                      style={[s.statusChip, active && { borderColor: dot, backgroundColor: dot + "18" }]}
                      onPress={() => setStatusDraft((d) => ({ ...d, status }))}
                    >
                      <View style={[s.tabDot, { backgroundColor: dot }]} />
                      <Text style={[s.statusChipText, active && { color: dot }]}>
                        {status.replace(/_/g, " ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <LabeledInput label="Location" value={statusDraft.location} onChangeText={(v) => setStatusDraft((d) => ({ ...d, location: v }))} placeholder="Dhaka Distribution Center" />
              <LabeledInput label="Description" value={statusDraft.description} onChangeText={(v) => setStatusDraft((d) => ({ ...d, description: v }))} placeholder="Package in transit…" multiline />
              <View style={s.sheetActions}>
                <Pressable style={s.cancelBtn} onPress={() => setStatusVisible(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[s.confirmBtn, saving && s.confirmBtnDisabled]} onPress={async () => {
                  if (!selectedShipment) return;
                  try { setSaving(true); await updateShipmentStatus(selectedShipment.id, statusDraft); setStatusVisible(false); await load(1, "reset"); } finally { setSaving(false); }
                }}>
                  <Text style={s.confirmBtnText}>{saving ? "Updating…" : "Confirm Update"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const parsed = value ? new Date(value) : null;
  const [pickerYear,  setPickerYear]  = useState(parsed ? parsed.getFullYear()  : today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(parsed ? parsed.getMonth()     : today.getMonth());
  const [pickerDay,   setPickerDay]   = useState(parsed ? parsed.getDate()      : today.getDate());

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();

  const confirm = () => {
    const mm = String(pickerMonth + 1).padStart(2, "0");
    const dd = String(pickerDay).padStart(2, "0");
    onChange(`${pickerYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const displayText = value
    ? (() => { const d = new Date(value + "T00:00:00"); return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })()
    : "Select date";

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <Pressable style={s.dateTrigger} onPress={() => setOpen(true)}>
        <Ionicons name="calendar-outline" size={16} color={value ? colors.text : colors.muted} />
        <Text style={[s.dateTriggerText, !value && { color: "#94a3b8" }]}>{displayText}</Text>
        {value ? (
          <Pressable hitSlop={8} onPress={() => onChange("")}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.datePicker} onPress={() => undefined}>
            <Text style={s.datePickerTitle}>Select Date</Text>

            {/* Year row */}
            <View style={s.dateRow}>
              <Pressable style={s.dateArrow} onPress={() => setPickerYear((y) => y - 1)}>
                <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
              </Pressable>
              <Text style={s.dateUnit}>{pickerYear}</Text>
              <Pressable style={s.dateArrow} onPress={() => setPickerYear((y) => y + 1)}>
                <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
              </Pressable>
            </View>

            {/* Month row */}
            <View style={s.dateRow}>
              <Pressable style={s.dateArrow} onPress={() => setPickerMonth((m) => (m === 0 ? 11 : m - 1))}>
                <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
              </Pressable>
              <Text style={s.dateUnit}>{monthNames[pickerMonth]}</Text>
              <Pressable style={s.dateArrow} onPress={() => setPickerMonth((m) => (m === 11 ? 0 : m + 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
              </Pressable>
            </View>

            {/* Day grid */}
            <View style={s.dayGrid}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <Pressable
                  key={d}
                  style={[s.dayCell, pickerDay === d && s.dayCellActive]}
                  onPress={() => setPickerDay(d)}
                >
                  <Text style={[s.dayCellText, pickerDay === d && s.dayCellTextActive]}>{d}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.sheetActions}>
              <Pressable style={s.cancelBtn} onPress={() => setOpen(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.confirmBtn} onPress={confirm}>
                <Text style={s.confirmBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function LabeledInput({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94a3b8" multiline={multiline} style={[s.input, multiline && s.inputMulti]} />
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primaryDark, borderRadius: 14, paddingHorizontal: 14, height: 40 },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Stat chips
  statScroll: { height: 68, marginTop: 4 },
  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, alignItems: "center" },
  statChip: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", minWidth: 72, gap: 2 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },

  // Search
  searchRow: { paddingHorizontal: 20, marginTop: 6 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  // Tab filter
  tabScroll: { height: 46, marginTop: 6 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7 },
  tabActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  tabDot: { width: 7, height: 7, borderRadius: 4 },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  tabTextActive: { color: colors.primaryDark },

  // List
  list: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 12, paddingTop: 8, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1 },
  footerLoader: { paddingVertical: 16, alignItems: "center" },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },

  // Card
  card: { borderRadius: 18, borderWidth: 1, borderLeftWidth: 4, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDotBig: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tracking: { color: colors.text, fontSize: 14, fontWeight: "800" },
  cardMid: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMeta: { color: colors.muted, fontSize: 12 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  updateBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.primaryDark + "44", backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 6 },
  updateBtnText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },

  // Modal sheet
  backdrop: { flex: 1, backgroundColor: "rgba(241,245,249,0.76)", justifyContent: "flex-end" },
  backdropTouchable: { ...StyleSheet.absoluteFillObject },
  sheet: { maxHeight: "90%", backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  detailSheet: {
    height: "90%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  detailSheetBody: { flex: 1, minHeight: 0, gap: 12 },
  detailActionBar: {
    paddingTop: 8,
    backgroundColor: colors.surface,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 6 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { color: colors.text, fontWeight: "700" },
  confirmBtn: { flex: 2, borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 14, alignItems: "center" },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: "#fff", fontWeight: "800" },

  // Create modal helpers
  lookupBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 12 },
  lookupBtnText: { color: "#fff", fontWeight: "800" },
  linkedOrder: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: "#a7f3d0", backgroundColor: "#ecfdf5", padding: 12 },
  linkedOrderTitle: { color: colors.primaryDark, fontWeight: "800", fontSize: 14 },
  linkedOrderMeta: { color: "#166534", fontSize: 12 },

  // Input
  inputLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 14, color: colors.text, fontSize: 14 },
  inputMulti: { minHeight: 88, paddingVertical: 12, textAlignVertical: "top" },

  // Status banner
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 12 },
  statusBannerDot: { width: 10, height: 10, borderRadius: 5 },
  statusBannerText: { fontSize: 15, fontWeight: "800", textTransform: "capitalize" },

  // Info card in details
  infoCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 14, gap: 10 },
  infoCardTitle: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { color: colors.muted, fontSize: 13, width: 72 },
  infoValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "right" },

  // Notes
  notesCard: { flexDirection: "row", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12 },
  notesText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 },

  // Tracking history timeline
  historyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  historyItem: { flexDirection: "row", gap: 12 },
  historyLine: { alignItems: "center", width: 16 },
  historyDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  historyConnector: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
  historyContent: { flex: 1, paddingBottom: 14, gap: 3 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyStatus: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  historyTime: { color: colors.muted, fontSize: 11 },
  historyMeta: { color: colors.muted, fontSize: 12 },
  historyDesc: { color: colors.text, fontSize: 13 },

  // Update status modal
  statusChips: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8 },
  statusChipText: { color: colors.text, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  // Update status button in detail
  updateStatusBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: colors.primaryDark, paddingVertical: 14, marginTop: 4 },
  updateStatusBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Date field
  dateTrigger: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 14 },
  dateTriggerText: { flex: 1, color: colors.text, fontSize: 14 },
  datePicker: { marginHorizontal: 24, backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 16 },
  datePickerTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingVertical: 8, paddingHorizontal: 6 },
  dateArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primaryDark + "12" },
  dateUnit: { color: colors.text, fontSize: 16, fontWeight: "800" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  dayCell: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  dayCellActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  dayCellText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  dayCellTextActive: { color: "#fff", fontWeight: "800" },
});
