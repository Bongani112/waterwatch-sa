import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import { AdminPanel } from "../components/AdminPanel";
import { ErrorBox, Spinner } from "../components/Feedback";
import { StatusTimeline, WorkflowProgress } from "../components/StatusTimeline";
import { CommunityLabel, PriorityBadge, StatusBadge } from "../components/StatusBadge";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { CATEGORY_ICONS, STATUS_META, formatDate } from "../lib/constants";
import { api, apiUrl } from "../services/api";

export default function IncidentDetail() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const state = location.state as { justCreated?: boolean; failedPhotos?: string[] } | null;
  const { data: incident, setData, error, loading } = useAsync(() => api.getIncident(id!), [id, user?.user_id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "" });

  if (loading && !incident) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!incident) return null;

  const closed = ["resolved", "duplicate", "rejected"].includes(incident.status);
  const canConfirm = user && !incident.is_owner && !closed;
  const canEdit = incident.is_owner && incident.status === "submitted";

  async function toggleConfirm() {
    if (!incident) return;
    setBusy(true);
    setActionError(null);
    try {
      const r = incident.has_confirmed ? await api.unconfirm(incident.incident_id) : await api.confirm(incident.incident_id);
      setData({ ...incident, has_confirmed: r.has_confirmed, confirmation_count: r.confirmation_count });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!incident) return;
    setBusy(true);
    setActionError(null);
    try {
      setData(await api.editIncident(incident.incident_id, draft));
      setEditing(false);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const loc = incident.location;
  return (
    <div className="space-y-5">
      <Link to="/incidents" className="text-sm font-medium text-brand-700 hover:underline">← All incidents</Link>

      {state?.justCreated && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900" role="status">
          <p className="font-semibold">Report submitted. Your reference number is {incident.reference}.</p>
          <p>It is queued for review; you'll get a notification when its status changes.</p>
          {state.failedPhotos?.length ? <p className="mt-1 text-red-700">Some photos failed to upload: {state.failedPhotos.join("; ")}</p> : null}
        </div>
      )}
      {actionError && <ErrorBox message={actionError} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-slate-500">{incident.reference}</span>
              <StatusBadge status={incident.status} />
              <CommunityLabel />
              {isAdmin && <PriorityBadge priority={incident.priority} />}
            </div>
            {editing ? (
              <div className="space-y-3">
                <input className="input text-lg font-semibold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Title" />
                <textarea className="input" rows={5} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} aria-label="Description" />
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={saveEdit} disabled={busy}>Save</button>
                  <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">
                  <span aria-hidden>{CATEGORY_ICONS[incident.category.slug]} </span>
                  {incident.title}
                </h1>
                <p className="whitespace-pre-line text-slate-700">{incident.description}</p>
                {canEdit && (
                  <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => { setDraft({ title: incident.title, description: incident.description }); setEditing(true); }}>
                    Edit report (only possible before review)
                  </button>
                )}
              </>
            )}
            <dl className="grid gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Category</dt><dd>{incident.category.category_name}</dd></div>
              <div><dt className="text-slate-500">Area</dt><dd>{[loc.suburb, loc.municipality, loc.province].filter(Boolean).join(", ")}</dd></div>
              <div><dt className="text-slate-500">Reported</dt><dd>{formatDate(incident.created_at)}</dd></div>
              <div><dt className="text-slate-500">Last updated</dt><dd>{formatDate(incident.updated_at)}</dd></div>
              {incident.occurred_at && <div><dt className="text-slate-500">Started (per reporter)</dt><dd>{formatDate(incident.occurred_at)}</dd></div>}
              {incident.resolved_at && <div><dt className="text-slate-500">Resolved</dt><dd>{formatDate(incident.resolved_at)}</dd></div>}
              {incident.duplicate_of && (
                <div><dt className="text-slate-500">Duplicate of</dt><dd><Link className="text-brand-700 underline" to={`/incidents/${incident.duplicate_of}`}>{incident.duplicate_of_reference}</Link></dd></div>
              )}
            </dl>
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Progress</p>
              <WorkflowProgress status={incident.status} />
            </div>
          </div>

          {incident.attachments.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-1 font-semibold">Photos</h2>
              <p className="mb-3 text-xs text-slate-500">Submitted by the reporter. Photos are not proof of water quality or safety.</p>
              <div className="flex flex-wrap gap-3">
                {incident.attachments.map((a, idx) => (
                  <a key={a.attachment_id} href={apiUrl(a.url)} target="_blank" rel="noreferrer">
                    <img src={apiUrl(a.url)} alt={`Evidence photo ${idx + 1}`} className="h-32 w-32 rounded-lg object-cover ring-1 ring-slate-200 hover:ring-brand-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-4 font-semibold">History</h2>
            <StatusTimeline updates={incident.updates} />
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card space-y-3 p-5">
            <p className="text-3xl font-bold">{incident.confirmation_count}</p>
            <p className="text-sm text-slate-600">
              resident account{incident.confirmation_count === 1 ? "" : "s"} said they are also affected. Confirmations are
              self-reported, not verified household counts.
            </p>
            {canConfirm && (
              <button className={incident.has_confirmed ? "btn-secondary w-full" : "btn-primary w-full"} onClick={toggleConfirm} disabled={busy}>
                {incident.has_confirmed ? "Remove my confirmation" : "I'm experiencing this too"}
              </button>
            )}
            {!user && !closed && (
              <Link to="/login" state={{ from: location.pathname }} className="btn-secondary w-full">Sign in to confirm</Link>
            )}
            {incident.is_owner && <p className="text-xs text-slate-500">You reported this incident.</p>}
            {closed && <p className="text-xs text-slate-500">This incident is closed ({STATUS_META[incident.status].label.toLowerCase()}).</p>}
          </div>

          <div className="card overflow-hidden p-1">
            <MapContainer center={[loc.latitude, loc.longitude]} zoom={15} className="z-0 h-56 w-full rounded-lg" scrollWheelZoom={false}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <CircleMarker center={[loc.latitude, loc.longitude]} radius={10} pathOptions={{ color: "#fff", weight: 2, fillColor: STATUS_META[incident.status].color, fillOpacity: 0.9 }} />
            </MapContainer>
          </div>

          {isAdmin && <AdminPanel incident={incident} onChange={setData} />}
        </aside>
      </div>
    </div>
  );
}
