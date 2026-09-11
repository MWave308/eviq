import Panel from '../components/Panel';
import Car3DViewer from '../components/Car3DViewerLazy';
import { VEHICLE_DATA } from '../data/vehicleData';
import './views.css';
import './EnergyView.css';

const d = VEHICLE_DATA;

export default function EnergyView() {
  const b = d.energy.breakdown;

  let acc = 0;
  const stops = b.map((seg) => {
    const start = acc;
    acc += seg.value;
    return `${seg.color} ${start}% ${acc}%`;
  });

  const maxTrend = Math.max(...d.energy.trend);

  return (
    <div className="view-frame">
      <div className="detail-grid detail-grid--withfoot">
        {/* LEFT — distribution donut */}
        <Panel title="Energy Distribution" className="df-left">
          <div className="donut-wrap">
            <div className="donut" style={{ background: `conic-gradient(${stops.join(',')})` }}>
              <div className="donut-hole">
                <span className="big-figure text-cyan" style={{ fontSize: 24 }}>{d.energy.rate}</span>
                <span className="eyebrow">Efficiency</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {b.map((seg) => (
              <div className="stat-row" key={seg.label}>
                <span className="text-1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="swatch" style={{ background: seg.color }} />
                  {seg.label}
                </span>
                <span className="mono">{seg.value}%</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* CENTER — vehicle showcase */}
        <Panel title={`${d.label} · Energy Pathways`} className="df-center">
          <div className="car-section-anchor">
            <Car3DViewer size="lg" interactive={false} autoRotate />
          </div>
        </Panel>

        {/* RIGHT — insights */}
        <Panel title="AI Consumption Insight" className="df-right">
          <div className="stat-row">
            <span className="text-2">Current Rate</span>
            <span className="mono text-cyan">{d.energy.rate}</span>
          </div>
          <div className="stat-row">
            <span className="text-2">Vs. Weekly Average</span>
            <span className="mono text-green">↑ {d.energy.vsAvg}%</span>
          </div>
          <div className="stat-row">
            <span className="text-2">Largest Draw</span>
            <span className="mono">{b[0].label}</span>
          </div>
          <p className="ai-note" style={{ flex: 1 }}>{d.energy.insight}</p>
        </Panel>

        {/* BOTTOM — trend */}
        <Panel title="Efficiency Trend · Last 12 intervals" className="df-foot">
          <div className="trend-chart">
            {d.energy.trend.map((v, i) => (
              <div
                key={i}
                className="trend-bar"
                style={{ height: `${(v / maxTrend) * 100}%`, opacity: 0.45 + (i / d.energy.trend.length) * 0.55 }}
                title={`${v} km/kWh`}
              />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
