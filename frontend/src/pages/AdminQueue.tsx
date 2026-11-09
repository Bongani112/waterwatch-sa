import { useMemo, useState } from "react";
import { EmptyState, ErrorBox, Spinner } from "../components/Feedback";
import { Filters } from "../components/Filters";
import { IncidentCard } from "../components/IncidentCard";
import { Pagination } from "../components/Pagination";
import { useAsync } from "../hooks/useAsync";
import { toListParams } from "../lib/filters";
import { api } from "../services/api";
import type { IncidentFilters, IncidentStatus } from "../types";

const TABS: { key: string; label: string; statuses?: IncidentStatus[] }[] = [
  { key: "new", label: "New", statuses: ["submitted"] },
  { key: "review", label: "Under review", statuses: ["under_review"] },
  { key: "active", label: "Verified / assigned / in progress", statuses: ["verified", "assigned", "in_progress"] },
  { key: "closed", label: "Closed", statuses: ["resolved", "duplicate", "rejected"] },
  { key: "all", label: "All" },
];

export default function AdminQueue() {
  const [tab, setTab] = useState("new");
  const [filters, setFilters] = useState<IncidentFilters>({});
  const [page, setPage] = useState(1);
  const params = useMemo(() => {
    const p = toListParams(filters);
    const tabStatuses = TABS.find((t) => t.key === tab)?.statuses;
    return { ...p, statuses: p.statuses ?? tabStatuses };
  }, [filters, tab]);
  const key = JSON.stringify(params);
  const { data, error, loading } = useAsync(
    () => api.listIncidents({ ...params, page, page_size: 15, sort: tab === "new" ? "oldest" : "updated" }),
    [key, page],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Review queue</h1>
        <p className="text-sm text-slate-600">Review new reports, check for duplicates, assign and publish updates.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"}`}
            onClick={() => { setTab(t.key); setPage(1); setFilters({ ...filters, status: undefined }); }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Filters value={filters} onChange={(f) => { setFilters(f); setPage(1); }} statuses={TABS.find((t) => t.key === tab)?.statuses} />
      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Spinner />
      ) : data?.items.length === 0 ? (
        <EmptyState title="Nothing here">The queue is clear for this view.</EmptyState>
      ) : (
        <>
          <p className="text-sm text-slate-600">{data?.total} incident(s){tab === "new" && " - oldest first"}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.items.map((i) => <IncidentCard key={i.incident_id} incident={i} showPriority />)}
          </div>
          {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
