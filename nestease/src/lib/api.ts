import { supabaseBrowser } from "./supabase-browser";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      await supabaseBrowser.auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json;
}

export const api = {
  // Work orders
  listWorkOrders: (pmId: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ pm_id: pmId, ...filters });
    return apiFetch<{ data: unknown[] }>(`/api/work-orders?${params}`);
  },

  getWorkOrder: (id: string) =>
    apiFetch<{ data: unknown }>(`/api/work-orders/${id}`),

  createWorkOrder: (body: Record<string, unknown>) =>
    apiFetch<{ data: unknown }>("/api/work-orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Transitions
  transition: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ data: unknown }>(`/api/work-orders/${id}/transition`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Quote
  submitQuote: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ data: unknown }>(`/api/work-orders/${id}/quote`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Completion report
  submitCompletionReport: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ data: unknown }>(`/api/work-orders/${id}/completion-report`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // PM actions
  sendApprovalRequest: (id: string) =>
    apiFetch<{ success: boolean; results: string[]; approve_url: string; pdf_url: string }>(`/api/work-orders/${id}/send-approval`, {
      method: "POST",
      body: "{}",
    }),

  sendArchiveReport: (id: string) =>
    apiFetch<{ success: boolean; pdf_url: string }>(`/api/work-orders/${id}/send-archive`, {
      method: "POST",
      body: "{}",
    }),

  // Contractors
  listContractors: (filters?: Record<string, string>) => {
    const params = filters ? new URLSearchParams(filters) : "";
    return apiFetch<{ data: unknown[] }>(`/api/contractors${params ? `?${params}` : ""}`);
  },

  getContractor: (id: string) =>
    apiFetch<{ data: unknown }>(`/api/contractors/${id}`),

  createContractor: (body: { name: string; phone: string; specialties: string[] }) =>
    apiFetch<{ data: unknown }>("/api/contractors", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateContractor: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ data: unknown }>(`/api/contractors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  rateContractor: (id: string, body: Record<string, unknown>) =>
    apiFetch<{ data: unknown }>(`/api/contractors/${id}/rate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listContractorNotes: (id: string) =>
    apiFetch<{ data: unknown[] }>(`/api/contractors/${id}/notes`),

  createContractorNote: (id: string, content: string) =>
    apiFetch<{ data: unknown }>(`/api/contractors/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  updateContractorNote: (id: string, noteId: string, content: string) =>
    apiFetch<{ data: unknown }>(`/api/contractors/${id}/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  deleteContractorNote: (id: string, noteId: string) =>
    apiFetch<{ data: unknown }>(`/api/contractors/${id}/notes/${noteId}`, {
      method: "DELETE",
    }),

  // Agent
  listAgentSessions: () =>
    apiFetch<{ data: unknown[] }>("/api/agent/sessions"),

  getAgentSession: (sessionId: string, workOrderId?: string) =>
    apiFetch<{ data: unknown }>(`/api/agent/sessions/${sessionId}${workOrderId ? `?work_order_id=${workOrderId}` : ""}`),

  getAgentSessionByContractor: (contractorId: string, pmId: string) =>
    apiFetch<{ data: unknown[] }>(`/api/agent/sessions?contractor_id=${contractorId}&pm_id=${pmId}`),

  // PM Agent Config
  getAgentConfig: () =>
    apiFetch<{ data: { id: string; agent_name: string; agent_avatar: string | null; agent_tone: string } }>("/api/pm/agent-config"),

  updateAgentConfig: (body: { agent_name?: string; agent_avatar?: string | null; agent_tone?: string }) =>
    apiFetch<{ data: unknown }>("/api/pm/agent-config", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
