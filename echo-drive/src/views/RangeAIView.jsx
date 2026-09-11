import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import Panel from '../components/Panel';
import Car3DViewer from '../components/Car3DViewerLazy';
import Modal from '../components/Modal';
import { VEHICLE_DATA } from '../data/vehicleData';
import './views.css';

const d = VEHICLE_DATA;

const EXTRA_PARAMS = [
  { label: 'Tire Pressure', value: 'Nominal' },
  { label: 'Regen Recovery', value: '11.4%' },
  { label: 'Cabin Load', value: '2 occupants' },
  { label: 'Wind Resistance', value: 'Moderate headwind' },
  { label: 'Auxiliary Draw', value: '0.6 kW' },
  { label: 'Cell Balance', value: '99.1%' },
];

export default function RangeAIView() {
  const [showMore, setShowMore] = useState(false);
  const maxDelta = Math.max(...d.range.factors.map((f) => Math.abs(f.delta)));

  return (
    <div className="view-frame">
      <div className="detail-grid">
        {/* LEFT — waterfall */}
        <Panel title="Range Prediction Breakdown" className="df-left">
          <div className="stat-row" style={{ borderBottom: '1px solid var(--panel-border-hi)' }}>
            <span className="text-1">Base Range</span>
            <span className="mono text-cyan" style={{ fontSize: 15 }}>{d.range.base} km</span>
          </div>
          {d.range.factors.map((f) => (
            <div className="factor-row" key={f.label}>
              <span className="fr-label">{f.label}</span>
              <div className="fr-bar-wrap">
                <div
                  className="fr-bar"
                  style={{
                    width: `${(Math.abs(f.delta) / maxDelta) * 100}%`,
                    background: 'var(--amber)',
                    marginLeft: 'auto',
                  }}
                />
              </div>
              <span className="fr-value text-amber">{f.delta} km</span>
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--hairline)', textAlign: 'center' }}>
            <div className="eyebrow">Final Predicted Range</div>
            <div className="big-figure text-cyan" style={{ fontSize: 44 }}>{d.range.current} km</div>
          </div>
        </Panel>

        {/* CENTER — vehicle */}
        <Panel title={`${d.label} · Range Model`} className="df-center">
          <div className="car-section-anchor">
            <Car3DViewer size="lg" interactive={false} autoRotate />
          </div>
        </Panel>

        {/* RIGHT — live factors */}
        <Panel
          title="Adjustment Factors"
          className="df-right"
          right={<span className="mono text-green" style={{ fontSize: 12 }}>{d.range.confidence}% conf.</span>}
        >
          <div>
            {d.range.live.map((f) => (
              <div className="stat-row" key={f.label}>
                <span className="text-2">{f.label}</span>
                <span className="mono">{f.value}</span>
              </div>
            ))}
          </div>
          <p className="ai-note" style={{ flex: 1 }}>{d.range.note}</p>
          <button className="btn" onClick={() => setShowMore(true)}>
            <SlidersHorizontal size={13} /> More Parameters
          </button>
        </Panel>
      </div>

      <Modal open={showMore} onClose={() => setShowMore(false)} title="Additional Range Parameters">
        {EXTRA_PARAMS.map((p) => (
          <div className="stat-row" key={p.label}>
            <span className="text-2">{p.label}</span>
            <span className="mono">{p.value}</span>
          </div>
        ))}
      </Modal>
    </div>
  );
}
