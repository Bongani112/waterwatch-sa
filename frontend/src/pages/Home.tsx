import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { IncidentCard } from "../components/IncidentCard";
import { OPEN_STATUSES } from "../lib/constants";

export default function Home() {
  const { user } = useAuth();
  const recent = useAsync(() => api.listIncidents({ page_size: 4, sort: "updated" }), []);
  const open = useAsync(() => api.listIncidents({ page_size: 1, statuses: OPEN_STATUSES }), []);
  const resolved = useAsync(() => api.listIncidents({ page_size: 1, statuses: ["resolved"] }), []);

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-12 text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Report · Track · Resolve</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">Community water outage &amp; infrastructure reporting</h1>
        <p className="mt-4 max-w-2xl text-brand-100">
          Report outages, burst pipes, low pressure and water-quality concerns in a few steps. Follow each incident from
          submission to resolution, and confirm problems your neighbours have already reported instead of filing duplicates.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={user ? "/report" : "/register"} className="btn bg-white text-brand-800 hover:bg-brand-50">
            Report an issue
          </Link>
          <Link to="/incidents" className="btn border border-brand-300 text-white hover:bg-brand-600">
            View incident map
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open incidents" value={open.data?.total} />
        <Stat label="Resolved incidents" value={resolved.data?.total} />
        <div className="card p-5">
          <p className="text-sm text-slate-500">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Report with a map pin and optional photo</li>
            <li>Admins review, verify and assign</li>
            <li>Get notified until it's resolved</li>
          </ol>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recently updated</h2>
          <Link to="/incidents" className="text-sm font-medium text-brand-700 hover:underline">
            See all incidents →
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {recent.data?.items.map((i) => <IncidentCard key={i.incident_id} incident={i} />)}
        </div>
      </section>

      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">Official channels &amp; emergencies</h2>
          <p className="mt-2 text-sm text-slate-600">
            WaterWatch SA does not replace your municipality's fault-reporting line. Please also log faults with your
            municipality so they reach their operational systems. For life-threatening emergencies call <strong>112</strong> (from a
            mobile) or <strong>10177</strong> (ambulance and fire).
          </p>
        </div>
        <div>
          <h2 className="font-semibold">About community information</h2>
          <p className="mt-2 text-sm text-slate-600">
            Reports are submitted by residents and are clearly labelled as such. Confirmations show how many accounts say
            they are affected; they are not verified household counts. Nothing on this site certifies water as safe or unsafe.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value ?? "—"}</p>
    </div>
  );
}
