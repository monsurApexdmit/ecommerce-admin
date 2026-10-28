import { api } from "@/lib/api";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high";
export type TicketCategory = "order" | "product" | "payment" | "shipping" | "general";

export interface SupportAttachment {
  id: number;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  type?: "image" | "file" | "voice";
  isImage: boolean;
  isAudio: boolean;
}

export interface SupportMessage {
  id: number;
  ticketId: number;
  body: string | null;
  senderType: "customer" | "staff";
  senderName: string | null;
  createdAt: string;
  attachments: SupportAttachment[];
}

export interface SupportTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  customerName: string | null;
  customerEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  /** A customer wrote since staff last opened the ticket (cleared by GET /support/tickets/{id}) */
  adminUnread?: boolean;
  messages: SupportMessage[];
}

export interface TicketStats {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total: number;
  /** Tickets with a customer message staff have not opened yet */
  unread?: number;
}

export interface TicketListResult {
  data: SupportTicket[];
  total: number;
  page: number;
  perPage: number;
}

export interface SupportUploadAttachment {
  uri: string;
  name: string;
  type: string;
}

export interface SupportReplyPayload {
  body?: string;
  attachments?: SupportUploadAttachment[];
}

export async function getTickets(params?: {
  status?: TicketStatus | "all";
  priority?: TicketPriority | "all";
  search?: string;
  page?: number;
  per_page?: number;
  /** Only tickets with unread customer messages */
  unread?: boolean;
}): Promise<TicketListResult> {
  const { unread, ...rest } = params ?? {};
  const cleaned: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v && v !== "all")
  );
  if (unread) cleaned.unread = 1;
  const res = await api.get("/support/tickets", { params: cleaned });
  const d = res.data;
  return {
    data: d.data ?? [],
    total: d.meta?.total ?? d.data?.length ?? 0,
    page: d.meta?.currentPage ?? 1,
    perPage: d.meta?.perPage ?? 20,
  };
}

export async function getTicketStats(): Promise<TicketStats> {
  const res = await api.get("/support/tickets/stats");
  const d = res.data?.data ?? {};
  return {
    open: Number(d.open ?? 0),
    in_progress: Number(d.in_progress ?? 0),
    resolved: Number(d.resolved ?? 0),
    closed: Number(d.closed ?? 0),
    total: Number(d.total ?? 0),
    unread: d.unread != null ? Number(d.unread) : undefined,
  };
}

export async function getTicket(id: number): Promise<SupportTicket> {
  const res = await api.get(`/support/tickets/${id}`);
  return res.data.data;
}

function buildSupportFormData(payload: SupportReplyPayload) {
  const formData = new FormData();

  if (payload.body) {
    formData.append("body", payload.body);
  }

  payload.attachments?.forEach((attachment) => {
    formData.append("attachments[]", attachment as any);
  });

  return formData;
}

export async function replyToTicket(
  id: number,
  payload: string | SupportReplyPayload,
): Promise<SupportTicket> {
  const normalized = typeof payload === "string" ? { body: payload } : payload;
  const res = await api.post(`/support/tickets/${id}/reply`, buildSupportFormData(normalized), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

export async function updateTicketStatus(id: number, status: TicketStatus): Promise<SupportTicket> {
  const res = await api.patch(`/support/tickets/${id}/status`, { status });
  return res.data.data;
}

export async function deleteTicket(id: number): Promise<void> {
  await api.delete(`/support/tickets/${id}`);
}
