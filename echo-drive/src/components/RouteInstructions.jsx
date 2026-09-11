import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight,
  RotateCcw, MapPin, Flag, RefreshCw,
} from 'lucide-react';
import { formatKm } from '../utils/geo';
import './RouteInstructions.css';

// Maps the normalized `icon` key from utils/routing.js -> a lucide icon.
const ICONS = {
  depart: MapPin,
  arrive: Flag,
  roundabout: RefreshCw,
  uturn: RotateCcw,
  left: ArrowLeft,
  'slight-left': ArrowUpLeft,
  right: ArrowRight,
  'slight-right': ArrowUpRight,
  straight: ArrowUp,
};

function stepDistance(m) {
  if (m == null) return '';
  return m < 1000 ? `${Math.round(m)} m` : formatKm(m / 1000);
}

/**
 * Interactive turn-by-turn instructions panel.
 * - `steps`: normalized steps from utils/routing.js (fetchRoutes(...).steps)
 * - `activeIndex`: highlights the "current" step (used in Live Journey nav)
 * - `onStepClick(step)`: optional — e.g. to pan the map to that maneuver
 */
export default function RouteInstructions({ steps, activeIndex = -1, onStepClick, compact = false }) {
  if (!steps || steps.length === 0) {
    return <div className="ri-empty text-2">No turn-by-turn instructions available for this route.</div>;
  }

  return (
    <ol className={`ri-list ${compact ? 'ri-list--compact' : ''}`}>
      {steps.map((step, i) => {
        const Icon = ICONS[step.icon] || ArrowUp;
        const isActive = i === activeIndex;
        const isDone = activeIndex > -1 && i < activeIndex;
        return (
          <li
            key={step.id}
            className={`ri-step ${isActive ? 'ri-step--active' : ''} ${isDone ? 'ri-step--done' : ''}`}
            onClick={() => onStepClick?.(step, i)}
          >
            <span className={`ri-step-icon ri-step-icon--${step.icon}`}>
              <Icon size={14} />
            </span>
            <span className="ri-step-body">
              <span className="ri-step-text">{step.instruction}</span>
              {step.roadName && !step.instruction.includes(step.roadName) && (
                <span className="ri-step-road eyebrow">{step.roadName}</span>
              )}
            </span>
            <span className="mono ri-step-dist">{stepDistance(step.distanceM)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function instructionsSummary(steps) {
  if (!steps || !steps.length) return null;
  const totalM = steps.reduce((sum, s) => sum + (s.distanceM || 0), 0);
  const totalS = steps.reduce((sum, s) => sum + (s.durationS || 0), 0);
  return { turns: steps.length, distanceKm: totalM / 1000, durationMin: totalS / 60 };
}
