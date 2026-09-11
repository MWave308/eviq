import { AnimatePresence, motion } from 'framer-motion';
import TopNav from '../components/TopNav';
import MobileTabBar from '../components/MobileTabBar';
import DashboardView from '../views/DashboardView';
import RangeAIView from '../views/RangeAIView';
import EnergyView from '../views/EnergyView';
import EcoSpeedView from '../views/EcoSpeedView';
import RouteView from '../views/RouteView';
import ChargingView from '../views/ChargingView';
import JourneyAIView from '../views/JourneyAIView';
import './CommandCenter.css';

const VIEWS = {
  dashboard: DashboardView,
  range: RangeAIView,
  energy: EnergyView,
  ecospeed: EcoSpeedView,
  route: RouteView,
  charging: ChargingView,
  journey: JourneyAIView,
};

export default function CommandCenter({ activeView, onNavigate, onOpenLive }) {
  const ActiveView = VIEWS[activeView] ?? DashboardView;

  return (
    <div className="command-center">
      <div className="topnav-slot">
        <TopNav activeView={activeView} onNavigate={onNavigate} onOpenLive={onOpenLive} />
      </div>

      <main className="view-slot">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            className="view-motion-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ActiveView onNavigate={onNavigate} onOpenLive={onOpenLive} />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileTabBar activeView={activeView} onNavigate={onNavigate} />
    </div>
  );
}
