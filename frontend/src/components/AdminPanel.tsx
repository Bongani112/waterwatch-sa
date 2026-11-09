import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { PRIORITY_META, STATUS_META, timeAgo } from "../lib/constants";
import { api } from "../services/api";
import type { IncidentDetail, IncidentStatus, Priority } from "../types";
import { ErrorBox } from "./Feedback";
import { StatusBadge } from "./StatusBadge";

interface Props {
  incident: IncidentDetail;
  onChange: (incident: IncidentDetail) => void;
}

export function AdminPanel({ incident, onChange }: Props) {
  const staff = useAsync(() => api.staff(), []);
  const similar = useAsync(
    () =>
      api.listIncidents({
        lat: incident.location.latitude,
        lng: incident.location.longitude,
        radius_km: 1,
        category_id: String(incident.category.category_id),
        page_size: 6,
      }),
    [incident.incident_id],
  );
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [comments, setComments] = useState("");
  const [assignee, setAssignee] = useState<string>(incident.assigned_to ? String(incident.assigned_to) : "");
  const [duplicateOf, setDuplicateOf] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setStatus("");
    setComments("");
    setDuplicateOf(null);
    setAssignee(incident.assigned_to ? String(incident.assigned_to) : "");
  }, [incident.incident_id, incident.status, incident.assigned_to]);

  const candidates = (similar.data?.items ?? []).filter(
    (i) => i.incident_id !== incident.incident_id && i.status !== "duplicate",
  );
  const assigneeChanged = assignee !== "" && Number(assignee) !== incident.assigned_to;

  async function run(action: () => Promise<IncidentDetail>, message: string) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      onChange(await action());
      setSaved(message);
      window.dispatchEvent(new Event("waterwatch:notifications"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function publish() {
    run(
      () =>
        api.addUpdate(incident.incident_id, {
          status: status || undefined,
          comments: comments.trim() || undefined,
          assigned_to: assigneeChanged ? Number(assignee) : undefined,
          duplicate_of: status === "duplicate" && duplicateOf ? duplicateOf : undefined,
        }),
      "Update published and followers notified.",
    );
  }

  const canPublish = Boolean(status || comments.trim() || assigneeChanged) && !(status === "duplicate" && !duplicateOf);

  return (
    <div className="card space-y-4 border-brand-200 p-5">
      <h2 className="font-semibold">Administrator</h2>
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="text-xs uppercase text-slate-500">Reporter (private)</p>
        <p>{incident.reporter_name}</p>
        <p className="text-slate-600">{incident.reporter_email}</p>
        <p className="mt-1 text-xs text-slate-500">Exact pin: {incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}</p>
      </div>

      {error && <ErrorBox message={error} />}
      {saved && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{saved}</p>}

      <div>
        <label className="label" htmlFor="priority">Priority</label>
        <select
          id="priority"
          className="input"
          value={incident.priority}
          disabled={busy}
          onChange={(e) => run(() => api.editIncident(incident.incident_id, { priority: e.target.value as Priority }), "Priority updated.")}
        >
          {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_META[p].label}</option>
          ))}
        </select>
      </div>

      {incident.allowed_transitions.length > 0 ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium">Publish an update</p>
          <div>
            <label className="label" htmlFor="new-status">Change status</label>
            <select id="new-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}>
              <option value="">No status change (comment only)</option>
              {incident.allowed_transitions.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="assignee">Assigned to {status === "assigned" && <span className="text-red-600">*</span>}</label>
            <select id="assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {staff.data?.map((s) => (
                <option key={s.user_id} value={s.user_id}>{s.name}</option>
              ))}
            </select>
          </div>
          {status === "duplicate" && (
            <div>
              <p className="label">Original incident</p>
              {candidates.length === 0 ? (
                <p className="text-sm text-slate-500">No similar incidents within 1 km.</p>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((c) => (
                    <li key={c.incident_id}>
                      <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${duplicateOf === c.incident_id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                        <input type="radio" name="dup" checked={duplicateOf === c.incident_id} onChange={() => setDuplicateOf(c.incident_id)} className="mt-1" />
                        <span>
                          <span className="font-mono text-xs">{c.reference}</span> {c.title}
                          <span className="block text-xs text-slate-500">{STATUS_META[c.status].label} · {timeAgo(c.created_at)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div>
            <label className="label" htmlFor="comments">Comment (visible to the public)</label>
            <textarea
              id="comments"
              rows={3}
              className="input"
              placeholder={status === "" ? "e.g. Could you clarify which street is affected?" : "e.g. Repair team dispatched; expected by 4pm."}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy || !canPublish} onClick={publish}>
            {busy ? "Publishing…" : "Publish update"}
          </button>
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">This incident is closed; no further status changes.</p>
      )}

      {candidates.length > 0 && status !== "duplicate" && (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-medium">Possible duplicates (same category, within 1 km)</p>
          <ul className="space-y-2 text-sm">
            {candidates.map((c) => (
              <li key={c.incident_id} className="flex items-center justify-between gap-2">
                <Link to={`/incidents/${c.incident_id}`} className="truncate text-brand-700 hover:underline">{c.reference} · {c.title}</Link>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
