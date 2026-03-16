/**
 * Subscription Utility Functions
 * Helper functions for subscription calculations and formatting
 */

/**
 * Calculate days until renewal
 * @param endDate - Subscription end date (ISO string)
 * @returns Number of days until renewal
 */
export function calculateDaysUntilRenewal(endDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  const diffTime = end.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Check if subscription is expiring soon (within 7 days)
 * @param daysUntilRenewal - Days until renewal
 * @returns true if expiring within 7 days
 */
export function isSubscriptionRenewingSoon(daysUntilRenewal: number): boolean {
  return daysUntilRenewal <= 7 && daysUntilRenewal > 0
}

/**
 * Check if subscription is expired
 * @param daysUntilRenewal - Days until renewal
 * @returns true if subscription has expired
 */
export function isSubscriptionExpired(daysUntilRenewal: number): boolean {
  return daysUntilRenewal <= 0
}

/**
 * Format subscription end date for display
 * @param endDate - Subscription end date (ISO string)
 * @returns Formatted date string (e.g., "April 10, 2026")
 */
export function formatSubscriptionEndDate(endDate: string): string {
  return new Date(endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Format subscription duration (e.g., "7 days until renewal")
 * @param daysUntilRenewal - Days until renewal
 * @returns Formatted string
 */
export function formatSubscriptionDuration(daysUntilRenewal: number): string {
  if (daysUntilRenewal < 0) {
    return "Expired"
  }

  if (daysUntilRenewal === 0) {
    return "Renews today"
  }

  if (daysUntilRenewal === 1) {
    return "1 day until renewal"
  }

  return `${daysUntilRenewal} days until renewal`
}

/**
 * Get subscription status
 * @param daysUntilRenewal - Days until renewal
 * @returns Status string ("active" | "expiring_soon" | "expired")
 */
export function getSubscriptionStatus(
  daysUntilRenewal: number
): "active" | "expiring_soon" | "expired" {
  if (daysUntilRenewal <= 0) {
    return "expired"
  }

  if (daysUntilRenewal <= 7) {
    return "expiring_soon"
  }

  return "active"
}

/**
 * Get subscription status color
 * @param daysUntilRenewal - Days until renewal
 * @returns Color class name (e.g., "emerald", "yellow", "red")
 */
export function getSubscriptionStatusColor(daysUntilRenewal: number): "emerald" | "yellow" | "red" {
  if (daysUntilRenewal <= 0) {
    return "red"
  }

  if (daysUntilRenewal <= 7) {
    return "yellow"
  }

  return "emerald"
}

/**
 * Format price for display
 * @param price - Price in cents (e.g., 7900 = $79.00)
 * @param currency - Currency code (default "USD")
 * @returns Formatted price string (e.g., "$79.00")
 */
export function formatPrice(price: number, currency: string = "USD"): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  })

  return formatter.format(price / 100)
}

/**
 * Calculate plan cost
 * @param monthlyPrice - Monthly price in cents
 * @param billingPeriod - "monthly" | "yearly"
 * @param yearlyDiscount - Discount percentage for yearly (default 20)
 * @returns Annual cost in cents
 */
export function calculatePlanCost(
  monthlyPrice: number,
  billingPeriod: "monthly" | "yearly",
  yearlyDiscount: number = 20
): number {
  if (billingPeriod === "monthly") {
    return monthlyPrice
  }

  const annualPrice = monthlyPrice * 12
  const discount = (annualPrice * yearlyDiscount) / 100
  return Math.round(annualPrice - discount)
}

/**
 * Calculate yearly savings
 * @param monthlyPrice - Monthly price in cents
 * @param yearlyDiscount - Discount percentage (default 20)
 * @returns Savings in cents
 */
export function calculateYearlySavings(monthlyPrice: number, yearlyDiscount: number = 20): number {
  const annualPrice = monthlyPrice * 12
  return Math.round((annualPrice * yearlyDiscount) / 100)
}

/**
 * Get subscription summary message
 * @param daysUntilRenewal - Days until renewal
 * @param planName - Name of the plan
 * @returns Summary message
 */
export function getSubscriptionSummaryMessage(daysUntilRenewal: number, planName: string): string {
  const status = getSubscriptionStatus(daysUntilRenewal)

  if (status === "expired") {
    return `Your ${planName} subscription has expired. Please renew to regain access.`
  }

  if (status === "expiring_soon") {
    return `Your ${planName} subscription renews in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? "s" : ""}.`
  }

  return `Your ${planName} subscription is active and renews in ${daysUntilRenewal} days.`
}

/**
 * Batch calculate subscription info
 * @param endDate - Subscription end date (ISO string)
 * @param planName - Name of the plan
 * @returns Object with all subscription information
 */
export function getSubscriptionInfo(endDate: string, planName: string = "Your") {
  const daysUntilRenewal = calculateDaysUntilRenewal(endDate)
  const isExpired = isSubscriptionExpired(daysUntilRenewal)
  const isRenewingSoon = isSubscriptionRenewingSoon(daysUntilRenewal)
  const formattedEndDate = formatSubscriptionEndDate(endDate)
  const duration = formatSubscriptionDuration(daysUntilRenewal)
  const status = getSubscriptionStatus(daysUntilRenewal)
  const color = getSubscriptionStatusColor(daysUntilRenewal)
  const message = getSubscriptionSummaryMessage(daysUntilRenewal, planName)

  return {
    daysUntilRenewal,
    isExpired,
    isRenewingSoon,
    formattedEndDate,
    duration,
    status,
    color,
    message,
  }
}
