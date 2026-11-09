import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorBox } from "../components/Feedback";
import { useAuth } from "../hooks/useAuth";
import { PROVINCES } from "../lib/constants";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", province: "", municipality: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        province: form.province || undefined,
        municipality: form.municipality || undefined,
      });
      navigate("/report");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <h1 className="text-xl font-bold">Create a resident account</h1>
          <p className="mt-1 text-sm text-slate-600">Your name and email are never shown publicly.</p>
        </div>
        {error && <ErrorBox message={error} />}
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" required minLength={2} className="input" value={form.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={form.email} onChange={set("email")} autoComplete="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={8} className="input" value={form.password} onChange={set("password")} autoComplete="new-password" />
            <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" required className="input" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
          </div>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="label col-span-full">Your area (optional)</legend>
          <select className="input" value={form.province} onChange={set("province")} aria-label="Province">
            <option value="">Province…</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input className="input" placeholder="Municipality" value={form.municipality} onChange={set("municipality")} aria-label="Municipality" />
        </fieldset>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
