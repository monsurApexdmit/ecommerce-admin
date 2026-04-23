import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { SupportMessage, SupportTicket, TicketPriority, TicketStatus } from "@/lib/supportApi";
import { getCompanyId } from "@/lib/utils/apiInterceptor";

const REVERB_ENABLED = process.env.NEXT_PUBLIC_REVERB_ENABLED === "true";
const REVERB_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY || "local-app-key";
const REVERB_SCHEME = (process.env.NEXT_PUBLIC_REVERB_SCHEME || "http") as "http" | "https";
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST || (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1");
const REVERB_PORT = Number(process.env.NEXT_PUBLIC_REVERB_PORT || (REVERB_SCHEME === "https" ? 443 : 8080));

let echo: any = null;

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

type TicketHandlers = {
  onMessageSent?: (ticketId: number, message: SupportMessage) => void;
  onStatusUpdated?: (ticketId: number, status: TicketStatus) => void;
  onPriorityUpdated?: (ticketId: number, priority: TicketPriority) => void;
};

type CompanyHandlers = {
  onTicketCreated?: (ticket: SupportTicket) => void;
  onMessageSent?: (ticketId: number, message: SupportMessage) => void;
  onStatusUpdated?: (ticketId: number, status: TicketStatus) => void;
  onPriorityUpdated?: (ticketId: number, priority: TicketPriority) => void;
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getSupportEcho() {
  if (typeof window === "undefined") return null;
  if (!REVERB_ENABLED) return null;

  if (!echo) {
    window.Pusher = Pusher;

    echo = new Echo({
      broadcaster: "reverb",
      key: REVERB_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_SCHEME === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: "/api/proxy/realtime/auth",
      auth: {
        headers: getAuthHeaders(),
        params: {
          company_id: getCompanyId(),
        },
      },
    });
  } else {
    echo.connector.options.auth = {
      headers: getAuthHeaders(),
      params: {
        company_id: getCompanyId(),
      },
    };
  }

  return echo;
}

export function subscribeToSupportTicket(ticketId: number, handlers: TicketHandlers): () => void {
  const client = getSupportEcho();
  if (!client) return () => {};

  const channel = client.private(`support.ticket.${ticketId}`);

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
    client.leave(`support.ticket.${ticketId}`);
  };
}

export function subscribeToSupportCompany(companyId: number, handlers: CompanyHandlers): () => void {
  const client = getSupportEcho();
  if (!client) return () => {};

  const channel = client.private(`support.company.${companyId}`);

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
    client.leave(`support.company.${companyId}`);
  };
}
