import type { IncidentStatus, Priority } from "../types";

export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

export const WORKFLOW: IncidentStatus[] = [
  "submitted",
  "under_review",
  "verified",
  "assigned",
  "in_progress",
  "resolved",
];

export const OPEN_STATUSES: IncidentStatus[] = WORKFLOW.slice(0, 5);

export const STATUS_META: Record<IncidentStatus, { label: string; color: string; badge: string }> = {
  submitted: { label: "Submitted", color: "#64748b", badge: "bg-slate-100 text-slate-700 ring-slate-300" },
  under_review: { label: "Under review", color: "#d97706", badge: "bg-amber-50 text-amber-800 ring-amber-300" },
  verified: { label: "Verified", color: "#7c3aed", badge: "bg-violet-50 text-violet-800 ring-violet-300" },
  assigned: { label: "Assigned", color: "#2563eb", badge: "bg-blue-50 text-blue-800 ring-blue-300" },
  in_progress: { label: "In progress", color: "#0891b2", badge: "bg-cyan-50 text-cyan-800 ring-cyan-300" },
  resolved: { label: "Resolved", color: "#16a34a", badge: "bg-green-50 text-green-800 ring-green-300" },
  duplicate: { label: "Duplicate", color: "#9ca3af", badge: "bg-gray-100 text-gray-600 ring-gray-300" },
  rejected: { label: "Rejected", color: "#dc2626", badge: "bg-red-50 text-red-700 ring-red-300" },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  low: { label: "Low", badge: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", badge: "bg-yellow-100 text-yellow-800" },
  high: { label: "High", badge: "bg-orange-100 text-orange-800" },
  critical: { label: "Critical", badge: "bg-red-100 text-red-800" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  "water-outage": "🚱",
  "burst-pipe": "💥",
  "low-pressure": "🔽",
  "water-quality": "🧪",
  "damaged-meter": "🔧",
  sewage: "⚠️",
};

export const SA_CENTER: [number, number] = [-28.8, 25.0];

export function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}
