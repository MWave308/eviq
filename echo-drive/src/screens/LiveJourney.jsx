import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Navigation, AlertTriangle, Sparkles, ChevronUp, ChevronDown, BatteryCharging } from 'lucide-react';
import Car3DViewer from '../components/Car3DViewerLazy';
import Panel from '../components/Panel';
import FreeMap from '../components/FreeMap';
import RouteInstructions from '../components/RouteInstructions';
import { formatKm, formatMin } from '../utils/geo';
import { VEHICLE_DATA } from '../data/vehicleData';
import { useAppContext } from '../context/AppContext';
import { DEFAULT_ORIGIN } from '../data/destinations';
import { stationsAlongRoute } from '../data/chargingStations';
import './LiveJourney.css';

const d = VEHICLE_DATA;

export default function LiveJourney({ onExit }) {
  const l = d.live;
  const [routeChoice, setRouteChoice] = useState('current');
  const { activeRoute } = useAppContext();

  // Turn-by-turn navigation state for the route the user selected in Route
  // Selection (RouteView -> "Set as Active Route"). There's no live GPS feed
  // wired into this demo, so "current step" advances manually via the
  // Next/Prev controls below — swap this for a geolocation `watchPosition`
  // + nearest-step lookup once a real position feed is available.
  const steps = activeRoute?.steps ?? [];
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => { setStepIndex(0); }, [activeRoute?.id, activeRoute?.setAt]);
  const currentStep = steps[stepIndex] ?? null;
  const nextStep = steps[stepIndex + 1] ?? null;
  const remaining = useMemo(() => {
    if (!steps.length) return null;
    const rest = steps.slice(stepIndex);
    return {
      distanceKm: rest.reduce((sum, s) => sum + (s.distanceM || 0), 0) / 1000,
      durationMin: rest.reduce((sum, s) => sum + (s.durationS || 0), 0) / 60,
    };
  }, [steps, stepIndex]);

  const mapStart = activeRoute
    ? { position: currentStep?.position ?? activeRoute.coordinates[0], label: currentStep ? 'You are here' : (activeRoute.originLabel ?? 'Start') }
    : { position: DEFAULT_ORIGIN.position, label: DEFAULT_ORIGIN.name };
  const mapDestination = activeRoute
    ? { position: activeRoute.coordinates[activeRoute.coordinates.length - 1], label: activeRoute.destinationLabel ?? 'Destination' }
    : null;
  const mapRoutes = activeRoute ? [{ ...activeRoute, active: true }] : null;

  // Charging stations sitting near the active route — plotted on the live
  // map and listed on the right so a charger is visible on-route, not just
  // "nearest to me". Falls back to an empty list until a route is active.
  const routeChargingStations = useMemo(
    () => (activeRoute?.coordinates ? stationsAlongRoute(activeRoute.coordinates, { maxKm: 3 }) : []),
    [activeRoute]
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

  return (
    <motion.div
      className="live-screen"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* top overlay strip */}
      <div className="live-topbar glass-strong">
        <span className="pill live"><span className="dot" /> Live Journey</span>
        <div className="live-topstats">
          <div className="lts"><span className="eyebrow">Speed</span><span className="mono">{l.speed} km/h</span></div>
          <div className="lts"><span className="eyebrow">Battery</span><span className="mono text-cyan">{l.battery}%</span></div>
          <div className="lts"><span className="eyebrow">Range</span><span className="mono">{l.range} km</span></div>
          <div className="lts"><span className="eyebrow">ETA</span><span className="mono">{l.eta}</span></div>
          <div className="lts"><span className="eyebrow">Remaining</span><span className="mono">{l.distanceRemaining}</span></div>
        </div>
        <button className="btn btn-ghost" onClick={onExit}>
          <X size={15} /> End
        </button>
      </div>

      <div className="live-grid">
        {/* LEFT — vehicle (compact, non-interactive 3D glance) */}
        <Panel title={d.label} className="live-left">
          <div className="car-section-anchor">
            <Car3DViewer size="sm" interactive={false} autoRotate showBackground={false} />
          </div>
          <div className="stat-row"><span className="text-2">Battery</span><span className="mono text-cyan">{l.battery}%</span></div>
          <div className="stat-row"><span className="text-2">Range</span><span className="mono">{l.range} km</span></div>
          <div className="stat-row"><span className="text-2">Consumption</span><span className="mono">{d.energy.rate}</span></div>
        </Panel>

        {/* CENTER — map, unobstructed, showing the active route if one is set */}
        <Panel title="Live Navigation" className="live-center" right={<Navigation size={14} className="text-cyan" />}>
          <div className="live-map">
            <FreeMap
              id="map"
              className="route-map-svg"
              start={mapStart}
              destination={mapDestination}
              routes={mapRoutes}
              markers={chargingMarkers}
            />
          </div>
        </Panel>

        {/* RIGHT — turn-by-turn nav (when a route is active) + live AI */}
        <Panel title={activeRoute ? 'Turn-by-Turn' : 'EVIQ AI · Live'} className="live-right">
          {activeRoute && steps.length > 0 && (
            <div className="ttn-block">
              <div className="ttn-current">
                <span className="eyebrow text-cyan">Now</span>
                <p className="ttn-current-text">{currentStep.instruction}</p>
                {currentStep.distanceM > 0 && (
                  <span className="mono text-2">in {formatKm(currentStep.distanceM / 1000)}</span>
                )}
              </div>
              {nextStep && (
                <div className="ttn-next">
                  <span className="eyebrow">Then</span>
                  <span className="text-2">{nextStep.instruction}</span>
                </div>
              )}
              {remaining && (
                <div className="stat-row">
                  <span className="text-2">Remaining on route</span>
                  <span className="mono">{formatKm(remaining.distanceKm)} · {formatMin(remaining.durationMin)}</span>
                </div>
              )}
              <div className="chip-row ttn-controls">
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  disabled={stepIndex === 0}
                >
                  <ChevronUp size={13} /> Prev step
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                  disabled={stepIndex >= steps.length - 1}
                >
                  <ChevronDown size={13} /> Next step
                </button>
              </div>
              <details className="ttn-full">
                <summary className="eyebrow">Full instructions ({steps.length} steps)</summary>
                <RouteInstructions steps={steps} activeIndex={stepIndex} onStepClick={(_, i) => setStepIndex(i)} compact />
              </details>
            </div>
          )}

          {(!activeRoute || steps.length === 0) && (
            <div className="live-tip">
              <span className="eyebrow text-green">Eco Tip</span>
              <p>{l.ecoTip}</p>
            </div>
          )}

          {routeChargingStations.length > 0 && (
            <div className="live-tip">
              <span className="eyebrow text-green">
                <BatteryCharging size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                Charging on this route
              </span>
              <div className="ttn-charge-list">
                {routeChargingStations.slice(0, 3).map((s) => (
                  <div className="stat-row" key={s.id}>
                    <span className="text-2">{s.name}</span>
                    <span className="mono text-cyan">{formatKm(s.routeDistanceKm)} off-route</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="live-tip live-tip--alert">
            <span className="eyebrow text-amber"><AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Traffic Alert</span>
            <p>{l.trafficAlert}</p>
          </div>
          <div className="chip-row" style={{ marginTop: 'auto' }}>
            <button
              className={`btn ${routeChoice === 'switch' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setRouteChoice('switch')}
            >
              Switch Route
            </button>
            <button
              className={`btn ${routeChoice === 'current' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setRouteChoice('current')}
            >
              Keep Current
            </button>
          </div>
          <p className="ai-note">
            <Sparkles size={12} className="text-violet" style={{ marginRight: 6, verticalAlign: -1 }} />
            {routeChoice === 'switch'
              ? 'Rerouting — the alternate path is now active and range prediction has been refreshed.'
              : 'Staying the course. EVIQ AI will keep monitoring traffic and re-alert if conditions change.'}
          </p>
        </Panel>
      </div>
    </motion.div>
  );
}
