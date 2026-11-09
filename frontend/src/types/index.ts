export type Role = "resident" | "admin";

export type IncidentStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "duplicate"
  | "rejected";

export type Priority = "low" | "medium" | "high" | "critical";

export interface User {
  user_id: number;
  name: string;
  email: string;
  role: Role;
  province: string | null;
  municipality: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Category {
  category_id: number;
  category_name: string;
  slug: string;
}

export interface LocationInfo {
  province: string;
  municipality: string;
  suburb: string | null;
  latitude: number;
  longitude: number;
}

export interface IncidentSummary {
  incident_id: number;
  reference: string;
  title: string;
  status: IncidentStatus;
  priority: Priority;
  category: Category;
  location: LocationInfo;
  confirmation_count: number;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  has_confirmed: boolean;
}

export interface IncidentUpdate {
  update_id: number;
  previous_status: IncidentStatus | null;
  status: IncidentStatus;
  comments: string | null;
  updated_at: string;
  updated_by_name: string | null;
  updated_by_role: Role | null;
}

export interface Attachment {
  attachment_id: number;
  url: string;
  content_type: string;
  uploaded_at: string;
}

export interface IncidentDetail extends IncidentSummary {
  description: string;
  occurred_at: string | null;
  resolved_at: string | null;
  duplicate_of: number | null;
  duplicate_of_reference: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  updates: IncidentUpdate[];
  attachments: Attachment[];
  allowed_transitions: IncidentStatus[];
}

export interface IncidentPage {
  items: IncidentSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface MapIncident {
  incident_id: number;
  reference: string;
  title: string;
  status: IncidentStatus;
  category: string;
  category_slug: string;
  latitude: number;
  longitude: number;
  municipality: string;
  suburb: string | null;
  confirmation_count: number;
  created_at: string;
}

export interface Notification {
  notification_id: number;
  incident_id: number | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CountItem {
  label: string;
  count: number;
}

export interface Analytics {
  totals: {
    reported: number;
    verified: number;
    resolved: number;
    open: number;
    duplicates: number;
    rejected: number;
    community_confirmations: number;
    avg_resolution_hours: number | null;
  };
  by_category: CountItem[];
  by_status: CountItem[];
  by_municipality: CountItem[];
  daily: { date: string; reported: number; resolved: number }[];
}

export interface StaffUser {
  user_id: number;
  name: string;
  email: string;
}

export interface IncidentFilters {
  category_id?: string;
  status?: string;
  province?: string;
  municipality?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
}

export interface ConfirmationResult {
  incident_id: number;
  confirmation_count: number;
  has_confirmed: boolean;
}
