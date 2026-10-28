import { ProductStatusPill } from "@/components/products/ProductStatusPill";
import type { Order, OrderStatus, ShipmentStatus } from "@/types/order";
import { orderStage, type OrderStage } from "./order-utils";

export function OrderStatusPill({ status }: { status: OrderStatus | string }) {
  const tone =
    status === "Delivered"
      ? "success"
      : status === "Cancelled"
        ? "danger"
        : status === "Processing"
          ? "info"
          : "warning";

  // "Processing" is shown as "Confirmed" everywhere in the admin
  return <ProductStatusPill label={status === "Processing" ? "Confirmed" : status} tone={tone} />;
}

const STAGE_TONE: Record<OrderStage, "neutral" | "success" | "warning" | "danger" | "info"> = {
  Pending: "warning",
  Confirmed: "info",
  Packed: "info",
  Shipped: "info",
  Delivered: "success",
  Completed: "success",
  Cancelled: "danger",
};

/** Derived stage (Pending / Confirmed / Packed / Shipped / Delivered / Completed / Cancelled). */
export function OrderStagePill({ order }: { order: Pick<Order, "status" | "fulfillmentStatus" | "paymentStatus" | "shippedAt"> }) {
  const stage = orderStage(order);
  return <ProductStatusPill label={stage} tone={STAGE_TONE[stage]} />;
}

export function ShipmentStatusPill({ status }: { status: ShipmentStatus }) {
  const tone =
    status === "delivered"
      ? "success"
      : status === "in_transit" || status === "out_for_delivery" || status === "picked_up"
        ? "warning"
        : status === "failed" || status === "returned"
          ? "danger"
          : "neutral";

  return <ProductStatusPill label={status.replace(/_/g, " ")} tone={tone} />;
}
