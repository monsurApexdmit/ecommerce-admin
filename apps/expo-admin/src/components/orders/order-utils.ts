import { Alert } from "react-native";
import { apiErrorMessage, formatShortDateTime } from "@/lib/format";
import { updateOrderFulfillment, updateOrderStatus } from "@/services/order-service";
import type { FollowUpChannel, FollowUpOutcome, Order, OrderTab } from "@/types/order";

export type OrderStage = "Pending" | "Confirmed" | "Packed" | "Shipped" | "Delivered" | "Completed" | "Cancelled";

/** Derived order stage (mirrors the server's list tabs): status + fulfillment + payment. */
export function orderStage(o: Pick<Order, "status" | "fulfillmentStatus" | "paymentStatus" | "shippedAt">): OrderStage {
  if (o.status === "Cancelled") return "Cancelled";
  if (o.status === "Delivered") return String(o.paymentStatus ?? "").toLowerCase() === "paid" ? "Completed" : "Delivered";
  if (o.fulfillmentStatus === "shipped" || (o.status === "Processing" && o.shippedAt)) return "Shipped";
  if (o.fulfillmentStatus === "packed") return "Packed";
  return o.status === "Processing" ? "Confirmed" : "Pending";
}

export const STAGE_COLOR: Record<OrderStage, string> = {
  Pending: "#f59e0b",
  Confirmed: "#3b82f6",
  Packed: "#6366f1",
  Shipped: "#8b5cf6",
  Delivered: "#10b981",
  Completed: "#059669",
  Cancelled: "#94a3b8",
};

export const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/** One stage-moving action an order allows right now. */
export interface StageAction {
  key: "confirm" | "packed" | "shipped" | "delivered" | "cancel";
  label: string;
  destructive?: boolean;
}

/**
 * Actions matching the order model: Confirm = Pending -> Processing (status), Packed/Shipped go through
 * fulfillment, Delivered is a status. Cancelled/Delivered orders cannot move (returns handle those).
 */
export function stageActions(o: Order): StageAction[] {
  const stage = orderStage(o);
  if (stage === "Cancelled" || stage === "Delivered" || stage === "Completed") return [];
  const actions: StageAction[] = [];
  if (stage === "Pending") actions.push({ key: "confirm", label: "Confirm order" });
  if (stage === "Pending" || stage === "Confirmed") actions.push({ key: "packed", label: "Mark packed" });
  if (stage !== "Shipped" && o.source !== "pos") actions.push({ key: "shipped", label: "Mark shipped" });
  actions.push({ key: "delivered", label: "Mark delivered" });
  actions.push({ key: "cancel", label: "Cancel order", destructive: true });
  return actions;
}

export const FOLLOW_UP_OUTCOMES: { value: FollowUpOutcome; label: string; description: string; icon: string; color: string }[] = [
  { value: "confirmed", label: "Confirmed", description: "Customer wants the order", icon: "checkmark-circle-outline", color: "#059669" },
  { value: "no_answer", label: "No answer", description: "Didn't pick up or busy", icon: "call-outline", color: "#64748b" },
  { value: "call_later", label: "Call later", description: "Asked for a call back", icon: "time-outline", color: "#d97706" },
  { value: "wrong_number", label: "Wrong number", description: "Number is wrong or off", icon: "close-circle-outline", color: "#dc2626" },
  { value: "customer_cancelled", label: "Customer cancelled", description: "Cancels the order", icon: "ban-outline", color: "#dc2626" },
  { value: "other", label: "Other", description: "Anything else (add a note)", icon: "chatbubble-ellipses-outline", color: "#6366f1" },
];

export const NOTE_REQUIRED_OUTCOMES: FollowUpOutcome[] = ["wrong_number", "customer_cancelled", "other"];

export const FOLLOW_UP_CHANNELS: { value: FollowUpChannel; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "other", label: "Other" },
];

export function followUpOutcomeLabel(o?: string | null) {
  return FOLLOW_UP_OUTCOMES.find((x) => x.value === o)?.label ?? "—";
}

export function followUpChannelLabel(c?: string | null) {
  return FOLLOW_UP_CHANNELS.find((x) => x.value === c)?.label ?? (c || "—");
}

/** Pending, or confirmed and not yet handed to a courier (mirrors the backend rule). */
export function canFollowUp(o: Pick<Order, "status" | "fulfillmentStatus" | "shippedAt">): boolean {
  if (o.status === "Pending") return true;
  return o.status === "Processing" && o.fulfillmentStatus !== "shipped" && !o.shippedAt;
}

/** "2 calls · No answer · next 3:00 pm"; null when there is nothing to show. */
export function followUpSummary(o: Order): { text: string; overdue: boolean } | null {
  const n = Number(o.followUpCount) || 0;
  if (n === 0) return o.status === "Pending" ? { text: "Not called yet", overdue: false } : null;
  const parts = [`${n} call${n === 1 ? "" : "s"}`, followUpOutcomeLabel(o.lastFollowUpOutcome)];
  let overdue = false;
  if (o.nextFollowUpAt && canFollowUp(o)) {
    parts.push(`next ${formatShortDateTime(o.nextFollowUpAt)}`);
    overdue = new Date(o.nextFollowUpAt).getTime() <= Date.now();
  }
  return { text: parts.join(" · "), overdue };
}

/** Phone to call for an order: delivery phone, then the saved address, then the customer. */
export function orderPhone(o: Order): string {
  return o.shippingPhone || o.shippingAddress?.phone || o.customerPhone || "";
}

export function telUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

async function performStageAction(o: Order, key: StageAction["key"]): Promise<Order> {
  switch (key) {
    case "confirm":
      return updateOrderStatus(o.id, "Processing");
    case "packed":
      return updateOrderFulfillment(o.id, "packed");
    case "shipped":
      return updateOrderFulfillment(o.id, "shipped");
    case "delivered":
      return updateOrderStatus(o.id, "Delivered");
    case "cancel":
      return updateOrderStatus(o.id, "Cancelled");
  }
}

/**
 * Runs a stage action (asking first for cancel/delivered). Resolves with the updated order, or null when the
 * user backed out or the server refused (its message is shown verbatim).
 */
export function runStageAction(o: Order, action: StageAction): Promise<Order | null> {
  const run = async () => {
    try {
      return await performStageAction(o, action.key);
    } catch (err) {
      Alert.alert("Could not update order", apiErrorMessage(err, "Please try again."));
      return null;
    }
  };
  const confirmText =
    action.key === "cancel"
      ? `Cancel #${o.invoiceNo}? Stock goes back to inventory and any balance due is cleared.`
      : action.key === "delivered"
        ? `Mark #${o.invoiceNo} as delivered?`
        : null;
  if (!confirmText) return run();
  return new Promise((resolve) => {
    Alert.alert(action.label, confirmText, [
      { text: "Back", style: "cancel", onPress: () => resolve(null) },
      { text: action.key === "cancel" ? "Cancel order" : "Confirm", style: action.destructive ? "destructive" : "default", onPress: () => void run().then(resolve) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
