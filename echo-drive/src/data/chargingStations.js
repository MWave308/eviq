// src/data/chargingStations.js
//
// Charging-station locations for the Charging view's live map + "nearest
// station" navigation. A note on the three sources you asked about:
//
// 1. API Ninjas "Electric Vehicle API" (api-ninjas.com/api/electricvehicle)
//    returns EV *model* specs — make, model, range, battery size, etc. It
//    does not return charging-station locations, so it can't power this
//    section directly. It's a good fit for RangeAIView/EnergyView (real
//    manufacturer specs to compare against VEHICLE_DATA) if you add an
//    `X-Api-Key` header — see `fetchEvSpecs()` below for a ready-made,
//    opt-in hook.
//
// 2. The Kaggle "EV Charging Stations in India" and Dataful India datasets
//    are static CSV downloads, not live/CORS-enabled APIs — a browser can't
//    fetch them directly at runtime (no endpoint, and Kaggle requires auth).
//    The correct integration path: download the CSV once, run it through a
//    small script to normalize columns to the shape below, and either (a)
//    check the resulting JSON into this file, or (b) serve it from your own
//    backend/API route. This file is written in that normalized shape so
//    swapping in the real dataset later is a drop-in replacement — nothing
//    in ChargingView.jsx needs to change.
//
// Until then, this is a curated, realistic seed list around Pune (matches
// DEFAULT_ORIGIN in destinations.js) — same pattern as destinations.js: no
// API key, no billing, freely editable.

import { haversineKm } from '../utils/geo';

export const CHARGING_STATIONS = [
  {
    id: 'cs-koregaon-park',
    name: 'Koregaon Park Fast Hub',
    network: 'Tata Power EZ Charge',
    area: 'Koregaon Park, Pune',
    position: [18.5362, 73.8938],
    connectors: ['CCS2', 'Type 2'],
    powerKw: 60,
    available: 3,
    total: 4,
    score: 92,
  },
  {
    id: 'cs-magarpatta',
    name: 'Magarpatta GridLine Point',
    network: 'Statiq',
    area: 'Hadapsar, Pune',
    position: [18.5158, 73.928],
    connectors: ['CCS2'],
    powerKw: 50,
    available: 2,
    total: 4,
    score: 88,
  },
  {
    id: 'cs-hinjawadi',
    name: 'Hinjawadi IT Park Charger',
    network: 'ChargeZone',
    area: 'Hinjawadi, Pune',
    position: [18.5913, 73.7389],
    connectors: ['CCS2', 'CHAdeMO'],
    powerKw: 100,
    available: 1,
    total: 3,
    score: 90,
  },
  {
    id: 'cs-viman-nagar',
    name: 'Phoenix Marketcity Charge Point',
    network: 'Ather Grid',
    area: 'Viman Nagar, Pune',
    position: [18.5621, 73.9169],
    connectors: ['Type 2'],
    powerKw: 22,
    available: 6,
    total: 6,
    score: 84,
  },
  {
    id: 'cs-pune-airport',
    name: 'Pune Airport Supercharge',
    network: 'Tata Power EZ Charge',
    area: 'Lohegaon, Pune',
    position: [18.5822, 73.9197],
    connectors: ['CCS2'],
    powerKw: 120,
    available: 5,
    total: 8,
    score: 91,
  },
  {
    id: 'cs-shaniwar-wada',
    name: 'Old City Charge Corner',
    network: 'Statiq',
    area: 'Shaniwar Peth, Pune',
    position: [18.5205, 73.8556],
    connectors: ['Type 2'],
    powerKw: 30,
    available: 1,
    total: 2,
    score: 76,
  },
  {
    id: 'cs-baner',
    name: 'Baner Highway Hub',
    network: 'ChargeZone',
    area: 'Baner, Pune',
    position: [18.5642, 73.7769],
    connectors: ['CCS2', 'Type 2'],
    powerKw: 60,
    available: 4,
    total: 5,
    score: 87,
  },
  {
    id: 'cs-lonavala',
    name: 'Lonavala Ghat Charge Point',
    network: 'Tata Power EZ Charge',
    area: 'Lonavala',
    position: [18.7546, 73.4062],
    connectors: ['CCS2'],
    powerKw: 50,
    available: 2,
    total: 2,
    score: 82,
  },
];

/**
 * Closest distance (km) from a point to a route polyline — approximated as
 * the min distance to any vertex in `coordinates`. Good enough for OSRM
 * geometry (a vertex every few dozen metres); swap for a true point-to-
 * segment projection later if you need higher precision.
 */
function distanceToRouteKm(point, coordinates) {
  if (!coordinates || coordinates.length === 0) return Infinity;
  let min = Infinity;
  for (const c of coordinates) {
    const dist = haversineKm(point, c);
    if (dist < min) min = dist;
  }
  return min;
}

/**
 * Charging stations that sit within `maxKm` of a given route, closest first.
 * Used to answer "does this route pass a charger?" for the Route Options
 * cards and to plot charging pins along the active route in Live Journey.
 */
export function stationsAlongRoute(coordinates, { maxKm = 3, stations = CHARGING_STATIONS } = {}) {
  if (!coordinates || coordinates.length === 0) return [];
  // Large OSRM routes can carry hundreds of vertices — sample down so the
  // nearest-vertex scan above stays cheap without losing route shape.
  const sampled =
    coordinates.length > 200
      ? coordinates.filter((_, i) => i % Math.ceil(coordinates.length / 200) === 0)
      : coordinates;
  return stations
    .map((s) => ({ ...s, routeDistanceKm: distanceToRouteKm(s.position, sampled) }))
    .filter((s) => s.routeDistanceKm <= maxKm)
    .sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);
}

/**
 * Optional live augmentation: fetch real manufacturer EV specs from API
 * Ninjas. Off by default (no key baked in) — pass your own key to use it.
 * Docs: https://api-ninjas.com/api/electricvehicle
 */
export async function fetchEvSpecs(model, { apiKey, signal } = {}) {
  if (!apiKey) throw new Error('Pass an API Ninjas key to fetchEvSpecs() — see api-ninjas.com/api/electricvehicle.');
  const url = `https://api.api-ninjas.com/v1/electricvehicle?model=${encodeURIComponent(model)}`;
  const res = await fetch(url, { signal, headers: { 'X-Api-Key': apiKey } });
  if (!res.ok) throw new Error('EV spec lookup failed.');
  return res.json();
}
