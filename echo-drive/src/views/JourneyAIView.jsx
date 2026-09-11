import { useState } from 'react';
import { History, Sparkles, Navigation2 } from 'lucide-react';
import Panel from '../components/Panel';
import Modal from '../components/Modal';
import { VEHICLE_DATA } from '../data/vehicleData';
import { useAppContext } from '../context/AppContext';
import { formatKm, formatMin, formatKwh, formatPct } from '../utils/geo';
import './views.css';
import './JourneyAIView.css';

const d = VEHICLE_DATA;

const ACTIONS = {
  'Optimize Journey': () => `Journey re-optimized: adjusting pace and preconditioning could raise your score from ${d.journey.score} to ${Math.min(99, d.journey.score + 4)}.`,
  'Reduce Energy Use': () => `Trimming ${d.energy.breakdown[0].label.toLowerCase()} load and easing acceleration could cut consumption by roughly 7% over this trip.`,
  'Find Better Route': () => `Checked ${d.route.options.length} alternatives — your current route already holds the highest AI Route Score at ${d.route.score}.`,
  'Explain Battery': () => `Battery is at ${d.range.soc}% with ${d.range.confidence}% prediction confidence. Cell balance and thermal readings are both nominal.`,
  'Plan Charging': () => `${d.charging.station} is ${d.charging.distance} with a ${d.charging.wait}. A ${d.charging.duration} stop keeps you comfortably ahead of schedule.`,
};

// Node placement is expressed as a % of the hub's own box (not a fixed px
// radius) so it scales with `.journey-hub`'s responsive width instead of
// pushing nodes outside/overlapping the panel edge on narrower viewports.
// 37.6% ≈ the previous 128px against the hub's 340px design width.
const RADIUS_PCT = 37.6;
const LINE_RADIUS = 128; // SVG viewBox units — scales via the 0 0 340 340 viewBox itself

export default function JourneyAIView({ onNavigate }) {
  const { activeRoute } = useAppContext();

  // When the user has confirmed a route in Route Selection, Journey AI
  // recalculates its metrics from that real route instead of the mock data.
  const metrics = activeRoute
    ? [
        { label: 'Range Confidence', value: d.range.confidence },
        { label: 'Energy Efficiency', value: Math.round(activeRoute.score) },
        { label: 'Route Quality', value: Math.round(activeRoute.score) },
        { label: 'Charging Readiness', value: activeRoute.needsCharge ? 72 : 96 },
        { label: 'Driving Optimization', value: 90 },
      ]
    : [...d.journey.metrics, { label: 'Driving Optimization', value: 90 }];

  const journeyScore = activeRoute ? Math.round(activeRoute.score) : d.journey.score;
  const initialMessage = activeRoute
    ? `Now analyzing Route ${activeRoute.id} (${activeRoute.tag.toLowerCase()}) — ${formatKm(activeRoute.distanceKm)}, arriving in ${formatMin(activeRoute.durationMin)}.`
    : d.journey.message;

  const [messages, setMessages] = useState([{ action: 'System', text: initialMessage }]);
  const [showHistory, setShowHistory] = useState(false);

  function runAction(action) {
    setMessages((prev) => [{ action, text: ACTIONS[action]() }, ...prev]);
  }

  const visibleMessages = messages.slice(0, 3);

  return (
    <div className="view-frame">
      <div className="detail-grid">
        {/* LEFT — overview */}
        <Panel title="Journey Overview" className="df-left">
          <div className="stat-row"><span className="text-2">Status</span><span className="mono text-green">Optimal</span></div>
          <div className="stat-row"><span className="text-2">Vehicle</span><span className="mono">{d.plate}</span></div>
          {metrics.map((m) => (
            <div className="stat-row" key={m.label}>
              <span className="text-2">{m.label}</span>
              <span className="mono text-cyan">{m.value}</span>
            </div>
          ))}
        </Panel>

        {/* CENTER — radial hub */}
        <Panel title="EVIQ AI" className="df-center journey-hub-panel">
          <div className="journey-hub">
            <svg viewBox="0 0 340 340" className="hub-lines">
              {metrics.map((m, i) => {
                const angle = (i / metrics.length) * 2 * Math.PI - Math.PI / 2;
                const x = 170 + LINE_RADIUS * Math.cos(angle);
                const y = 170 + LINE_RADIUS * Math.sin(angle);
                return <line key={m.label} x1="170" y1="170" x2={x} y2={y} className="hub-line" />;
              })}
            </svg>

            <div className="hub-center">
              <span className="eyebrow">Journey Score</span>
              <span className="big-figure text-cyan" style={{ fontSize: 52 }}>{journeyScore}</span>
              <span className="eyebrow">/ 100</span>
            </div>

            {metrics.map((m, i) => {
              const angle = (i / metrics.length) * 2 * Math.PI - Math.PI / 2;
              return (
                <div
                  key={m.label}
                  className="hub-node"
                  style={{
                    left: `calc(50% + ${RADIUS_PCT * Math.cos(angle)}%)`,
                    top: `calc(50% + ${RADIUS_PCT * Math.sin(angle)}%)`,
                  }}
                >
                  <span className="mono hub-node-value">{m.value}</span>
                  <span className="hub-node-label">{m.label}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* RIGHT — actions + feed */}
        <Panel
          title="Quick Actions"
          className="df-right"
          right={<button className="icon-btn" onClick={() => setShowHistory(true)} aria-label="View history"><History size={14} /></button>}
        >
          {activeRoute ? (
            <div className="active-route-badge">
              <Navigation2 size={12} className="text-cyan" />
              <span>
                Analyzing Route {activeRoute.id} · {formatKm(activeRoute.distanceKm)} · {formatMin(activeRoute.durationMin)} ·{' '}
                {formatKwh(activeRoute.energyKwh)}
                {activeRoute.predictedBatteryPct != null && <> · {formatPct(activeRoute.predictedBatteryPct)} at arrival</>}
              </span>
            </div>
          ) : (
            <div className="active-route-badge active-route-badge--muted">
              <Navigation2 size={12} />
              <span>No route selected yet — pick one in Route Selection to sync it here.</span>
            </div>
          )}

          <div className="action-grid">
            {Object.keys(ACTIONS).map((a) => (
              <button key={a} className="btn" style={{ fontSize: 11.5, padding: '9px 6px' }} onClick={() => runAction(a)}>
                {a}
              </button>
            ))}
          </div>

          <div className="feed">
            {visibleMessages.map((m, i) => (
              <div className="feed-msg" key={i}>
                <Sparkles size={12} className="text-violet" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="eyebrow">{m.action}</div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.5 }}>{m.text}</p>
                </div>
              </div>
            ))}
          </div>

          {onNavigate && (
            <button className="btn" style={{ marginTop: 'auto' }} onClick={() => onNavigate('route')}>
              <Navigation2 size={13} /> Change Route
            </button>
          )}
        </Panel>
      </div>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="AI Recommendation History">
        {messages.map((m, i) => (
          <div className="feed-msg" key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--hairline)' }}>
            <Sparkles size={12} className="text-violet" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="eyebrow">{m.action}</div>
              <p style={{ fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.5 }}>{m.text}</p>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}
