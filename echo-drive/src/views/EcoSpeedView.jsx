import Panel from '../components/Panel';
import { VEHICLE_DATA } from '../data/vehicleData';
import './views.css';
import './EcoSpeedView.css';

const MAX_SPEED = 100;

function angleFor(speed) {
  // maps 0..MAX_SPEED onto 180deg(left) .. 0deg(right)
  const clamped = Math.max(0, Math.min(MAX_SPEED, speed));
  return 180 - (clamped / MAX_SPEED) * 180;
}

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function EcoSpeedView() {
  const d = VEHICLE_DATA;
  const { optimal, current, saving, factors, reasoning, prediction } = d.ecoSpeed;

  const cx = 170, cy = 170, r = 130;
  const needleAngle = angleFor(current);
  const needleTip = polar(cx, cy, r - 22, needleAngle);
  const optimalStartAngle = angleFor(optimal[1]);
  const optimalEndAngle = angleFor(optimal[0]);

  return (
    <div className="view-frame">
      <div className="detail-grid detail-grid--withfoot">
        {/* LEFT — factors */}
        <Panel title="Influencing Factors" className="df-left">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {factors.map((f, i) => (
              <div className="factor-chip" key={i}>{f}</div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
            <div className="eyebrow">Potential Saving</div>
            <div className="big-figure text-green" style={{ fontSize: 34 }}>{saving}%</div>
          </div>
        </Panel>

        {/* CENTER — speedometer */}
        <Panel title="AI Speed Intelligence" className="df-center speed-panel">
          <svg viewBox="0 0 340 200" className="speed-gauge">
            <path d={arcPath(cx, cy, r, 180, 0)} className="gauge-track" />
            <path d={arcPath(cx, cy, r, optimalStartAngle, optimalEndAngle)} className="gauge-optimal" />
            <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} className="gauge-needle" />
            <circle cx={cx} cy={cy} r="7" className="gauge-pivot" />
          </svg>
          <div className="speed-readout">
            <div>
              <span className="big-figure" style={{ fontSize: 46 }}>{current}</span>
              <span className="eyebrow" style={{ display: 'block' }}>km/h current</span>
            </div>
            <div className="speed-divider" />
            <div>
              <span className="big-figure text-green" style={{ fontSize: 30 }}>{optimal[0]}–{optimal[1]}</span>
              <span className="eyebrow" style={{ display: 'block' }}>optimal zone</span>
            </div>
          </div>
        </Panel>

        {/* RIGHT — reasoning */}
        <Panel title="AI Reasoning" className="df-right">
          <p className="ai-note" style={{ flex: 1 }}>{reasoning}</p>
          <div className="stat-row">
            <span className="text-2">Recommended Zone</span>
            <span className="mono text-green">{optimal[0]}–{optimal[1]} km/h</span>
          </div>
          <div className="stat-row">
            <span className="text-2">Delta From Current</span>
            <span className="mono text-amber">{current - optimal[1]} km/h over</span>
          </div>
        </Panel>

        {/* BOTTOM — prediction */}
        <Panel title="Prediction" className="df-foot">
          <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>{prediction}</p>
        </Panel>
      </div>
    </div>
  );
}
