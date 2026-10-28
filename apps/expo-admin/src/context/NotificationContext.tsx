import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { presentAdminNotification } from "@/lib/mobile-notifications";
import { disconnectReverb, getReverbEcho, subscribeToNotifications } from "@/lib/reverb";
import {
  bulkDeleteNotifications,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead as markAllNotificationsAsRead,
  markAsRead as markNotificationAsRead,
  markAsUnread as markNotificationAsUnread,
  type Notification,
  type NotificationType,
} from "@/services/notifications";

type NotificationQuery = {
  page?: number;
  limit?: number;
  type?: NotificationType | string;
  status?: "read" | "unread";
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (params?: NotificationQuery) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAsUnread: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  bulkDelete: (ids: number[]) => Promise<void>;
};

// G-1: polling fallback when realtime (Reverb) is off or unavailable.
// Starts at 30s, doubles after each failure up to 5 min, resets on success;
// paused while the app is in the background, refreshed once on return.
const POLL_BASE_MS = 30_000;
const POLL_MAX_MS = 5 * 60_000;

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { bootstrapped, session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (params?: NotificationQuery) => {
    setLoading(true);
    try {
      const response = await getNotifications({ limit: 50, ...params });
      setNotifications(response.data ?? []);
      setUnreadCount(response.unreadCount ?? 0);
    } catch (error) {
      console.warn("Failed to load notifications.", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const prependOrReplace = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      const exists = prev.some((item) => item.id === notification.id);
      if (exists) {
        return prev.map((item) => (item.id === notification.id ? notification : item));
      }

      return [notification, ...prev].slice(0, 50);
    });
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.warn(`Failed to mark notification ${id} as read.`, error);
    }
  }, []);

  const markAsUnread = useCallback(async (id: number) => {
    try {
      await markNotificationAsUnread(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readAt: null } : item)),
      );
      setUnreadCount((prev) => prev + 1);
    } catch (error) {
      console.warn(`Failed to mark notification ${id} as unread.`, error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.warn("Failed to mark all notifications as read.", error);
    }
  }, []);

  const handleDeleteNotification = useCallback(async (id: number) => {
    const target = notifications.find((item) => item.id === id);
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));

      if (target && !target.readAt) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.warn(`Failed to delete notification ${id}.`, error);
    }
  }, [notifications]);

  const bulkDelete = useCallback(async (ids: number[]) => {
    try {
      await bulkDeleteNotifications(ids);
      const unreadDeleted = notifications.filter((item) => ids.includes(item.id) && !item.readAt).length;
      setNotifications((prev) => prev.filter((item) => !ids.includes(item.id)));
      setUnreadCount((prev) => Math.max(0, prev - unreadDeleted));
    } catch (error) {
      console.warn("Failed to bulk delete notifications.", error);
    }
  }, [notifications]);

  useEffect(() => {
    if (!bootstrapped) return;

    if (!session?.companyId || !session.token) {
      setNotifications([]);
      setUnreadCount(0);
      disconnectReverb();
      return;
    }

    void fetchNotifications();

    const unsubscribe = subscribeToNotifications(session.companyId, {
      onCreated: (notification, incomingUnreadCount) => {
        prependOrReplace(notification);
        setUnreadCount(incomingUnreadCount);
        void presentAdminNotification(notification);
      },
      onUpdated: (_action, notification, incomingUnreadCount) => {
        prependOrReplace(notification);
        setUnreadCount(incomingUnreadCount);
      },
      onReadAll: (notificationIds, incomingUnreadCount) => {
        setNotifications((prev) =>
          prev.map((item) =>
            notificationIds.includes(item.id)
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          ),
        );
        setUnreadCount(incomingUnreadCount);
      },
      onDeleted: (_action, notificationIds, incomingUnreadCount) => {
        setNotifications((prev) => prev.filter((item) => !notificationIds.includes(item.id)));
        setUnreadCount(incomingUnreadCount);
      },
    });

    return () => {
      unsubscribe();
      disconnectReverb();
    };
  }, [bootstrapped, session?.companyId, session?.token, fetchNotifications, prependOrReplace]);

  const unreadRef = useRef(unreadCount);
  unreadRef.current = unreadCount;

  useEffect(() => {
    if (!bootstrapped || !session?.companyId || !session.token) return;

    // With realtime on, events keep the badge current; only catch up after the app was backgrounded.
    const realtime = getReverbEcho() !== null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = POLL_BASE_MS;
    let stopped = false;
    let appState: AppStateStatus = AppState.currentState;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const schedule = () => {
      clear();
      if (stopped || realtime || appState !== "active") return;
      timer = setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      try {
        const count = await getUnreadCount();
        if (stopped) return;
        delay = POLL_BASE_MS;
        if (count !== unreadRef.current) {
          setUnreadCount(count);
          // Refresh the list quietly (no loading spinner / badge flicker).
          const response = await getNotifications({ limit: 50 }).catch(() => null);
          if (!stopped && response) {
            setNotifications(response.data ?? []);
            setUnreadCount(response.unreadCount ?? count);
          }
        }
      } catch {
        // Quiet: keep the last known count and back off.
        delay = Math.min(POLL_MAX_MS, delay * 2);
      } finally {
        schedule();
      }
    };

    const sub = AppState.addEventListener("change", (next) => {
      const wasActive = appState === "active";
      appState = next;
      if (next === "active" && !wasActive) {
        delay = POLL_BASE_MS;
        void tick();
      } else if (next !== "active") {
        clear();
      }
    });

    schedule();

    return () => {
      stopped = true;
      clear();
      sub.remove();
    };
  }, [bootstrapped, session?.companyId, session?.token]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification: handleDeleteNotification,
    bulkDelete,
  }), [
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    handleDeleteNotification,
    bulkDelete,
  ]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }

  return context;
}
