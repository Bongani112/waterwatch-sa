import { STATUS_META, WORKFLOW, formatDate } from "../lib/constants";
import type { IncidentStatus, IncidentUpdate } from "../types";

export function WorkflowProgress({ status }: { status: IncidentStatus }) {
  const closedOff = status === "duplicate" || status === "rejected";
  const current = WORKFLOW.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-xs" aria-label="Incident progress">
      {WORKFLOW.map((s, i) => {
        const done = !closedOff && i <= current;
        return (
          <li key={s} className="flex items-center">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${done ? "text-white" : "bg-slate-100 text-slate-500"}`}
              style={done ? { backgroundColor: STATUS_META[s].color } : undefined}
              aria-current={i === current ? "step" : undefined}
            >
              {STATUS_META[s].label}
            </span>
            {i < WORKFLOW.length - 1 && <span className={`mx-1 h-0.5 w-4 ${done && i < current ? "bg-slate-400" : "bg-slate-200"}`} aria-hidden />}
          </li>
        );
      })}
      {closedOff && (
        <li className="ml-2 rounded-full px-2.5 py-1 font-medium text-white" style={{ backgroundColor: STATUS_META[status].color }}>
          Closed as {STATUS_META[status].label.toLowerCase()}
        </li>
      )}
    </ol>
  );
}

export function StatusTimeline({ updates }: { updates: IncidentUpdate[] }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6">
      {[...updates].reverse().map((u) => {
        const changed = u.previous_status && u.previous_status !== u.status;
        const meta = STATUS_META[u.status];
        const source =
          u.updated_by_role === "admin"
            ? `Official update${u.updated_by_name ? ` by ${u.updated_by_name}` : " by WaterWatch admin"}`
            : "Community (resident)";
        return (
          <li key={u.update_id} className="relative">
            <span
              className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            <p className="text-sm font-medium text-slate-900">
              {changed ? (
                <>
                  {STATUS_META[u.previous_status!].label} → {meta.label}
                </>
              ) : u.update_id === updates[0]?.update_id ? (
                "Report submitted"
              ) : (
                "Update posted"
              )}
            </p>
            {u.comments && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{u.comments}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {source} · {formatDate(u.updated_at)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
