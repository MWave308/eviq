import { Gauge, BatteryFull, Zap, Navigation2, BatteryCharging, Sparkles, LayoutGrid } from 'lucide-react';
import { NAV_ITEMS } from '../data/vehicleData';
import './MobileTabBar.css';

const ICONS = {
  dashboard: LayoutGrid,
  range: BatteryFull,
  energy: Zap,
  ecospeed: Gauge,
  route: Navigation2,
  charging: BatteryCharging,
  journey: Sparkles,
};

// Mobile keeps the same "one module = one screen" model as desktop; it just
// swaps the top nav for a thumb-reachable bottom bar with a subset of tabs.
const MOBILE_ITEMS = NAV_ITEMS.filter((i) => ['dashboard', 'range', 'energy', 'route', 'journey'].includes(i.id));

export default function MobileTabBar({ activeView, onNavigate }) {
  return (
    <nav className="mobile-tabbar glass-strong" aria-label="Command center sections">
      {MOBILE_ITEMS.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <button
            key={item.id}
            className={`mobile-tab ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={17} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
