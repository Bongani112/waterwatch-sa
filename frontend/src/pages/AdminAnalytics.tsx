import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorBox, Spinner } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { PROVINCES, STATUS_META } from "../lib/constants";
import { api } from "../services/api";
import type { IncidentStatus } from "../types";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: (width: number) => ReactNode }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <div className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div ref={ref} className="mt-4 h-72 w-full">{width > 0 && children(width)}</div>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string | number; hint: string; accent: string }) {
  return (
    <div className="card border-l-4 p-4" style={{ borderLeftColor: accent }}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [province, setProvince] = useState("");
  const { data, error, loading } = useAsync(() => api.analytics(days, province || undefined), [days, province]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-slate-600">Incidents created in the selected period. Rejected reports are excluded from "reported".</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={province} onChange={(e) => setProvince(e.target.value)} aria-label="Province">
            <option value="">All provinces</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Reported" value={data.totals.reported} hint="Community reports (unverified)" accent="#64748b" />
            <Kpi label="Verified" value={data.totals.verified} hint="Checked by an admin (incl. later stages)" accent="#7c3aed" />
            <Kpi label="Resolved" value={data.totals.resolved} hint={`${data.totals.open} still open`} accent="#16a34a" />
            <Kpi
              label="Avg. time to resolve"
              value={data.totals.avg_resolution_hours == null ? "—" : data.totals.avg_resolution_hours >= 48 ? `${(data.totals.avg_resolution_hours / 24).toFixed(1)} d` : `${data.totals.avg_resolution_hours} h`}
              hint="Submission → resolved"
              accent="#2577eb"
            />
          </div>
          <p className="text-xs text-slate-500">
            {data.totals.duplicates} duplicate(s), {data.totals.rejected} rejected, {data.totals.community_confirmations} community confirmation(s). Confirmations are self-reported and not household counts.
          </p>

          <ChartCard title="Reported vs resolved per day" subtitle="Africa/Johannesburg dates">
            {(width) => (
              <LineChart width={width} height={288} data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={12} minTickGap={20} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reported" name="Reported" stroke="#2577eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ChartCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="By category">
              {(width) => (
                <BarChart width={width} height={288} data={data.by_category} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="label" width={150} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" name="Incidents" fill="#2577eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ChartCard>
            <ChartCard title="By current status">
              {(width) => (
                <PieChart width={width} height={288}>
                  <Pie data={data.by_status.map((s) => ({ ...s, name: STATUS_META[s.label as IncidentStatus].label }))} dataKey="count" nameKey="name" outerRadius={100} label>
                    {data.by_status.map((s) => <Cell key={s.label} fill={STATUS_META[s.label as IncidentStatus].color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              )}
            </ChartCard>
          </div>

          <ChartCard title="Top municipalities">
            {(width) => (
              <BarChart width={width} height={288} data={data.by_municipality}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={12} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="Incidents" fill="#1e4faf" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
