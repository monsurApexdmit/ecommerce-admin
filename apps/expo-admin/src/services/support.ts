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
  messages: SupportMessage[];
}

export interface TicketStats {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total: number;
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
}): Promise<TicketListResult> {
  const cleaned = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v && v !== "all")
  );
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
  return res.data.data;
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
