import { PRIORITY_META, STATUS_META } from "../lib/constants";
import type { IncidentStatus, Priority } from "../types";

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label} priority</span>;
}

export function CommunityLabel() {
  return (
    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
      Community report
    </span>
  );
}
