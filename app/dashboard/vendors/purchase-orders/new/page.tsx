import { redirect } from "next/navigation"

// Reference "PONew": the purchase order list with the form already open.
export default function NewPurchaseOrderPage() {
  redirect("/dashboard/vendors/purchase-orders?new=1")
}
