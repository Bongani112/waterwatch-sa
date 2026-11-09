import { useCategories } from "../hooks/useCategories";
import { PROVINCES, STATUS_META } from "../lib/constants";
import type { IncidentFilters, IncidentStatus } from "../types";

interface Props {
  value: IncidentFilters;
  onChange: (value: IncidentFilters) => void;
  showSearch?: boolean;
  statuses?: IncidentStatus[];
}

const DEFAULT_STATUSES = Object.keys(STATUS_META).filter((s) => s !== "rejected") as IncidentStatus[];

export function Filters({ value, onChange, showSearch = true, statuses = DEFAULT_STATUSES }: Props) {
  const categories = useCategories();
  const set = (key: keyof IncidentFilters) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value || undefined });
  const active = Object.values(value).some(Boolean);

  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
      {showSearch && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="f-q">Search</label>
          <input id="f-q" className="input" placeholder="Reference, suburb, keyword…" value={value.q ?? ""} onChange={set("q")} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="f-cat">Category</label>
        <select id="f-cat" className="input" value={value.category_id ?? ""} onChange={set("category_id")}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-status">Status</label>
        <select id="f-status" className="input" value={value.status ?? ""} onChange={set("status")}>
          <option value="">All statuses</option>
          <option value="open">Open (not resolved)</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-prov">Province</label>
        <select id="f-prov" className="input" value={value.province ?? ""} onChange={set("province")}>
          <option value="">All provinces</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-muni">Municipality</label>
        <input id="f-muni" className="input" placeholder="e.g. Tshwane" value={value.municipality ?? ""} onChange={set("municipality")} />
      </div>
      <div>
        <label className="label" htmlFor="f-from">From</label>
        <input id="f-from" type="date" className="input" value={value.date_from ?? ""} onChange={set("date_from")} />
      </div>
      <div>
        <label className="label" htmlFor="f-to">To</label>
        <input id="f-to" type="date" className="input" value={value.date_to ?? ""} onChange={set("date_to")} />
      </div>
      {active && (
        <div className="flex items-end">
          <button className="btn-secondary w-full" onClick={() => onChange({})}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
