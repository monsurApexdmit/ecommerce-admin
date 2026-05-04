import { Platform } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { resolveNotificationRoute } from "@/lib/notification-routing";
import type { Notification as AdminNotification } from "@/services/notifications";

type NotificationPayload = {
  route?: string;
  source?: "notification" | "support";
  entityId?: number;
};

const ANDROID_CHANNEL_ID = "admin-updates";
const DEDUPE_WINDOW_MS = 1500;

let configured = false;
let listenerAttached = false;
let lastDispatchKey: string | null = null;
let lastDispatchAt = 0;
let responseSubscription: { remove: () => void } | null = null;
let notificationsModule: NotificationsModule | null | undefined;

type NotificationsModule = {
  AndroidImportance: { HIGH: number };
  AndroidNotificationVisibility: { PUBLIC: number };
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldShowBanner: boolean;
      shouldShowList: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }) => void;
  setNotificationChannelAsync: (channelId: string, channel: Record<string, unknown>) => Promise<unknown>;
  getPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getLastNotificationResponseAsync: () => Promise<{
    notification: { request: { content: { data?: NotificationPayload } } };
  } | null>;
  addNotificationResponseReceivedListener: (
    listener: (response: { notification: { request: { content: { data?: NotificationPayload } } } }) => void,
  ) => { remove: () => void };
  scheduleNotificationAsync: (request: {
    content: {
      title: string;
      body: string;
      sound: string;
      data?: NotificationPayload;
    };
    trigger: null;
  }) => Promise<string>;
};

function isExpoGoRuntime() {
  return Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo";
}

function getNotificationsModule(): NotificationsModule | null {
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  if (isExpoGoRuntime()) {
    notificationsModule = null;
    return notificationsModule;
  }

  try {
    const module = require("expo-notifications") as NotificationsModule;
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationsModule = module;
  } catch (error) {
    console.warn("Mobile notifications are unavailable in this runtime.", error);
    notificationsModule = null;
  }

  return notificationsModule;
}

async function ensureAndroidChannel() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Admin updates",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 150, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function configureMobileNotifications() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (configured) return;
  await ensureAndroidChannel();
  configured = true;
}

export async function ensureMobileNotificationPermissions() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return { granted: false };
  await configureMobileNotifications();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return existing;

  return Notifications.requestPermissionsAsync();
}

function shouldSuppressDuplicate(key: string) {
  const now = Date.now();
  if (lastDispatchKey === key && now - lastDispatchAt < DEDUPE_WINDOW_MS) {
    return true;
  }

  lastDispatchKey = key;
  lastDispatchAt = now;
  return false;
}

function navigateFromPayload(data: NotificationPayload | null | undefined) {
  const route = data?.route;
  if (!route) return;
  router.push(route as never);
}

export async function attachMobileNotificationResponseListener() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (listenerAttached) return;

  await configureMobileNotifications();
  listenerAttached = true;

  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse?.notification.request.content.data) {
    navigateFromPayload(lastResponse.notification.request.content.data as NotificationPayload);
  }

  responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromPayload(response.notification.request.content.data as NotificationPayload);
  });
}

export function detachMobileNotificationResponseListener() {
  responseSubscription?.remove();
  responseSubscription = null;
  listenerAttached = false;
}

async function presentLocalNotification({
  title,
  body,
  dedupeKey,
  data,
}: {
  title: string;
  body: string;
  dedupeKey: string;
  data?: NotificationPayload;
}) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (shouldSuppressDuplicate(dedupeKey)) return;

  await ensureMobileNotificationPermissions();

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data,
    },
    trigger: null,
  });
}

export async function presentAdminNotification(notification: AdminNotification) {
  const route = resolveNotificationRoute(notification.actionUrl);
  await presentLocalNotification({
    title: notification.title,
    body: notification.message,
    dedupeKey: `notification:${notification.id}`,
    data: {
      route: route ?? undefined,
      source: "notification",
      entityId: notification.id,
    },
  });
}

export async function presentSupportMessageNotification(params: {
  ticketId: number;
  messageId: number;
  senderName?: string | null;
  body?: string | null;
}) {
  const sender = params.senderName?.trim() || "Customer";
  const body = params.body?.trim() || "Sent a new support message.";

  await presentLocalNotification({
    title: `Support message from ${sender}`,
    body,
    dedupeKey: `support-message:${params.messageId}`,
    data: {
      route: `/support/${params.ticketId}`,
      source: "support",
      entityId: params.ticketId,
    },
  });
}
