import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorBox } from "../components/Feedback";
import { LocationPicker } from "../components/LocationPicker";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { useCategories } from "../hooks/useCategories";
import { CATEGORY_ICONS, OPEN_STATUSES, PROVINCES, timeAgo } from "../lib/constants";
import { api } from "../services/api";
import type { IncidentSummary } from "../types";

const STEPS = ["Category", "Details", "Location", "Photo & review"];
const MAX_PHOTOS = 3;
const MAX_MB = 5;

export default function ReportIncident() {
  const { user } = useAuth();
  const categories = useCategories();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [province, setProvince] = useState(user?.province ?? "");
  const [municipality, setMunicipality] = useState(user?.municipality ?? "");
  const [suburb, setSuburb] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [nearby, setNearby] = useState<IncidentSummary[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());

  const category = categories.find((c) => c.category_id === categoryId);

  // Duplicate control: show open incidents of the same category within 1 km of the pin.
  useEffect(() => {
    if (!point || !categoryId) return;
    const t = window.setTimeout(() => {
      api
        .listIncidents({ lat: point.lat, lng: point.lng, radius_km: 1, category_id: String(categoryId), statuses: OPEN_STATUSES, page_size: 5 })
        .then((r) => setNearby(r.items.filter((i) => !i.is_owner)))
        .catch(() => setNearby([]));
    }, 400);
    return () => window.clearTimeout(t);
  }, [point, categoryId]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access. Tap the map instead.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => {
        setError("Could not get your location. Tap the map to place a pin instead.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setError(`${f.name}: only JPEG, PNG or WebP images are allowed.`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`${f.name}: photos must be under ${MAX_MB} MB.`);
        continue;
      }
      if (next.length < MAX_PHOTOS) next.push(f);
    }
    setPhotos(next);
  }

  async function confirmExisting(id: number) {
    try {
      await api.confirm(id);
      setConfirmedIds(new Set(confirmedIds).add(id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function stepError(): string | null {
    if (step === 0 && !categoryId) return "Choose a category.";
    if (step === 1) {
      if (title.trim().length < 5) return "Give the report a short title (at least 5 characters).";
      if (description.trim().length < 10) return "Describe the issue (at least 10 characters).";
    }
    if (step === 2) {
      if (!point) return "Place a pin on the map or use your current location.";
      if (!province) return "Choose a province.";
      if (municipality.trim().length < 2) return "Enter the municipality.";
    }
    return null;
  }

  function next() {
    const msg = stepError();
    setError(msg);
    if (!msg) setStep((s) => s + 1);
  }

  async function submit() {
    if (!categoryId || !point) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createIncident({
        category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
        location: { province, municipality: municipality.trim(), suburb: suburb.trim() || null, latitude: point.lat, longitude: point.lng },
      });
      const failed: string[] = [];
      for (const photo of photos) {
        try {
          await api.uploadAttachment(created.incident_id, photo);
        } catch (err) {
          failed.push(`${photo.name}: ${(err as Error).message}`);
        }
      }
      navigate(`/incidents/${created.incident_id}`, { state: { justCreated: true, failedPhotos: failed } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Report a water issue</h1>
        <p className="text-sm text-slate-600">
          For emergencies call 112. Please also report faults to your municipality.
        </p>
      </div>

      <ol className="grid grid-cols-4 gap-2 text-xs sm:text-sm" aria-label="Report steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded-lg border px-2 py-2 text-center font-medium ${i === step ? "border-brand-600 bg-brand-50 text-brand-800" : i < step ? "border-green-300 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-500"}`} aria-current={i === step ? "step" : undefined}>
            <span className="hidden sm:inline">{i + 1}. </span>
            {s}
          </li>
        ))}
      </ol>

      {error && <ErrorBox message={error} />}

      <div className="card p-5">
        {step === 0 && (
          <fieldset>
            <legend className="mb-3 font-semibold">What kind of issue is it?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.category_id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${categoryId === c.category_id ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-200 hover:border-brand-300"}`}>
                  <input type="radio" name="category" className="sr-only" checked={categoryId === c.category_id} onChange={() => setCategoryId(c.category_id)} />
                  <span className="text-2xl" aria-hidden>{CATEGORY_ICONS[c.slug]}</span>
                  <span className="font-medium">{c.category_name}</span>
                </label>
              ))}
            </div>
            {category?.slug === "water-quality" && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Community reports cannot confirm whether water is safe. If you suspect contamination, follow your
                municipality's guidance and consider boiling water until an official update is issued.
              </p>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="title">Short title</label>
              <input id="title" className="input" maxLength={140} placeholder="e.g. No water on Vilakazi Street since 6am" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="desc">Description</label>
              <textarea id="desc" rows={5} maxLength={4000} className="input" placeholder="What is happening, how many homes seem affected, any landmarks…" value={description} onChange={(e) => setDescription(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Do not include phone numbers, ID numbers or your exact home address.</p>
            </div>
            <div className="sm:w-1/2">
              <label className="label" htmlFor="when">When did it start? (optional)</label>
              <input id="when" type="datetime-local" className="input" max={new Date().toISOString().slice(0, 16)} value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-700">Tap the map to place a pin near the problem, or use your location.</p>
              <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={geoBusy}>
                {geoBusy ? "Locating…" : "Use my current location"}
              </button>
            </div>
            <LocationPicker value={point} onChange={setPoint} />
            {point && <p className="text-xs text-slate-500">Pin: {point.lat.toFixed(5)}, {point.lng.toFixed(5)} (shown publicly to about 100 m)</p>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="prov">Province</label>
                <select id="prov" className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
                  <option value="">Choose…</option>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="muni">Municipality</label>
                <input id="muni" className="input" placeholder="e.g. City of Tshwane" value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="suburb">Suburb / area</label>
                <input id="suburb" className="input" placeholder="e.g. Mamelodi" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
              </div>
            </div>
            {nearby.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">Is it one of these? Similar open reports within 1 km</p>
                <p className="mb-3 text-sm text-amber-800">Confirming an existing report helps admins more than a duplicate.</p>
                <ul className="space-y-2">
                  {nearby.map((i) => (
                    <li key={i.incident_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white p-3 text-sm">
                      <div>
                        <Link to={`/incidents/${i.incident_id}`} target="_blank" className="font-medium text-brand-700 hover:underline">{i.reference}: {i.title}</Link>
                        <p className="text-xs text-slate-500">{i.location.suburb ?? i.location.municipality} · {timeAgo(i.created_at)} · {i.confirmation_count} confirmations</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={i.status} />
                        {i.has_confirmed || confirmedIds.has(i.incident_id) ? (
                          <span className="text-xs font-medium text-green-700">Confirmed ✓</span>
                        ) : (
                          <button className="btn-secondary px-3 py-1 text-xs" onClick={() => confirmExisting(i.incident_id)}>I'm affected too</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="photos">Photos (optional, up to {MAX_PHOTOS}, max {MAX_MB} MB each)</label>
              <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photos.length >= MAX_PHOTOS} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-medium file:text-brand-700" />
              {photos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {photos.map((p, idx) => (
                    <li key={idx} className="relative">
                      <img src={URL.createObjectURL(p)} alt={`Selected photo ${idx + 1}`} className="h-24 w-24 rounded-lg object-cover" />
                      <button className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white" onClick={() => setPhotos(photos.filter((_, i) => i !== idx))} aria-label={`Remove photo ${idx + 1}`}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <h2 className="mb-2 font-semibold">Review your report</h2>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[140px_1fr]">
                <dt className="text-slate-500">Category</dt><dd>{category?.category_name}</dd>
                <dt className="text-slate-500">Title</dt><dd>{title}</dd>
                <dt className="text-slate-500">Description</dt><dd className="whitespace-pre-line">{description}</dd>
                <dt className="text-slate-500">Location</dt><dd>{[suburb, municipality, province].filter(Boolean).join(", ")}</dd>
                {occurredAt && (<><dt className="text-slate-500">Started</dt><dd>{new Date(occurredAt).toLocaleString("en-ZA")}</dd></>)}
              </dl>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button className="btn-secondary" onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={step === 0 || busy}>Back</button>
        {step < STEPS.length - 1 ? (
          <button className="btn-primary" onClick={next}>Continue</button>
        ) : (
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
        )}
      </div>
    </div>
  );
}
