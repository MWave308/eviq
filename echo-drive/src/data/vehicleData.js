// Mock AI telemetry. In a production build this shape would come from
// a live inference + sensor-fusion service; the UI only depends on
// this shape, so swapping in real data means replacing this file.
//
// EVIQ is a single-vehicle (electric car) system.

export const VEHICLE_DATA = {
  id: 'car',
  label: 'Electric Car',
  plate: 'EVIQ · SDN-1',
  range: {
    current: 287,
    soc: 74,
    confidence: 96.8,
    base: 320,
    factors: [
      { label: 'Traffic', delta: -11 },
      { label: 'Temperature', delta: -7 },
      { label: 'Terrain', delta: -9 },
      { label: 'Driving Behaviour', delta: -6 },
    ],
    // "live" feeds the AI Dynamic Range panel on the main Dashboard. This is
    // the array to wire up to your ESP32 prototype: each row is just a
    // { label, value } pair rendered as-is, so pushing real sensor readings
    // in means replacing these strings (e.g. over WebSocket/MQTT/fetch
    // polling) — no UI changes needed. Gradient doubles as road slope, and
    // Road Type / HVAC Load are here specifically for that real-time feed.
    live: [
      { label: 'Speed', value: '68 km/h' },
      { label: 'Traffic', value: 'Moderate' },
      { label: 'Temperature', value: '31°C' },
      { label: 'Gradient (Slope)', value: '+4.2%' },
      { label: 'Road Type', value: 'Highway' },
      { label: 'HVAC Load', value: '18%' },
      { label: 'Battery Temp', value: '29°C' },
    ],
    note: 'AI detected a 10.3% range reduction caused primarily by uphill terrain and HVAC load.',
  },
  energy: {
    rate: '6.4 km/kWh',
    vsAvg: 8,
    breakdown: [
      { label: 'Propulsion', value: 52, color: 'var(--cyan)' },
      { label: 'HVAC', value: 18, color: 'var(--violet)' },
      { label: 'Elevation', value: 14, color: 'var(--amber)' },
      { label: 'Traffic', value: 10, color: 'var(--green)' },
      { label: 'Other Systems', value: 6, color: 'var(--text-2)' },
    ],
    trend: [62, 58, 65, 60, 70, 66, 72, 68, 74, 71, 76, 73],
    insight: 'HVAC load is your second-largest draw today — 4 points above your weekly average.',
  },
  ecoSpeed: {
    optimal: [54, 58],
    current: 68,
    saving: 9.4,
    factors: ['Highway gradient easing over next 8 km', 'Traffic thinning ahead', 'Battery temp in optimal band'],
    reasoning: 'At 68 km/h aerodynamic drag is consuming 22% more energy per km than in the optimal band. Dropping to 56 km/h keeps trip time within 3 minutes of current ETA.',
    prediction: 'Maintaining 56 km/h for the next 8 km could save enough energy to add approximately 18 km of usable range.',
  },
  route: {
    score: 94,
    distance: '32.4 km',
    duration: '48 min',
    options: [
      { id: 'A', tag: 'AI OPTIMAL', distance: '32.4 km', duration: '48 min', energy: '12.8 kWh', score: 94 },
      { id: 'B', tag: 'FASTEST', distance: '29.1 km', duration: '42 min', energy: '15.4 kWh', score: 81 },
      { id: 'C', tag: 'MAX EFFICIENCY', distance: '36.8 km', duration: '55 min', energy: '11.2 kWh', score: 88 },
    ],
  },
  charging: {
    station: 'VoltPoint Express',
    distance: '4.2 km away',
    chargersAvailable: '3/6 Chargers Available',
    wait: '6 min estimated wait',
    duration: '18 min recommended charging',
    score: 96,
    journey: [74, 52, 81, 26],
  },
  journey: {
    score: 92,
    metrics: [
      { label: 'Range Confidence', value: 97 },
      { label: 'Energy Efficiency', value: 89 },
      { label: 'Route Quality', value: 94 },
      { label: 'Charging Readiness', value: 91 },
    ],
    message: 'Your journey is currently optimized. Maintaining 54–58 km/h could increase energy efficiency by 9.4%.',
  },
  live: {
    speed: 68,
    battery: 74,
    range: 287,
    eta: '48 min',
    distanceRemaining: '32.4 km',
    ecoTip: 'Maintain 52–56 km/h for the next 6 km.',
    trafficAlert: 'Alternate route may save 1.4 kWh.',
  },
};

// Dashboard is the primary entry point; Route sits directly beside it in
// the header. The remaining modules follow in their existing order.
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'route', label: 'Route' },
  { id: 'range', label: 'Range AI' },
  { id: 'energy', label: 'Energy' },
  { id: 'ecospeed', label: 'Eco-Speed' },
  { id: 'charging', label: 'Charging' },
  { id: 'journey', label: 'Journey AI' },
];
