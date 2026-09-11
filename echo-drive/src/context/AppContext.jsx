import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { VEHICLE_DATA } from '../data/vehicleData';
import { estimateBatteryCapacityKwh } from '../utils/routing';

const AppContext = createContext(null);

/**
 * Shared app-level state:
 *  - activeRoute: the route the user confirmed in Route Selection. Journey
 *    AI and the Live Map both read this so they always analyze/display the
 *    same journey the user picked, instead of duplicating route state.
 *  - theme: light/dark, applied to <html data-theme="...">.
 *  - car section scroll target, used by "View Car" / "Open 3D View" /
 *    "Explore Vehicle" actions anywhere in the app.
 */
export function AppProvider({ children }) {
  const [activeRoute, setActiveRouteState] = useState(null);
  const [theme, setTheme] = useState('dark');
  const carSectionRef = useRef(null);
  const [pendingCarFocus, setPendingCarFocus] = useState(false);

  const setActiveRoute = useCallback((route) => {
    if (!route) {
      setActiveRouteState(null);
      return;
    }
    const batteryCapacity = estimateBatteryCapacityKwh(VEHICLE_DATA);
    const predictedBatteryPct = batteryCapacity
      ? Math.max(0, VEHICLE_DATA.range.soc - (route.energyKwh / batteryCapacity) * 100)
      : null;
    const needsCharge = predictedBatteryPct != null && predictedBatteryPct < 25;

    setActiveRouteState({
      ...route,
      predictedBatteryPct,
      needsCharge,
      chargingStop: needsCharge ? VEHICLE_DATA.charging : null,
      setAt: Date.now(),
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const scrollToCarSection = useCallback(() => {
    setPendingCarFocus(true);
  }, []);

  const consumeCarFocus = useCallback(() => setPendingCarFocus(false), []);

  const value = useMemo(
    () => ({
      activeRoute,
      setActiveRoute,
      theme,
      toggleTheme,
      carSectionRef,
      pendingCarFocus,
      scrollToCarSection,
      consumeCarFocus,
    }),
    [activeRoute, setActiveRoute, theme, toggleTheme, pendingCarFocus, scrollToCarSection, consumeCarFocus]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
