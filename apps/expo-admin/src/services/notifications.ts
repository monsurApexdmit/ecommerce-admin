import { api } from "@/lib/api";

export type NotificationType =
  | "order"
  | "stock_alert"
  | "payment"
  | "system"
  | "support"
  | "review"
  | "payment_received"
  | "po_received"
  | "tailor_ready"
  | "daily_summary"
  | "stock_adjustment";
export type NotificationPriority = "low" | "medium" | "high";

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  readAt: string | null;
  actionUrl: string | null;
  data: Record<string, any> | null;
  createdAt: string;
}

export interface NotificationListResult {
  data: Notification[];
  total: number;
  page: number;
  lastPage: number;
  unreadCount: number;
}

function normalize(n: any): Notification {
  return {
    id: n.id,
    type: n.type ?? "system",
    title: n.title ?? "",
    message: n.message ?? "",
    priority: n.priority ?? "low",
    readAt: n.readAt ?? n.read_at ?? null,
    actionUrl: n.actionUrl ?? n.action_url ?? null,
    data: n.data ?? null,
    createdAt: n.createdAt ?? n.created_at ?? "",
  };
}

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: "read" | "unread";
}): Promise<NotificationListResult> {
  const response = await api.get("/notifications", { params });
  const d = response.data?.data ?? [];
  const meta = response.data?.meta ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalize),
    total: meta.total ?? items.length,
    page: meta.currentPage ?? params?.page ?? 1,
    lastPage: meta.lastPage ?? 1,
    unreadCount: meta.unreadCount ?? 0,
  };
}

export async function getUnreadCount(): Promise<number> {
  const response = await api.get("/notifications/unread-count");
  return Number(response.data?.data?.count ?? 0);
}

export async function markAsRead(id: number): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAsUnread(id: number): Promise<void> {
  await api.patch(`/notifications/${id}/unread`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch("/notifications/read-all");
}

export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function bulkDeleteNotifications(ids: number[]): Promise<void> {
  await api.delete("/notifications/bulk", { data: { ids } });
}

// ─── Live alerts (computed from current data, dismissable per user) ──────────

export type AlertKind = "out_of_stock" | "low_stock" | "pending_order" | "customer_overdue" | "po_overdue" | string;

export interface LiveAlert {
  key: string;
  kind: AlertKind;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl: string | null;
  ctaLabel: string | null;
  since: string | null;
}

export interface LiveAlertsResult {
  alerts: LiveAlert[];
  total: number;
  dismissedCount: number;
}

export async function getLiveAlerts(): Promise<LiveAlertsResult> {
  const response = await api.get("/notifications/alerts");
  const d = response.data?.data ?? {};
  const alerts: LiveAlert[] = Array.isArray(d.alerts)
    ? d.alerts.map((a: any) => ({
        key: String(a.key),
        kind: a.kind ?? "system",
        priority: a.priority ?? "medium",
        title: a.title ?? "",
        message: a.message ?? "",
        actionUrl: a.actionUrl ?? null,
        ctaLabel: a.ctaLabel ?? null,
        since: a.since ?? null,
      }))
    : [];
  return { alerts, total: Number(d.total ?? alerts.length), dismissedCount: Number(d.dismissedCount ?? 0) };
}

export async function dismissLiveAlert(key: string): Promise<void> {
  await api.post("/notifications/alerts/dismiss", { key });
}

/** Bring back one dismissed alert, or all of them when no key is given. */
export async function restoreLiveAlerts(key?: string): Promise<void> {
  await api.post("/notifications/alerts/restore", key ? { key } : {});
}
