import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import LoadingScreen from './screens/LoadingScreen';
import CommandCenter from './screens/CommandCenter';
import LiveJourney from './screens/LiveJourney';
import { AppProvider } from './context/AppContext';

export default function App() {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'command'
  const [activeView, setActiveView] = useState('dashboard');
  const [liveOpen, setLiveOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveView('dashboard');
      setPhase('command');
    }, 2200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppProvider>
      <AnimatePresence mode="wait">
        {phase === 'loading' ? (
          <LoadingScreen key="loading" />
        ) : (
          <CommandCenter
            key="command"
            activeView={activeView}
            onNavigate={setActiveView}
            onOpenLive={() => setLiveOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {liveOpen && <LiveJourney key="live" onExit={() => setLiveOpen(false)} />}
      </AnimatePresence>
    </AppProvider>
  );
}
