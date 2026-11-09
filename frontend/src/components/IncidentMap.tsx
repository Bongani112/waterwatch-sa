import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import { CATEGORY_ICONS, SA_CENTER, STATUS_META, timeAgo } from "../lib/constants";
import type { MapIncident } from "../types";

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
  }, [map, points]);
  return null;
}

export function IncidentMap({ incidents, height = "520px" }: { incidents: MapIncident[]; height?: string }) {
  const points = incidents.map((i) => [i.latitude, i.longitude] as [number, number]);
  return (
    <MapContainer center={SA_CENTER} zoom={5} style={{ height }} className="z-0 w-full rounded-xl" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {incidents.map((i) => {
        const meta = STATUS_META[i.status];
        return (
          <CircleMarker
            key={i.incident_id}
            center={[i.latitude, i.longitude]}
            radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: meta.color, fillOpacity: 0.9 }}
          >
            <Tooltip>
              {i.category} · {meta.label}
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-mono text-xs text-slate-500">{i.reference}</p>
                <p className="font-semibold">
                  {CATEGORY_ICONS[i.category_slug]} {i.title}
                </p>
                <p>
                  Status: <strong>{meta.label}</strong>
                </p>
                <p className="text-slate-600">
                  {[i.suburb, i.municipality].filter(Boolean).join(", ")} · {timeAgo(i.created_at)}
                </p>
                <p className="text-slate-600">{i.confirmation_count} community confirmation(s)</p>
                <Link to={`/incidents/${i.incident_id}`} className="font-medium text-brand-700 underline">
                  View details
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
