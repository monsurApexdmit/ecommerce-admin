import { redirect } from "next/navigation"

// Wishlist analytics now lives inside the Online store page.
export default function WishlistAnalyticsRedirect() {
  redirect("/dashboard/store#wishlist")
}
