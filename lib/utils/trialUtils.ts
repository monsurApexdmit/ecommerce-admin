/**
 * Trial Utility Functions
 * Helper functions for trial calculations and formatting
 */

/**
 * Calculate days remaining in trial
 * @param endDate - Trial end date (ISO string)
 * @returns Number of days remaining (0 or negative if expired)
 */
export function calculateDaysRemaining(endDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  const diffTime = end.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Check if trial is expiring soon (within 3 days)
 * @param daysRemaining - Days remaining in trial
 * @returns true if expiring within 3 days
 */
export function isTrialExpiringSoon(daysRemaining: number): boolean {
  return daysRemaining <= 3 && daysRemaining > 0
}

/**
 * Check if trial is expired
 * @param daysRemaining - Days remaining in trial
 * @returns true if trial has expired
 */
export function isTrialExpired(daysRemaining: number): boolean {
  return daysRemaining <= 0
}

/**
 * Format trial end date for display
 * @param endDate - Trial end date (ISO string)
 * @returns Formatted date string (e.g., "March 20, 2026")
 */
export function formatTrialEndDate(endDate: string): string {
  return new Date(endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Format trial duration (e.g., "7 days remaining")
 * @param daysRemaining - Days remaining in trial
 * @returns Formatted string
 */
export function formatTrialDuration(daysRemaining: number): string {
  if (daysRemaining < 0) {
    return "Expired"
  }

  if (daysRemaining === 0) {
    return "Expires today"
  }

  if (daysRemaining === 1) {
    return "1 day remaining"
  }

  return `${daysRemaining} days remaining`
}

/**
 * Get trial status color
 * @param daysRemaining - Days remaining in trial
 * @returns Color class name (e.g., "emerald", "yellow", "red")
 */
export function getTrialStatusColor(daysRemaining: number): "emerald" | "yellow" | "red" {
  if (daysRemaining <= 0) {
    return "red"
  }

  if (daysRemaining <= 3) {
    return "yellow"
  }

  return "emerald"
}

/**
 * Calculate trial progress percentage
 * @param daysRemaining - Days remaining in trial
 * @param totalDays - Total trial days (default 10)
 * @returns Percentage (0-100)
 */
export function calculateTrialProgress(daysRemaining: number, totalDays: number = 10): number {
  return Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100))
}

/**
 * Get trial summary message
 * @param daysRemaining - Days remaining in trial
 * @returns Summary message
 */
export function getTrialSummaryMessage(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return "Your trial has expired. Please upgrade to continue."
  }

  if (daysRemaining <= 3) {
    return `Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Upgrade now to maintain access.`
  }

  if (daysRemaining <= 7) {
    return `Your trial expires in ${daysRemaining} days. Start your subscription to unlock all features.`
  }

  return `Enjoy your free trial! You have ${daysRemaining} days of free access.`
}

/**
 * Batch calculate trial info
 * @param endDate - Trial end date (ISO string)
 * @returns Object with all trial information
 */
export function getTrialInfo(endDate: string) {
  const daysRemaining = calculateDaysRemaining(endDate)
  const isExpired = isTrialExpired(daysRemaining)
  const isExpiringSoon = isTrialExpiringSoon(daysRemaining)
  const formattedEndDate = formatTrialEndDate(endDate)
  const duration = formatTrialDuration(daysRemaining)
  const color = getTrialStatusColor(daysRemaining)
  const progress = calculateTrialProgress(daysRemaining)
  const message = getTrialSummaryMessage(daysRemaining)

  return {
    daysRemaining,
    isExpired,
    isExpiringSoon,
    formattedEndDate,
    duration,
    color,
    progress,
    message,
  }
}
