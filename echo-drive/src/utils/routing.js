// src/utils/routing.js
//
// Free, keyless routing + location search for the Route / Live Journey screen.
//
// ROUTING — OSRM (Open Source Routing Machine)
//   https://project-osrm.org · https://github.com/Project-OSRM/osrm-backend
//   We call OSRM's free public demo server, which needs no API key, no
//   billing account, and no credit card. It's the same class of engine
//   described in the Valhalla brief (a self-hosted turn-by-turn router over
//   OpenStreetMap data) and returns real alternative routes, distances,
//   durations and turn-by-turn steps.
//
//   ⚠️ FALLBACK NOTE — the public demo server (router.project-osrm.org) is
//   community-run, unauthenticated and rate-limited. Under heavy traffic it
//   can return 429s or time out. `fetchRoutes` throws in that case, and
//   every caller (RouteView, ChargingView) already catches that and falls
//   back to a straight-line haversine estimate so the UI never hard-fails.
//   To move to your own self-hosted router later (OSRM or Valhalla) — the
//   recommended fix for production traffic — just point OSRM_BASE at your
//   server. Everything downstream (energy/battery/traffic estimation, map
//   rendering, turn-by-turn steps) already works off the normalized shape
//   returned by `fetchRoutes`, so only this one constant changes.
//
// GEOCODING / AUTOCOMPLETE — Nominatim (OpenStreetMap)
//   https://nominatim.org — free, keyless, community-run.
//
// Everything below the fetch calls (energy, battery %, traffic, road
// character, scoring) is a client-side AI heuristic layered on top of the
// real routing data — there's no paid "AI routing" service involved.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

const ROUTE_COLORS = ['#33e6ff', '#9b7cff', '#ffb238', '#46e0a0'];

// ---------------------------------------------------------------------------
// Turn-by-turn instructions — built from OSRM's `steps=true` maneuver data.
// ---------------------------------------------------------------------------

const MODIFIER_LABEL = {
  uturn: 'Make a U-turn',
  'sharp right': 'Turn sharp right',
  'sharp left': 'Turn sharp left',
  right: 'Turn right',
  left: 'Turn left',
  'slight right': 'Bear slight right',
  'slight left': 'Bear slight left',
  straight: 'Continue straight',
};

/** Human-readable instruction text for a single OSRM maneuver step. */
function instructionText(step) {
  const m = step.maneuver || {};
  const roadName = step.name && step.name.trim() ? step.name.trim() : 'the road';

  if (m.type === 'depart') return `Head out on ${roadName}`;
  if (m.type === 'arrive') return m.modifier === 'left' ? 'Arrive — destination is on your left'
    : m.modifier === 'right' ? 'Arrive — destination is on your right'
    : 'Arrive at your destination';
  if (m.type === 'roundabout' || m.type === 'rotary') {
    const exit = m.exit ? ` (${m.exit}${m.exit === 1 ? 'st' : m.exit === 2 ? 'nd' : m.exit === 3 ? 'rd' : 'th'} exit)` : '';
    return `Enter the roundabout${exit} onto ${roadName}`;
  }
  if (m.type === 'merge') return `Merge onto ${roadName}`;
  if (m.type === 'fork') return `${MODIFIER_LABEL[m.modifier] || 'Bear'} at the fork onto ${roadName}`;
  if (m.type === 'end of road') return `${MODIFIER_LABEL[m.modifier] || 'Turn'} at the end of the road onto ${roadName}`;
  if (m.type === 'new name') return `Continue onto ${roadName}`;

  const label = MODIFIER_LABEL[m.modifier] || 'Continue';
  return `${label} onto ${roadName}`;
}

/** Icon key consumed by <RouteInstructions> — kept separate from text so UI can render lucide icons. */
function maneuverIconKey(step) {
  const m = step.maneuver || {};
  if (m.type === 'depart') return 'depart';
  if (m.type === 'arrive') return 'arrive';
  if (m.type === 'roundabout' || m.type === 'rotary') return 'roundabout';
  if (m.type === 'uturn' || m.modifier === 'uturn') return 'uturn';
  if (m.modifier === 'sharp left' || m.modifier === 'left') return 'left';
  if (m.modifier === 'slight left') return 'slight-left';
  if (m.modifier === 'sharp right' || m.modifier === 'right') return 'right';
  if (m.modifier === 'slight right') return 'slight-right';
  return 'straight';
}

/** Normalize one leg's raw OSRM steps into the shape <RouteInstructions> expects. */
function normalizeSteps(legs) {
  const steps = (legs || []).flatMap((leg) => leg.steps || []);
  return steps.map((s, i) => ({
    id: i,
    icon: maneuverIconKey(s),
    instruction: instructionText(s),
    roadName: s.name && s.name.trim() ? s.name.trim() : null,
    distanceM: s.distance ?? 0,
    durationS: s.duration ?? 0,
    position: s.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : null,
  }));
}

/** Free-text location search (autocomplete) via Nominatim. */
export async function geocodeSearch(query, { limit = 5, signal } = {}) {
  const q = query.trim();
  if (!q) return [];
  const url = `${NOMINATIM_BASE}?format=jsonv2&q=${encodeURIComponent(q)}&limit=${limit}&addressdetails=1`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Location search is unavailable right now.');
  const data = await res.json();
  return data.map((item) => ({
    id: `osm-${item.place_id}`,
    name: (item.name && item.name.trim()) || item.display_name.split(',')[0],
    area: item.display_name.split(',').slice(1, 3).join(',').trim() || 'Location',
    position: [parseFloat(item.lat), parseFloat(item.lon)],
  }));
}

/** Reverse-geocode a lat/lng into a short label (used for "current location"). */
export async function reverseGeocode([lat, lon], { signal } = {}) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  const addr = data.address || {};
  return addr.road || addr.suburb || addr.neighbourhood || addr.village || data.display_name?.split(',')[0] || 'Current Location';
}

/**
 * Fetch real alternative routes between two [lat, lng] points from OSRM.
 * Pass `via` (a [lat, lng]) to route through a middle waypoint — this is
 * what powers interactive "drag the route" rerouting (see FreeMap's
 * `onRouteDrag`): alternatives are disabled once a via point is set, since
 * OSRM only returns alternatives for simple two-point trips.
 * Returns a normalized array (empty-safe): [{ id, coordinates, distanceKm,
 * durationMin, avgSpeedKmh, turnCount, turnsPerKm, steps }]
 */
export async function fetchRoutes(start, end, { signal, profile = 'driving', via = null } = {}) {
  const points = via ? [start, via, end] : [start, end];
  const coords = points.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const alternatives = via ? 'false' : 'true';
  const url = `${OSRM_BASE}/${profile}/${coords}?alternatives=${alternatives}&overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Routing service is unavailable right now.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route could be found between these points.');

  return data.routes.map((r, idx) => {
    const coordinates = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const distanceKm = r.distance / 1000;
    const durationMin = r.duration / 60;
    const avgSpeedKmh = durationMin > 0 ? distanceKm / (durationMin / 60) : 0;
    const steps = normalizeSteps(r.legs);
    const turnCount = steps.filter((s) => !['depart', 'arrive'].includes(s.icon)).length;
    return {
      id: String.fromCharCode(65 + idx), // A, B, C…
      color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
      coordinates,
      distanceKm,
      durationMin,
      avgSpeedKmh,
      turnCount,
      turnsPerKm: distanceKm > 0 ? turnCount / distanceKm : 0,
      steps,
      hasVia: !!via,
    };
  });
}

// ---------------------------------------------------------------------------
// AI-side estimation heuristics — layered on top of real OSRM route data.
// ---------------------------------------------------------------------------

function parseRateKmPerKwh(rateLabel) {
  const n = parseFloat(rateLabel);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

// EVs are most efficient in a moderate speed band; efficiency falls off at
// low speed (stop-start driving, motor heat) and at high speed (aero drag).
function speedEfficiencyFactor(avgSpeedKmh) {
  if (avgSpeedKmh <= 0) return 1;
  const optimal = 52;
  const diff = Math.abs(avgSpeedKmh - optimal);
  const penalty = avgSpeedKmh > optimal ? diff * 0.012 : diff * 0.007;
  return Math.min(1.4, Math.max(0.78, 1 + penalty));
}

export function estimateRouteEnergy(vehicleData, route) {
  const baseRate = parseRateKmPerKwh(vehicleData.energy.rate);
  const factor = speedEfficiencyFactor(route.avgSpeedKmh);
  const effectiveRate = baseRate / factor;
  return { kWh: route.distanceKm / effectiveRate, effectiveRate };
}

/** Approximate total pack capacity (kWh) from the mock telemetry already on screen. */
export function estimateBatteryCapacityKwh(vehicleData) {
  const rate = parseRateKmPerKwh(vehicleData.energy.rate);
  const soc = vehicleData.range.soc / 100;
  if (soc <= 0) return null;
  return vehicleData.range.current / rate / soc;
}

export function trafficImpact(avgSpeedKmh) {
  if (avgSpeedKmh >= 40) return { label: 'Light', tone: 'text-green' };
  if (avgSpeedKmh >= 22) return { label: 'Moderate', tone: 'text-amber' };
  return { label: 'Heavy', tone: 'text-red' };
}

export function roadCharacter(route) {
  const tpk = route.turnsPerKm;
  if (tpk < 0.45) return 'Highway-dominant · few turns';
  if (tpk < 1.4) return 'Mixed arterial roads';
  return 'Dense urban streets';
}

function scoreRoutes(rawRoutes, energyList) {
  const kWhVals = energyList.map((e) => e.kWh);
  const durVals = rawRoutes.map((r) => r.durationMin);
  const maxKwh = Math.max(...kWhVals), minKwh = Math.min(...kWhVals);
  const maxDur = Math.max(...durVals), minDur = Math.min(...durVals);
  return rawRoutes.map((r, i) => {
    const effScore = maxKwh === minKwh ? 100 : 100 * (1 - (kWhVals[i] - minKwh) / (maxKwh - minKwh));
    const durScore = maxDur === minDur ? 100 : 100 * (1 - (durVals[i] - minDur) / (maxDur - minDur));
    return Math.round(effScore * 0.55 + durScore * 0.45);
  });
}

function tagRoutes(rawRoutes, energyList) {
  const fastestIdx = rawRoutes.reduce((best, r, i) => (r.durationMin < rawRoutes[best].durationMin ? i : best), 0);
  const efficientIdx = energyList.reduce((best, e, i) => (e.kWh < energyList[best].kWh ? i : best), 0);
  return rawRoutes.map((r, i) => {
    let tag = 'ALTERNATE';
    if (i === efficientIdx && i === fastestIdx) tag = 'AI OPTIMAL';
    else if (i === efficientIdx) tag = 'MAX EFFICIENCY';
    else if (i === fastestIdx) tag = 'FASTEST';
    else if (i === 0) tag = 'AI OPTIMAL';
    return { ...r, tag };
  });
}

/** Turns raw OSRM routes into fully AI-annotated route options ready for display. */
export function buildRouteOptions(vehicleData, rawRoutes) {
  const energyList = rawRoutes.map((r) => estimateRouteEnergy(vehicleData, r));
  const scores = scoreRoutes(rawRoutes, energyList);
  const tagged = tagRoutes(rawRoutes, energyList);
  const batteryCapacity = estimateBatteryCapacityKwh(vehicleData);

  return tagged.map((r, i) => {
    const kWh = energyList[i].kWh;
    const batteryPct = batteryCapacity ? Math.min(100, (kWh / batteryCapacity) * 100) : null;
    return {
      ...r,
      score: scores[i],
      energyKwh: kWh,
      batteryPct,
      traffic: trafficImpact(r.avgSpeedKmh),
      character: roadCharacter(r),
    };
  });
}
