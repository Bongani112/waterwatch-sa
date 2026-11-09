import { STATUS_META } from "../lib/constants";
import type { IncidentStatus } from "../types";

const SHOWN: IncidentStatus[] = ["submitted", "under_review", "verified", "assigned", "in_progress", "resolved", "duplicate"];

export function MapLegend() {
  return (
    <div className="card p-3 text-xs" aria-label="Map legend">
      <p className="mb-2 font-semibold text-slate-700">Legend: marker colour = status</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 lg:grid-cols-7">
        {SHOWN.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-white shadow" style={{ backgroundColor: STATUS_META[s].color }} aria-hidden />
            {STATUS_META[s].label}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-slate-500">Positions are approximate (about 100 m) to protect reporters' privacy.</p>
    </div>
  );
}
