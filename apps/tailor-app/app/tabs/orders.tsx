import { Redirect } from "expo-router"

// Delegate to the full tailor orders screen
export default function OrdersTab() {
  return <Redirect href="/tailor" />
}
