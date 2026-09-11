import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  MapPin, Flag, BatteryCharging, Search, X, Navigation2, AlertTriangle, CheckCircle2, List, RotateCcw,
} from 'lucide-react';
import FreeMap from '../components/FreeMap';
import Panel from '../components/Panel';
import RouteInstructions from '../components/RouteInstructions';
import { VEHICLE_DATA } from '../data/vehicleData';
import { DESTINATIONS, DEFAULT_ORIGIN } from '../data/destinations';
import { stationsAlongRoute } from '../data/chargingStations';
import { haversineKm, formatKm, formatMin, formatKwh, formatPct } from '../utils/geo';
import { geocodeSearch, reverseGeocode, fetchRoutes, buildRouteOptions } from '../utils/routing';
import { useAppContext } from '../context/AppContext';
import './views.css';
import './RouteView.css';

// Assumed average urban speed used only when live routing is unreachable
// and we fall back to a straight-line distance estimate.
const OFFLINE_AVG_SPEED_KMH = 32;

const d = VEHICLE_DATA;
const mockRoute = d.route.options.find((r) => r.id === 'A');

function pointFromDestination(loc) {
  return { name: loc.name, area: loc.area, position: loc.position };
}

/** Shared search input + suggestions dropdown for the start / destination fields. */
function LocationField({
  icon, placeholder, query, onQueryChange, open, onOpenChange,
  results, loading, onPick, onClear, hasPoint, refFor, showUseLocation, onUseLocation, locating,
}) {
  return (
    <div className="location-field" ref={refFor}>
      {icon}
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => { onQueryChange(e.target.value); onOpenChange(true); }}
        onFocus={() => onOpenChange(true)}
      />
      {loading && <span className="spinner-ring" />}
      {showUseLocation && (
        <button
          type="button"
          className="location-use-btn"
          onClick={onUseLocation}
          disabled={locating}
          title="Use my current location"
        >
          {locating ? <span className="spinner-ring" /> : <Navigation2 size={12} />}
          <span className="location-use-label">{locating ? 'Locating…' : 'Use Current'}</span>
        </button>
      )}
      {hasPoint && (
        <button type="button" className="location-clear-btn" onClick={onClear} title="Clear">
          <X size={12} />
        </button>
      )}

      {open && (
        <div className="destination-dropdown glass-strong">
          {results.length === 0 && !loading && (
            <div className="destination-empty">
              {query.trim() ? 'No matches — try a different search, or tap the map.' : 'Start typing, or tap the map to drop a pin.'}
            </div>
          )}
          {results.map((loc) => (
            <button key={loc.id} type="button" className="destination-option" onClick={() => onPick(loc)}>
              <MapPin size={13} className="text-violet" />
              <span className="destination-option-text">
                <span className="destination-option-name">{loc.name}</span>
                <span className="destination-option-area">{loc.area}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RouteView() {
  const { activeRoute, setActiveRoute } = useAppContext();

  // ---- start / destination point state ----
  const [origin, setOrigin] = useState({ query: DEFAULT_ORIGIN.name, point: pointFromDestination(DEFAULT_ORIGIN) });
  const [destination, setDestination] = useState({ query: '', point: null });
  const [openField, setOpenField] = useState(null); // 'start' | 'dest' | null
  const [locating, setLocating] = useState(false);

  // ---- live geocode suggestions (debounced) ----
  const [geoResults, setGeoResults] = useState({ start: [], dest: [] });
  const [geoLoading, setGeoLoading] = useState({ start: false, dest: false });
  const debounceRef = useRef({});
  const abortRef = useRef({});

  const startWrapRef = useRef(null);
  const destWrapRef = useRef(null);

  // ---- route search state ----
  const [routes, setRoutes] = useState(null); // null = not searched yet (fallback UI)
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle'); // idle | loading | ready | offline | error
  const [routeError, setRouteError] = useState(null);
  const routeAbortRef = useRef(null);

  // Via-point set by dragging the active route line on the map (mirrors
  // Leaflet Routing Machine's `routeWhileDragging`) — routing through it
  // re-fetches a single, non-alternative route from OSRM.
  const [viaPoint, setViaPoint] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const curatedMatches = useCallback((query) => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((loc) => loc.name.toLowerCase().includes(q) || loc.area.toLowerCase().includes(q));
  }, []);

  // Debounced live search (Nominatim) merged with the curated offline list.
  function runSearch(field, query) {
    window.clearTimeout(debounceRef.current[field]);
    abortRef.current[field]?.abort();

    const curated = curatedMatches(query);
    setGeoResults((prev) => ({ ...prev, [field]: curated }));

    const q = query.trim();
    if (q.length < 3) {
      setGeoLoading((prev) => ({ ...prev, [field]: false }));
      return;
    }

    debounceRef.current[field] = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current[field] = controller;
      setGeoLoading((prev) => ({ ...prev, [field]: true }));
      try {
        const live = await geocodeSearch(q, { signal: controller.signal, limit: 5 });
        const seen = new Set(curated.map((c) => c.name.toLowerCase()));
        const merged = [...curated, ...live.filter((l) => !seen.has(l.name.toLowerCase()))];
        setGeoResults((prev) => ({ ...prev, [field]: merged }));
      } catch {
        // Network/geocoder unavailable — curated matches (already set) still work.
      } finally {
        setGeoLoading((prev) => ({ ...prev, [field]: false }));
      }
    }, 380);
  }

  useEffect(() => {
    function onDocClick(e) {
      if (
        openField === 'start' && startWrapRef.current && !startWrapRef.current.contains(e.target)
      ) setOpenField(null);
      if (
        openField === 'dest' && destWrapRef.current && !destWrapRef.current.contains(e.target)
      ) setOpenField(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openField]);

  function pickOrigin(loc) {
    setOrigin({ query: loc.name, point: pointFromDestination(loc) });
    setOpenField(null);
  }
  function pickDestination(loc) {
    setDestination({ query: loc.name, point: pointFromDestination(loc) });
    setOpenField(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setRouteError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const position = [pos.coords.latitude, pos.coords.longitude];
        setOrigin({ query: 'Current Location', point: { name: 'Current Location', area: 'Live GPS position', position } });
        try {
          const label = await reverseGeocode(position);
          setOrigin({ query: label, point: { name: label, area: 'Live GPS position', position } });
        } catch {
          // Keep the generic "Current Location" label if reverse geocoding fails.
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setRouteError('Could not get your current location — check location permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleMapPoint(latlng) {
    setDestination({ query: 'Dropped Pin', point: { name: 'Dropped Pin', area: 'Custom location', position: latlng } });
    setOpenField(null);
  }
  function handleDrag(latlng) {
    setDestination((prev) => (prev.point ? { ...prev, point: { ...prev.point, position: latlng } } : prev));
  }

  function clearOrigin() { setOrigin({ query: '', point: null }); }
  function clearDestination() { setDestination({ query: '', point: null }); setRoutes(null); setRouteStatus('idle'); setViaPoint(null); }

  function swapPoints() {
    setOrigin({ query: destination.query, point: destination.point });
    setDestination({ query: origin.query, point: origin.point });
    setRoutes(null);
    setRouteStatus('idle');
    setViaPoint(null);
  }

  async function findRoutes(via = null) {
    if (!origin.point || !destination.point) {
      setRouteError('Set both a start location and a destination first.');
      return;
    }
    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;

    setRouteStatus('loading');
    setRouteError(null);
    setOpenField(null);

    try {
      const raw = await fetchRoutes(origin.point.position, destination.point.position, { signal: controller.signal, via });
      const built = buildRouteOptions(d, raw);
      setRoutes(built);
      setSelectedRouteId(via ? built[0].id : (built.find((r) => r.tag === 'AI OPTIMAL')?.id ?? built[0].id));
      setRouteStatus('ready');
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Public OSRM demo server unreachable (offline, or its rate limit under
      // heavy traffic was hit) — degrade gracefully to a straight-line
      // estimate rather than failing the whole feature. See utils/routing.js
      // for how to point this at a self-hosted OSRM/Valhalla instance.
      const distanceKm = haversineKm(origin.point.position, destination.point.position);
      const durationMin = (distanceKm / OFFLINE_AVG_SPEED_KMH) * 60;
      const fallbackRaw = [{
        id: 'A', color: '#33e6ff',
        coordinates: [origin.point.position, destination.point.position],
        distanceKm, durationMin, avgSpeedKmh: OFFLINE_AVG_SPEED_KMH, turnCount: 0, turnsPerKm: 0, steps: [],
      }];
      const built = buildRouteOptions(d, fallbackRaw);
      setRoutes(built);
      setSelectedRouteId(built[0].id);
      setRouteStatus('offline');
      setRouteError('Live routing is unreachable right now (the free OSRM demo server may be rate-limited) — showing a straight-line distance estimate instead.');
    }
  }

  /** Called when the user drags the active route line on the map. */
  async function handleRouteDrag(latlng) {
    setViaPoint(latlng);
    await findRoutes(latlng);
  }

  function clearViaPoint() {
    setViaPoint(null);
    findRoutes(null);
  }

  const selectedRoute = routes ? routes.find((r) => r.id === selectedRouteId) ?? routes[0] : null;
  const mapRoutes = useMemo(
    () => (routes ? routes.map((r) => ({ ...r, active: r.id === selectedRouteId })) : null),
    [routes, selectedRouteId]
  );

  const directKm = origin.point && destination.point ? haversineKm(origin.point.position, destination.point.position) : null;

  // Charging stations that sit near the currently-selected route, so the
  // map can plot them and the route card can flag "has a charger on it".
  const routeChargingStations = useMemo(
    () => (selectedRoute ? stationsAlongRoute(selectedRoute.coordinates, { maxKm: 3 }) : []),
    [selectedRoute]
  );
  const chargingMarkers = useMemo(
    () => routeChargingStations.map((s) => ({
      id: s.id,
      position: s.position,
      label: `${s.name} · ${s.available}/${s.total} available`,
      kind: 'charge',
    })),
    [routeChargingStations]
  );
  // Which route options (by id) pass within range of at least one charger —
  // drives the small "Charging stop" badge on each route card below.
  const routesWithCharging = useMemo(() => {
    if (!routes) return new Set();
    const ids = routes
      .filter((r) => stationsAlongRoute(r.coordinates, { maxKm: 3 }).length > 0)
      .map((r) => r.id);
    return new Set(ids);
  }, [routes]);

  function confirmActiveRoute() {
    if (!selectedRoute) return;
    setActiveRoute({
      ...selectedRoute,
      originLabel: origin.point?.name ?? origin.query,
      destinationLabel: destination.point?.name ?? destination.query,
    });
  }

  const isActiveRoute = activeRoute && selectedRoute && activeRoute.id === selectedRoute.id && activeRoute.setAt;

  return (
    <div className="view-frame">
      <div className="route-grid">
        {/* MAP — clean, unobstructed. No controls are ever rendered on top of it. */}
        <Panel
          title="Smart Route · Live Map"
          right={
            <span className="mono text-cyan" style={{ fontSize: 12 }}>
              AI Route Score {selectedRoute ? selectedRoute.score : mockRoute.score}
            </span>
          }
        >
          <div className="route-map">
            <FreeMap
              id="map"
              className="route-map-svg"
              start={{ position: origin.point?.position ?? DEFAULT_ORIGIN.position, label: origin.point?.name ?? 'Current Location' }}
              destination={destination.point ? { position: destination.point.position, label: destination.point.name } : null}
              routes={mapRoutes}
              markers={chargingMarkers}
              onSelectRoute={setSelectedRouteId}
              onSelectPoint={handleMapPoint}
              onDestinationDrag={handleDrag}
              onRouteDrag={routes ? handleRouteDrag : undefined}
            />

            <div className="map-legend">
              <span className="map-legend-item"><MapPin size={12} className="text-cyan" /> Start</span>
              <span className="map-legend-item"><Flag size={12} className="text-violet" /> Destination</span>
              <span className="map-legend-item"><BatteryCharging size={12} className="text-green" /> Charging stop</span>
              {directKm != null && (
                <span className="map-legend-item">
                  <Navigation2 size={12} className="text-2" /> {formatKm(directKm)} direct
                </span>
              )}
              {routeChargingStations.length > 0 && (
                <span className="map-legend-item">
                  <BatteryCharging size={12} className="text-green" />
                  {routeChargingStations.length} charging {routeChargingStations.length === 1 ? 'stop' : 'stops'} on route
                </span>
              )}
              {routes && (
                <span className="map-legend-item" title="Press and drag the highlighted route line to reroute through that point">
                  <RotateCcw size={12} className="text-2" /> Drag route to reroute
                </span>
              )}
              {viaPoint && (
                <button type="button" className="map-legend-item map-legend-item--btn" onClick={clearViaPoint}>
                  <X size={12} /> Clear via-point
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* DECISION COLUMN — Route Options, then Route Selection below it */}
        <div className="route-side-stack">
          <Panel
            title="Route Options"
            className="route-options-panel"
            right={
              selectedRoute && selectedRoute.steps?.length > 0 && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={showInstructions ? 'Hide turn-by-turn instructions' : 'Show turn-by-turn instructions'}
                  onClick={() => setShowInstructions((v) => !v)}
                  title="Turn-by-turn instructions"
                >
                  <List size={14} />
                </button>
              )
            }
          >
            <div className="route-cards">
              {routes
                ? routes.map((r) => (
                    <button
                      key={r.id}
                      className={`route-card ${selectedRouteId === r.id ? 'route-card--active' : ''}`}
                      onClick={() => setSelectedRouteId(r.id)}
                      style={{ '--route-color': r.color }}
                    >
                      <div className="route-card-top">
                        <span className="route-card-badge" style={{ background: r.color }}>{r.id}</span>
                        <span className="eyebrow">{r.tag}</span>
                        <span className="mono route-card-score">{r.score}</span>
                      </div>
                      <div className="route-card-stats">
                        <span className="mono">{formatKm(r.distanceKm)}</span>
                        <span className="text-2">·</span>
                        <span className="mono">{formatMin(r.durationMin)}</span>
                        <span className="text-2">·</span>
                        <span className="mono">{formatKwh(r.energyKwh)}</span>
                      </div>
                      <div className="route-card-substats">
                        <span className={`mono ${r.traffic.tone}`}>{r.traffic.label} traffic</span>
                        <span className="text-2">·</span>
                        <span className="mono">{formatPct(r.batteryPct)} battery</span>
                        <span className="text-2">·</span>
                        <span className="text-2">{r.character}</span>
                        {routesWithCharging.has(r.id) && (
                          <span className="route-card-charge-badge">
                            <BatteryCharging size={11} /> Charging stop
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                : d.route.options.map((r) => (
                    <button key={r.id} className={`route-card ${r.id === 'A' ? 'route-card--active' : ''}`} disabled>
                      <div className="route-card-top">
                        <span className="route-card-badge">{r.id}</span>
                        <span className="eyebrow">{r.tag}</span>
                        <span className="mono route-card-score">{r.score}</span>
                      </div>
                      <div className="route-card-stats">
                        <span className="mono">{r.distance}</span>
                        <span className="text-2">·</span>
                        <span className="mono">{r.duration}</span>
                        <span className="text-2">·</span>
                        <span className="mono">{r.energy}</span>
                      </div>
                    </button>
                  ))}
            </div>

            {showInstructions && selectedRoute && (
              <RouteInstructions steps={selectedRoute.steps} compact />
            )}

            {routes && (
              <button
                type="button"
                className={`btn ${isActiveRoute ? 'btn-primary' : ''} confirm-route-btn`}
                onClick={confirmActiveRoute}
                disabled={!selectedRoute}
              >
                <CheckCircle2 size={14} />
                {isActiveRoute ? 'Active Journey Route' : 'Set as Active Route'}
              </button>
            )}

            <div className="ai-note" style={{ marginTop: routes ? 10 : 'auto' }}>
              {selectedRoute ? (
                <>
                  Route {selectedRoute.id} selected — {selectedRoute.tag.toLowerCase()}.{' '}
                  {formatKm(selectedRoute.distanceKm)} at an estimated {formatKwh(selectedRoute.energyKwh)}
                  {' '}({formatPct(selectedRoute.batteryPct)} of battery), arriving in {formatMin(selectedRoute.durationMin)}.
                  {routeStatus === 'offline' && ' (offline distance estimate — live routing unreachable)'}
                  {isActiveRoute && ' This is the route Journey AI and the Live Map are currently using.'}
                </>
              ) : (
                <>Set a start and destination in Route Selection below, then tap <strong>Find Routes</strong> for AI-ranked alternatives.</>
              )}
            </div>
          </Panel>

          <Panel title="Route Selection" className="route-selection-panel">
            <div className="journey-bar">
              <div className="journey-row">
                <LocationField
                  refFor={startWrapRef}
                  icon={<Search size={14} />}
                  placeholder="Start location…"
                  query={origin.query}
                  onQueryChange={(v) => { setOrigin((p) => ({ ...p, query: v, point: null })); runSearch('start', v); }}
                  open={openField === 'start'}
                  onOpenChange={(v) => setOpenField(v ? 'start' : null)}
                  results={geoResults.start.length ? geoResults.start : curatedMatches(origin.query)}
                  loading={geoLoading.start}
                  onPick={pickOrigin}
                  onClear={clearOrigin}
                  hasPoint={!!origin.point}
                  showUseLocation
                  onUseLocation={useMyLocation}
                  locating={locating}
                />
              </div>

              <button type="button" className="journey-swap-btn" onClick={swapPoints} title="Swap start and destination">
                <span aria-hidden="true">⇅</span>
              </button>

              <div className="journey-row">
                <LocationField
                  refFor={destWrapRef}
                  icon={<Flag size={14} className="text-violet" />}
                  placeholder="Where to?"
                  query={destination.query}
                  onQueryChange={(v) => { setDestination((p) => ({ ...p, query: v, point: null })); runSearch('dest', v); }}
                  open={openField === 'dest'}
                  onOpenChange={(v) => setOpenField(v ? 'dest' : null)}
                  results={geoResults.dest.length ? geoResults.dest : curatedMatches(destination.query)}
                  loading={geoLoading.dest}
                  onPick={pickDestination}
                  onClear={clearDestination}
                  hasPoint={!!destination.point}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary journey-find-btn"
                onClick={() => findRoutes()}
                disabled={!origin.point || !destination.point || routeStatus === 'loading'}
              >
                {routeStatus === 'loading' ? <span className="spinner-ring spinner-ring--light" /> : <Navigation2 size={13} />}
                {routeStatus === 'loading' ? 'Finding Routes…' : 'Find Routes'}
              </button>

              {routeError && (
                <div className="journey-alert">
                  <AlertTriangle size={13} className="text-amber" /> {routeError}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
