export interface DashboardStats {
  totalSells: number;
  totalRevenue: number;
  pendingCount: number;
  processingCount: number;
  deliveredCount: number;
}

export interface DashboardStatsResponse {
  message: string;
  data: DashboardStats;
}
