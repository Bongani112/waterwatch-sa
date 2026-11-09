import { Link } from "react-router-dom";
import { CATEGORY_ICONS, timeAgo } from "../lib/constants";
import type { IncidentSummary } from "../types";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

export function IncidentCard({ incident, showPriority = false }: { incident: IncidentSummary; showPriority?: boolean }) {
  const { location } = incident;
  return (
    <Link
      to={`/incidents/${incident.incident_id}`}
      className="card block p-4 transition hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{incident.reference}</span>
        <div className="flex items-center gap-2">
          {showPriority && <PriorityBadge priority={incident.priority} />}
          <StatusBadge status={incident.status} />
        </div>
      </div>
      <h3 className="mt-2 font-semibold text-slate-900">
        <span aria-hidden>{CATEGORY_ICONS[incident.category.slug]} </span>
        {incident.title}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        {incident.category.category_name} · {[location.suburb, location.municipality].filter(Boolean).join(", ")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Reported {timeAgo(incident.created_at)}</span>
        <span>Updated {timeAgo(incident.updated_at)}</span>
        <span>
          {incident.confirmation_count} confirmation{incident.confirmation_count === 1 ? "" : "s"}
        </span>
        {incident.is_owner && <span className="font-medium text-brand-700">Your report</span>}
        {incident.has_confirmed && <span className="font-medium text-brand-700">You confirmed</span>}
      </div>
    </Link>
  );
}
