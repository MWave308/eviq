// Small, dependency-free geo helpers used by the map/destination selector.

export function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatKm(km) {
  if (km == null || Number.isNaN(km)) return '—';
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatMin(min) {
  if (min == null || Number.isNaN(min)) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatKwh(kwh) {
  if (kwh == null || Number.isNaN(kwh)) return '—';
  return `${kwh < 1 ? kwh.toFixed(2) : kwh.toFixed(1)} kWh`;
}

export function formatPct(pct) {
  if (pct == null || Number.isNaN(pct)) return '—';
  return `${Math.round(pct)}%`;
}
