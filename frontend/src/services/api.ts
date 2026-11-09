import type {
  Analytics,
  Category,
  ConfirmationResult,
  IncidentDetail,
  IncidentFilters,
  IncidentPage,
  IncidentStatus,
  MapIncident,
  Notification,
  Priority,
  StaffUser,
  TokenResponse,
  User,
} from "../types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "waterwatch.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.append(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail
        .map((d: { loc?: (string | number)[]; msg?: string }) => {
          const field = d.loc?.filter((p) => p !== "body").join(".");
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .join("; ");
    }
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const res = await fetch(apiUrl(path), { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event("waterwatch:logout"));
    }
    throw new ApiError(res.status, errorMessage(body, `Request failed (${res.status})`));
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export interface NewIncident {
  category_id: number;
  title: string;
  description: string;
  occurred_at?: string | null;
  location: {
    province: string;
    municipality: string;
    suburb?: string | null;
    latitude: number;
    longitude: number;
  };
}

export interface ListParams extends IncidentFilters {
  page?: number;
  page_size?: number;
  mine?: boolean;
  sort?: "newest" | "oldest" | "updated";
  lat?: number;
  lng?: number;
  radius_km?: number;
  statuses?: IncidentStatus[];
}

function listQuery({ statuses, status, ...rest }: ListParams) {
  return toQuery({ ...rest, status: statuses ?? (status ? [status] : undefined) });
}

export const api = {
  register: (data: { name: string; email: string; password: string; province?: string; municipality?: string }) =>
    request<TokenResponse>("/api/auth/register", { method: "POST", body: json(data) }),
  login: (email: string, password: string) =>
    request<TokenResponse>("/api/auth/login", { method: "POST", body: json({ email, password }) }),
  me: () => request<User>("/api/auth/me"),

  categories: () => request<Category[]>("/api/categories"),

  listIncidents: (params: ListParams) => request<IncidentPage>(`/api/incidents${listQuery(params)}`),
  mapIncidents: (params: ListParams) => request<MapIncident[]>(`/api/map/incidents${listQuery(params)}`),
  getIncident: (id: number | string) => request<IncidentDetail>(`/api/incidents/${id}`),
  createIncident: (data: NewIncident) =>
    request<IncidentDetail>("/api/incidents", { method: "POST", body: json(data) }),
  editIncident: (
    id: number,
    data: Partial<{ title: string; description: string; priority: Priority; assigned_to: number | null }>,
  ) => request<IncidentDetail>(`/api/incidents/${id}`, { method: "PATCH", body: json(data) }),
  uploadAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<IncidentDetail>(`/api/incidents/${id}/attachments`, { method: "POST", body: form });
  },
  confirm: (id: number) => request<ConfirmationResult>(`/api/incidents/${id}/confirm`, { method: "POST" }),
  unconfirm: (id: number) => request<ConfirmationResult>(`/api/incidents/${id}/confirm`, { method: "DELETE" }),
  addUpdate: (
    id: number,
    data: { status?: IncidentStatus; comments?: string; duplicate_of?: number; assigned_to?: number },
  ) => request<IncidentDetail>(`/api/incidents/${id}/updates`, { method: "POST", body: json(data) }),

  notifications: () => request<{ items: Notification[]; unread_count: number }>("/api/notifications"),
  unreadCount: () => request<{ unread_count: number }>("/api/notifications/unread-count"),
  markRead: (id: number) => request<Notification>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<{ unread_count: number }>("/api/notifications/read-all", { method: "POST" }),

  staff: () => request<StaffUser[]>("/api/admin/users"),
  analytics: (days: number, province?: string) =>
    request<Analytics>(`/api/admin/analytics${toQuery({ days, province })}`),
};
