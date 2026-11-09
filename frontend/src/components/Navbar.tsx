import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-700 text-white" : "text-brand-50 hover:bg-brand-600"}`;

export function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const load = () => api.unreadCount().then((r) => setUnread(r.unread_count)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener("waterwatch:notifications", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("waterwatch:notifications", load);
    };
  }, [user, location.pathname]);

  const links = (
    <>
      <NavLink to="/incidents" className={linkClass}>
        Incidents &amp; map
      </NavLink>
      {user && (
        <NavLink to="/report" className={linkClass}>
          Report an issue
        </NavLink>
      )}
      {user && (
        <NavLink to="/my-reports" className={linkClass}>
          My reports
        </NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" end className={linkClass}>
          Review queue
        </NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin/analytics" className={linkClass}>
          Analytics
        </NavLink>
      )}
    </>
  );

  return (
    <header className="bg-brand-800 text-white shadow">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-brand-300" aria-hidden>
            <path d="M12 2.5c-.3 0-.6.2-.8.4C9.4 5.3 5 11 5 14.5a7 7 0 0 0 14 0c0-3.5-4.4-9.2-6.2-11.6a1 1 0 0 0-.8-.4Z" />
          </svg>
          WaterWatch <span className="text-brand-300">SA</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">{links}</div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/notifications"
                className="relative rounded-full p-2 hover:bg-brand-600"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-xs font-bold">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <span className="hidden text-sm text-brand-100 lg:inline">
                {user.name}
                {isAdmin && <span className="ml-1 rounded bg-brand-600 px-1.5 py-0.5 text-xs">Admin</span>}
              </span>
              <button
                className="hidden rounded-md px-3 py-2 text-sm hover:bg-brand-600 md:block"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="hidden gap-2 md:flex">
              <Link to="/login" className="rounded-md px-3 py-2 text-sm hover:bg-brand-600">
                Sign in
              </Link>
              <Link to="/register" className="rounded-md bg-white px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50">
                Create account
              </Link>
            </div>
          )}
          <button className="rounded-md p-2 hover:bg-brand-600 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <div className="flex flex-col gap-1 border-t border-brand-700 px-4 py-3 md:hidden">
          {links}
          {user ? (
            <button className="rounded-md px-3 py-2 text-left text-sm hover:bg-brand-600" onClick={() => { logout(); navigate("/"); }}>
              Sign out
            </button>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>Sign in</NavLink>
              <NavLink to="/register" className={linkClass}>Create account</NavLink>
            </>
          )}
        </div>
      )}
    </header>
  );
}
