import { useEffect, useState } from 'react';
import { Gauge, Zap, Navigation2, BatteryCharging, ArrowRight, Sparkles } from 'lucide-react';
import Panel from '../components/Panel';
import RadialGauge from '../components/RadialGauge';
import Car3DViewer from '../components/Car3DViewerLazy';
import { VEHICLE_DATA } from '../data/vehicleData';
import { useAppContext } from '../context/AppContext';
import './views.css';

const d = VEHICLE_DATA;

const QUICK_ACTIONS = {
  Optimize: () => `Optimizing now: holding ${d.ecoSpeed.optimal[0]}–${d.ecoSpeed.optimal[1]} km/h and pre-conditioning the battery would lift your journey score by roughly 4 points.`,
  Explain: () => `Your score is driven mainly by ${d.energy.breakdown[0].label.toLowerCase()} load and current traffic density. Range confidence stays high at ${d.range.confidence}%.`,
  'Plan Charge': () => `Recommending ${d.charging.station}, ${d.charging.distance} — ${d.charging.duration} would return you to a comfortable buffer for the rest of the trip.`,
};

export default function DashboardView({ onNavigate }) {
  const [aiMessage, setAiMessage] = useState(d.journey.message);
  const [activeAction, setActiveAction] = useState(null);
  const { carSectionRef, pendingCarFocus, consumeCarFocus } = useAppContext();

  // "View Car" / "Open 3D View" / "Explore Vehicle" actions land here —
  // smoothly bring the 3D car panel into view without reloading the page.
  useEffect(() => {
    if (pendingCarFocus && carSectionRef.current) {
      carSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      consumeCarFocus();
    }
  }, [pendingCarFocus, carSectionRef, consumeCarFocus]);

  function runAction(action) {
    setActiveAction(action);
    setAiMessage(QUICK_ACTIONS[action]());
  }

  return (
    <div className="view-frame">
      <div className="dashboard-grid">
        {/* LEFT — AI Dynamic Range */}
        <Panel title="AI Dynamic Range" className="gd-left">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
            <RadialGauge value={d.range.soc} size={168} stroke={12}>
              <span className="big-figure" style={{ fontSize: 30, lineHeight: 1 }}>
                {d.range.current}
                <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4 }}>km</span>
              </span>
            </RadialGauge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 6 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="mono text-cyan" style={{ fontSize: 15, fontWeight: 600 }}>{d.range.soc}%</div>
              <div className="eyebrow">SOC</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mono text-green" style={{ fontSize: 15, fontWeight: 600 }}>{d.range.confidence}%</div>
              <div className="eyebrow">Confidence</div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {d.range.live.map((f) => (
              <div className="stat-row" key={f.label}>
                <span className="text-2">{f.label}</span>
                <span className="mono">{f.value}</span>
              </div>
            ))}
          </div>

          <p className="ai-note">{d.range.note}</p>
          <button className="btn btn-primary" onClick={() => onNavigate('range')}>
            Analyze Range <ArrowRight size={14} />
          </button>
        </Panel>

        {/* CENTER — hero 3D vehicle (the Car section) */}
        <Panel
          className="gd-center"
          title={`${d.label} · Live Telemetry`}
          right={<span className="pill live"><span className="dot" />Streaming</span>}
        >
          <div id="car-section" ref={carSectionRef} className="car-section-anchor">
            <Car3DViewer size="lg" interactive autoRotate label={`3D view of the ${d.label}`} />
          </div>
        </Panel>

        {/* RIGHT — EVIQ AI */}
        <Panel
          title="EVIQ AI"
          className="gd-right"
          right={<span className="eyebrow text-green">Journey Status: Optimal</span>}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span className="big-figure text-cyan" style={{ fontSize: 40 }}>{d.journey.score}</span>
            <span className="text-2" style={{ fontSize: 14 }}>/ 100</span>
          </div>

          <div style={{ marginBottom: 4 }}>
            {d.journey.metrics.map((m) => (
              <div className="stat-row" key={m.label}>
                <span className="text-2">{m.label}</span>
                <span className="mono text-cyan">{m.value}</span>
              </div>
            ))}
          </div>

          <p className="ai-note" style={{ flex: 1 }}>
            <Sparkles size={12} className="text-violet" style={{ marginRight: 6, verticalAlign: -1 }} />
            {aiMessage}
          </p>

          <div className="chip-row">
            {Object.keys(QUICK_ACTIONS).map((action) => (
              <button
                key={action}
                className={`btn ${activeAction === action ? 'active' : ''}`}
                style={{ flex: 1, padding: '9px 8px', fontSize: 12 }}
                onClick={() => runAction(action)}
              >
                {action}
              </button>
            ))}
          </div>
        </Panel>

        {/* BOTTOM — intelligence strip */}
        <div className="gd-bottom">
          <Panel
            as="button"
            title="Energy"
            className="module-tile"
            onClick={() => onNavigate('energy')}
            right={<Zap size={14} className="text-cyan" />}
          >
            <div className="big-figure" style={{ fontSize: 22 }}>{d.energy.rate}</div>
            <div className="text-green" style={{ fontSize: 12 }}>↑ {d.energy.vsAvg}% vs average</div>
          </Panel>

          <Panel
            as="button"
            title="Eco-Speed"
            className="module-tile"
            onClick={() => onNavigate('ecospeed')}
            right={<Gauge size={14} className="text-cyan" />}
          >
            <div style={{ fontSize: 13 }}>Optimal: <span className="mono text-green">{d.ecoSpeed.optimal[0]}–{d.ecoSpeed.optimal[1]} km/h</span></div>
            <div style={{ fontSize: 13 }}>Current: <span className="mono text-amber">{d.ecoSpeed.current} km/h</span></div>
          </Panel>

          <Panel
            as="button"
            title="Smart Route"
            className="module-tile"
            onClick={() => onNavigate('route')}
            right={<Navigation2 size={14} className="text-cyan" />}
          >
            <div className="big-figure" style={{ fontSize: 22 }}>{d.route.score}<span style={{ fontSize: 13, color: 'var(--text-2)' }}> /100</span></div>
            <div className="text-1" style={{ fontSize: 12 }}>{d.route.distance} · {d.route.duration}</div>
          </Panel>

          <Panel
            as="button"
            title="Charging"
            className="module-tile"
            onClick={() => onNavigate('charging')}
            right={<BatteryCharging size={14} className="text-cyan" />}
          >
            <div style={{ fontSize: 13 }} className="text-1">Next Stop: <span className="mono text-cyan">{d.charging.distance}</span></div>
            <div style={{ fontSize: 13 }}>AI Score: <span className="mono text-green">{d.charging.score}</span></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
