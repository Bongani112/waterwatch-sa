import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { SA_CENTER } from "../lib/constants";

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number }) => void;
}

function ClickHandler({ onChange }: Pick<Props, "onChange">) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ value }: Pick<Props, "value">) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
    // Only recenter when a new point arrives from geolocation, not on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);
  return null;
}

export function LocationPicker({ value, onChange }: Props) {
  return (
    <MapContainer center={value ? [value.lat, value.lng] : SA_CENTER} zoom={value ? 15 : 5} className="z-0 h-80 w-full rounded-xl">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onChange={onChange} />
      <Recenter value={value} />
      {value && (
        <CircleMarker
          center={[value.lat, value.lng]}
          radius={10}
          pathOptions={{ color: "#fff", weight: 3, fillColor: "#2577eb", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
