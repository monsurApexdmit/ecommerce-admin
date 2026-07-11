import { api, getApiSession } from "@/lib/api";
import type {
  SupportMessage,
  SupportTicket,
  TicketPriority,
  TicketStatus,
} from "@/services/support";
import type { Notification } from "@/services/notifications";

type NotificationHandlers = {
  onCreated?: (notification: Notification, unreadCount: number) => void;
  onUpdated?: (action: "read" | "unread", notification: Notification, unreadCount: number) => void;
  onReadAll?: (notificationIds: number[], unreadCount: number) => void;
  onDeleted?: (action: "delete" | "bulk_delete", notificationIds: number[], unreadCount: number) => void;
};

type SupportTicketHandlers = {
  onMessageSent?: (ticketId: number, message: SupportMessage) => void;
  onStatusUpdated?: (ticketId: number, status: TicketStatus) => void;
  onPriorityUpdated?: (ticketId: number, priority: TicketPriority) => void;
};

type SupportCompanyHandlers = {
  onTicketCreated?: (ticket: SupportTicket) => void;
  onMessageSent?: (ticketId: number, message: SupportMessage) => void;
  onStatusUpdated?: (ticketId: number, status: TicketStatus) => void;
  onPriorityUpdated?: (ticketId: number, priority: TicketPriority) => void;
};

let echo: any = null;
let reverbUnavailable = false;

type EchoConstructor = new (options: Record<string, unknown>) => any;
type PusherConstructor = new (key: string, options: Record<string, unknown>) => unknown;

function getEnv(name: string, legacyName?: string) {
  const value = process.env[name];
  if (value != null && value !== "") {
    return value;
  }

  if (legacyName) {
    const legacyValue = process.env[legacyName];
    if (legacyValue != null && legacyValue !== "") {
      return legacyValue;
    }
  }

  return undefined;
}

function getApiRoot() {
  const baseURL = api.defaults.baseURL ?? "";
  return baseURL.replace(/\/api\/?$/, "");
}

function getDefaultHost() {
  const apiRoot = getApiRoot();

  try {
    return new URL(apiRoot).hostname;
  } catch {
    return "127.0.0.1";
  }
}

function getDefaultScheme() {
  const apiRoot = getApiRoot();

  try {
    return new URL(apiRoot).protocol.replace(":", "") as "http" | "https";
  } catch {
    return "http";
  }
}

function getAuthEndpoint() {
  return getEnv("EXPO_PUBLIC_REVERB_AUTH_ENDPOINT") || `${getApiRoot()}/realtime/auth`;
}

function getReverbOptions() {
  const session = getApiSession();
  const scheme = (getEnv("EXPO_PUBLIC_REVERB_SCHEME", "NEXT_PUBLIC_REVERB_SCHEME") || getDefaultScheme()) as "http" | "https";
  const port = Number(getEnv("EXPO_PUBLIC_REVERB_PORT", "NEXT_PUBLIC_REVERB_PORT") || (scheme === "https" ? 443 : 8080));
  const authHeaders: Record<string, string> = {};
  const authParams: Record<string, string | number> = {};

  if (session?.token) {
    authHeaders.Authorization = `Bearer ${session.token}`;
  }

  if (session?.companyId) {
    authParams.company_id = session.companyId;
  }

  return {
    broadcaster: "reverb" as const,
    key: getEnv("EXPO_PUBLIC_REVERB_APP_KEY", "NEXT_PUBLIC_REVERB_APP_KEY") || "local-app-key",
    wsHost: getEnv("EXPO_PUBLIC_REVERB_HOST", "NEXT_PUBLIC_REVERB_HOST") || getDefaultHost(),
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"] as ("ws" | "wss")[],
    authEndpoint: getAuthEndpoint(),
    auth: {
      headers: authHeaders,
      params: authParams,
    },
  };
}

export function getReverbEcho() {
  const enabled = getEnv("EXPO_PUBLIC_REVERB_ENABLED", "NEXT_PUBLIC_REVERB_ENABLED") === "true";
  const session = getApiSession();

  if (!enabled || !session?.token || !session.companyId || reverbUnavailable) {
    return null;
  }

  try {
    const EchoModule = require("laravel-echo") as { default?: EchoConstructor };
    const PusherModule = require("pusher-js/react-native") as {
      default?: PusherConstructor;
      Pusher?: PusherConstructor;
    };
    const Echo = EchoModule.default ?? (EchoModule as unknown as EchoConstructor);
    const Pusher =
      PusherModule.Pusher ??
      PusherModule.default ??
      (PusherModule as unknown as PusherConstructor);

    (globalThis as typeof globalThis & { Pusher?: PusherConstructor }).Pusher = Pusher;

    if (!echo) {
      echo = new Echo({
        ...getReverbOptions(),
        Pusher,
      });
    } else {
      echo.connector.options = {
        ...echo.connector.options,
        ...getReverbOptions(),
        Pusher,
      };
    }
  } catch (error) {
    reverbUnavailable = true;
    console.warn("Reverb is unavailable in this Expo runtime.", error);
    return null;
  }

  return echo;
}

export function disconnectReverb() {
  if (!echo) return;

  try {
    echo.disconnect();
  } finally {
    echo = null;
  }
}

export function subscribeToNotifications(companyId: number, handlers: NotificationHandlers): () => void {
  const client = getReverbEcho();
  if (!client) return () => {};

  const channelName = `notifications.company.${companyId}`;
  const channel = client.private(channelName);

  if (handlers.onCreated) {
    channel.listen(".notification.created", (event: { notification: Notification; unreadCount: number }) => {
      handlers.onCreated?.(event.notification, event.unreadCount);
    });
  }

  if (handlers.onUpdated) {
    channel.listen(".notification.updated", (event: {
      action: "read" | "unread";
      notification: Notification;
      unreadCount: number;
    }) => {
      handlers.onUpdated?.(event.action, event.notification, event.unreadCount);
    });
  }

  if (handlers.onReadAll) {
    channel.listen(".notifications.read_all", (event: { notificationIds: number[]; unreadCount: number }) => {
      handlers.onReadAll?.(event.notificationIds, event.unreadCount);
    });
  }

  if (handlers.onDeleted) {
    channel.listen(".notification.deleted", (event: {
      action: "delete" | "bulk_delete";
      notificationIds: number[];
      unreadCount: number;
    }) => {
      handlers.onDeleted?.(event.action, event.notificationIds, event.unreadCount);
    });
  }

  return () => {
    client.leave(channelName);
  };
}

export function subscribeToSupportTicket(ticketId: number, handlers: SupportTicketHandlers): () => void {
  const client = getReverbEcho();
  if (!client) return () => {};

  const channelName = `support.ticket.${ticketId}`;
  const channel = client.private(channelName);

  if (handlers.onMessageSent) {
    channel.listen(".support.ticket.message.sent", (event: { ticketId: number; message: SupportMessage }) => {
      handlers.onMessageSent?.(event.ticketId, event.message);
    });
  }

  if (handlers.onStatusUpdated) {
    channel.listen(".support.ticket.status.updated", (event: { ticketId: number; status: TicketStatus }) => {
      handlers.onStatusUpdated?.(event.ticketId, event.status);
    });
  }

  if (handlers.onPriorityUpdated) {
    channel.listen(".support.ticket.priority.updated", (event: { ticketId: number; priority: TicketPriority }) => {
      handlers.onPriorityUpdated?.(event.ticketId, event.priority);
    });
  }

  return () => {
    client.leave(channelName);
  };
}

export function subscribeToSupportCompany(companyId: number, handlers: SupportCompanyHandlers): () => void {
  const client = getReverbEcho();
  if (!client) return () => {};

  const channelName = `support.company.${companyId}`;
  const channel = client.private(channelName);

  if (handlers.onTicketCreated) {
    channel.listen(".support.ticket.created", (event: { ticket: SupportTicket }) => {
      handlers.onTicketCreated?.(event.ticket);
    });
  }

  if (handlers.onMessageSent) {
    channel.listen(".support.ticket.message.sent", (event: { ticketId: number; message: SupportMessage }) => {
      handlers.onMessageSent?.(event.ticketId, event.message);
    });
  }

  if (handlers.onStatusUpdated) {
    channel.listen(".support.ticket.status.updated", (event: { ticketId: number; status: TicketStatus }) => {
      handlers.onStatusUpdated?.(event.ticketId, event.status);
    });
  }

  if (handlers.onPriorityUpdated) {
    channel.listen(".support.ticket.priority.updated", (event: { ticketId: number; priority: TicketPriority }) => {
      handlers.onPriorityUpdated?.(event.ticketId, event.priority);
    });
  }

  return () => {
    client.leave(channelName);
  };
}
