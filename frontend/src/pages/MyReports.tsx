import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBox, Spinner } from "../components/Feedback";
import { IncidentCard } from "../components/IncidentCard";
import { Pagination } from "../components/Pagination";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function MyReports() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useAsync(() => api.listIncidents({ mine: true, page, page_size: 12, sort: "updated" }), [page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My reports</h1>
          <p className="text-sm text-slate-600">Everything you've submitted, most recently updated first.</p>
        </div>
        <Link to="/report" className="btn-primary">New report</Link>
      </div>
      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Spinner />
      ) : data?.items.length === 0 ? (
        <EmptyState title="You haven't reported anything yet">
          <Link to="/report" className="font-medium text-brand-700 hover:underline">Report a water issue</Link>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.items.map((i) => <IncidentCard key={i.incident_id} incident={i} />)}
          </div>
          {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
