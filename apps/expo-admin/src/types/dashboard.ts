export interface DashboardStats {
  totalSells: number;
  totalRevenue: number;
  pendingCount: number;
  processingCount: number;
  deliveredCount: number;
  packedCount?: number;
  shippedCount?: number;
  cancelledCount?: number;
  /** Outstanding balance on non-cancelled sales */
  totalDue?: number;
  unpaidCount?: number;
}

export interface DashboardStatsResponse {
  message: string;
  data: DashboardStats;
}
