import { ProductStatusPill } from "@/components/products/ProductStatusPill";
import type { OrderStatus, ShipmentStatus } from "@/types/order";

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === "Delivered"
      ? "success"
      : status === "Processing"
        ? "warning"
        : "warning";

  return <ProductStatusPill label={status} tone={tone} />;
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
