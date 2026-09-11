import { useMemo, useState } from 'react';
import { List, MapPin, BatteryCharging, Navigation2, AlertTriangle } from 'lucide-react';
import Panel from '../components/Panel';
import Modal from '../components/Modal';
import FreeMap from '../components/FreeMap';
import { VEHICLE_DATA } from '../data/vehicleData';
import { DEFAULT_ORIGIN } from '../data/destinations';
import { CHARGING_STATIONS } from '../data/chargingStations';
import { haversineKm, formatKm } from '../utils/geo';
import { fetchRoutes, buildRouteOptions } from '../utils/routing';
import { useAppContext } from '../context/AppContext';
import './views.css';
import './ChargingView.css';

const d = VEHICLE_DATA;

export default function ChargingView({ onOpenLive }) {
  const c = d.charging;
  const { setActiveRoute } = useAppContext();
  const [showAll, setShowAll] = useState(false);
  const stops = ['Now', 'Arrival', 'Post-Charge', 'Destination'];

  // "Current location" for distance-to-station math. Falls back to the same
  // default used everywhere else in the app (see destinations.js) — tap the
  // locate button to switch to a live GPS fix.
  const [origin, setOrigin] = useState({ position: DEFAULT_ORIGIN.position, label: DEFAULT_ORIGIN.name });
  const [locating, setLocating] = useState(false);

  const [navStatus, setNavStatus] = useState('idle'); // idle | loading | error
  const [navError, setNavError] = useState(null);
  const [previewRoute, setPreviewRoute] = useState(null); // route line drawn on THIS view's map before hand-off

  const stationsRanked = useMemo(
    () =>
      CHARGING_STATIONS
        .map((s) => ({ ...s, distanceKm: haversineKm(origin.position, s.position) }))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [origin.position]
  );
  const nearest = stationsRanked[0];
  const [selectedId, setSelectedId] = useState(null);
  const selected = stationsRanked.find((s) => s.id === selectedId) ?? nearest;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNavError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ position: [pos.coords.latitude, pos.coords.longitude], label: 'Current Location' });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNavError('Could not get your current location — check location permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /** Route to the given station, draw it on this view's map, then hand off to Live Journey for turn-by-turn. */
  async function navigateToStation(station) {
    setNavStatus('loading');
    setNavError(null);
    try {
      const raw = await fetchRoutes(origin.position, station.position);
      const built = buildRouteOptions(d, raw);
      const best = built[0];
      setPreviewRoute({ ...best, active: true });
      setActiveRoute({
        ...best,
        originLabel: origin.label,
        destinationLabel: station.name,
      });
      setNavStatus('idle');
      onOpenLive?.();
    } catch (err) {
      setNavStatus('error');
      const distanceKm = haversineKm(origin.position, station.position);
      setNavError(
        err?.message?.includes('unavailable')
          ? 'Live routing is unreachable right now (OSRM demo server may be rate-limited) — try again shortly.'
          : `No drivable route found (straight-line distance is ${formatKm(distanceKm)}).`
      );
    }
  }

  const mapMarkers = stationsRanked.map((s) => ({
    id: s.id,
    position: s.position,
    label: `${s.name} · ${s.available}/${s.total} available`,
    kind: 'charge',
    active: s.id === selected?.id,
    onClick: () => setSelectedId(s.id),
  }));

  return (
    <div className="view-frame">
      <div className="detail-grid">
        {/* LEFT — battery timeline */}
        <Panel title="Battery Timeline" className="df-left">
          <div className="batt-timeline">
            {c.journey.map((v, i) => (
              <div className="batt-stop" key={i}>
                <div className="batt-bar-wrap">
                  <div
                    className={`batt-bar ${v < 30 ? 'batt-bar--low' : ''}`}
                    style={{ height: `${v}%` }}
                  />
                </div>
                <span className="mono batt-value">{v}%</span>
                <span className="eyebrow">{stops[i]}</span>
              </div>
            ))}
          </div>
          <p className="ai-note" style={{ marginTop: 'auto' }}>
            Charging at {c.station} restores enough buffer to comfortably reach your destination with reserve.
          </p>
        </Panel>

        {/* CENTER — real, live station map */}
        <Panel
          title="Nearby Charging Stations"
          className="df-center"
          right={
            <div className="chip-row" style={{ gap: 8 }}>
              <button
                type="button"
                className="icon-btn"
                onClick={useMyLocation}
                disabled={locating}
                title="Use my current location"
                aria-label="Use my current location"
              >
                <Navigation2 size={13} />
              </button>
              <button className="icon-btn" onClick={() => setShowAll(true)} aria-label="View all stations">
                <List size={14} />
              </button>
            </div>
          }
        >
          <div className="charge-map">
            <FreeMap
              id="charging-map"
              className="route-map-svg"
              start={{ position: origin.position, label: origin.label }}
              markers={mapMarkers}
              onMarkerClick={(m) => setSelectedId(m.id)}
              routes={previewRoute ? [previewRoute] : null}
              zoom={12}
            />
          </div>
          {navError && (
            <div className="journey-alert" style={{ marginTop: 8 }}>
              <AlertTriangle size={13} className="text-amber" /> {navError}
            </div>
          )}
        </Panel>

        {/* RIGHT — recommended / selected station + navigate action */}
        <Panel title="AI Recommendation" className="df-right">
          {selected && (
            <>
              <div className="station-head">
                <h3>{selected.name}</h3>
                <span className="mono text-green station-score">{selected.score}</span>
              </div>
              <div className="stat-row"><span className="text-2">Distance</span><span className="mono">{formatKm(selected.distanceKm)}</span></div>
              <div className="stat-row"><span className="text-2">Network</span><span className="mono">{selected.network}</span></div>
              <div className="stat-row"><span className="text-2">Connectors</span><span className="mono">{selected.connectors.join(' · ')}</span></div>
              <div className="stat-row"><span className="text-2">Power</span><span className="mono">{selected.powerKw} kW</span></div>
              <div className="stat-row"><span className="text-2">Availability</span><span className="mono">{selected.available}/{selected.total}</span></div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 'auto' }}
                onClick={() => navigateToStation(selected)}
                disabled={navStatus === 'loading'}
              >
                {navStatus === 'loading'
                  ? <span className="spinner-ring spinner-ring--light" />
                  : <BatteryCharging size={14} />}
                {navStatus === 'loading' ? 'Routing…' : 'Navigate to Station'}
              </button>
            </>
          )}
        </Panel>
      </div>

      <Modal open={showAll} onClose={() => setShowAll(false)} title="All Nearby Stations">
        {stationsRanked.map((s) => (
          <div
            className="station-list-row"
            key={s.id}
            onClick={() => { setSelectedId(s.id); setShowAll(false); }}
            style={{ cursor: 'pointer' }}
          >
            <span className="station-list-icon"><MapPin size={13} className="text-cyan" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{s.name}</div>
              <div className="eyebrow">{formatKm(s.distanceKm)} · {s.available}/{s.total} available</div>
            </div>
            <span className="mono text-green">{s.score}</span>
          </div>
        ))}
      </Modal>
    </div>
  );
}
