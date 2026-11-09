import { useNavigate } from "react-router-dom";
import { EmptyState, ErrorBox, Spinner } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { formatDate } from "../lib/constants";
import { api } from "../services/api";
import type { Notification } from "../types";

export default function Notifications() {
  const navigate = useNavigate();
  const { data, setData, error, loading } = useAsync(() => api.notifications(), []);

  async function open(n: Notification) {
    if (!n.is_read && data) {
      await api.markRead(n.notification_id).catch(() => undefined);
      setData({
        items: data.items.map((i) => (i.notification_id === n.notification_id ? { ...i, is_read: true } : i)),
        unread_count: Math.max(0, data.unread_count - 1),
      });
      window.dispatchEvent(new Event("waterwatch:notifications"));
    }
    if (n.incident_id) navigate(`/incidents/${n.incident_id}`);
  }

  async function readAll() {
    if (!data) return;
    await api.markAllRead();
    setData({ items: data.items.map((i) => ({ ...i, is_read: true })), unread_count: 0 });
    window.dispatchEvent(new Event("waterwatch:notifications"));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {data && data.unread_count > 0 && (
          <button className="btn-secondary" onClick={readAll}>Mark all as read</button>
        )}
      </div>
      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Spinner />
      ) : data?.items.length === 0 ? (
        <EmptyState title="No notifications yet">You'll be notified when reports you submitted or confirmed are updated.</EmptyState>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {data?.items.map((n) => (
            <li key={n.notification_id}>
              <button onClick={() => open(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.is_read ? "" : "bg-brand-50/60"}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${n.is_read ? "bg-transparent" : "bg-brand-600"}`} aria-hidden />
                <span className="flex-1">
                  <span className={`block text-sm ${n.is_read ? "text-slate-700" : "font-medium text-slate-900"}`}>{n.message}</span>
                  <span className="text-xs text-slate-500">
                    {formatDate(n.created_at)}
                    {!n.is_read && <span className="sr-only"> (unread)</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
