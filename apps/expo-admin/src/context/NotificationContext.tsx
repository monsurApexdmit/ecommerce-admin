import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { presentAdminNotification } from "@/lib/mobile-notifications";
import { disconnectReverb, subscribeToNotifications } from "@/lib/reverb";
import {
  bulkDeleteNotifications,
  deleteNotification,
  getNotifications,
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
