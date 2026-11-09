import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorBox, Spinner } from "../components/Feedback";
import { Filters } from "../components/Filters";
import { IncidentCard } from "../components/IncidentCard";
import { IncidentMap } from "../components/IncidentMap";
import { MapLegend } from "../components/MapLegend";
import { Pagination } from "../components/Pagination";
import { useAsync } from "../hooks/useAsync";
import { toListParams } from "../lib/filters";
import { api } from "../services/api";
import type { IncidentFilters } from "../types";

const FILTER_KEYS: (keyof IncidentFilters)[] = ["category_id", "status", "province", "municipality", "q", "date_from", "date_to"];

export default function Incidents() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "map";
  const page = Number(params.get("page") ?? 1);
  const filters = useMemo(() => {
    const f: IncidentFilters = {};
    FILTER_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) f[k] = v;
    });
    return f;
  }, [params]);

  // Debounce free-text filters so typing doesn't fire a request per keystroke.
  const [debounced, setDebounced] = useState(filters);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);
  const key = JSON.stringify(debounced);

  const list = useAsync(() => api.listIncidents({ ...toListParams(debounced), page, page_size: 12 }), [key, page]);
  const map = useAsync(() => api.mapIncidents(toListParams(debounced)), [key]);

  function update(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  }

  function setFilters(f: IncidentFilters) {
    const next: Record<string, string | undefined> = { page: undefined };
    FILTER_KEYS.forEach((k) => (next[k] = f[k]));
    update(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-sm text-slate-600">Community-submitted water reports and their latest status.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="tablist">
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              onClick={() => update({ view: v === "map" ? undefined : v })}
            >
              {v === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
      </div>

      <Filters value={filters} onChange={setFilters} showSearch={view === "list"} />

      {view === "map" ? (
        <div className="space-y-3">
          {map.error && <ErrorBox message={map.error} />}
          <div className="card relative overflow-hidden p-1">
            <IncidentMap incidents={map.data ?? []} />
            {map.loading && <div className="absolute right-3 top-3 z-[500] rounded bg-white px-2 py-1 text-xs shadow">Loading…</div>}
          </div>
          <MapLegend />
          <p className="text-sm text-slate-600">{map.data?.length ?? 0} incident(s) shown on the map.</p>
        </div>
      ) : (
        <div>
          {list.error && <ErrorBox message={list.error} />}
          {list.loading && !list.data ? (
            <Spinner />
          ) : list.data && list.data.items.length === 0 ? (
            <EmptyState title="No incidents match these filters">Try widening the date range or clearing filters.</EmptyState>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">{list.data?.total ?? 0} incident(s)</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.data?.items.map((i) => <IncidentCard key={i.incident_id} incident={i} />)}
              </div>
              {list.data && (
                <Pagination page={page} pageSize={list.data.page_size} total={list.data.total} onPage={(p) => update({ page: String(p) })} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
