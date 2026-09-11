import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle2 } from 'lucide-react';
import './LoadingScreen.css';

const STEPS = [
  'Booting EVIQ Core',
  'Calibrating range & energy models',
  'Loading Liberty map engine',
  'Linking live telemetry',
  'Ready',
];

const TOTAL_MS = 2000;

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let raf;
    const startedAt = performance.now();

    const tick = (now) => {
      const pct = Math.min(100, ((now - startedAt) / TOTAL_MS) * 100);
      setProgress(pct);
      setStepIndex(Math.min(STEPS.length - 1, Math.floor((pct / 100) * STEPS.length)));
      if (pct < 100) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      className="loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.45 }}
    >
      <div className="loading-orb loading-orb--one" />
      <div className="loading-orb loading-orb--two" />
      <div className="loading-grid" />

      <div className="loading-content">
        <motion.div
          className="loading-mark"
          animate={{
            boxShadow: [
              '0 0 20px rgba(51,230,255,.25)',
              '0 0 50px rgba(155,124,255,.38)',
              '0 0 20px rgba(51,230,255,.25)',
            ],
            rotate: [0, 6, -6, 0],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Zap size={30} />
        </motion.div>

        <div className="eyebrow loading-eyebrow">EVIQ</div>
        <h1>Preparing your intelligent journey</h1>
        <p>Calibrating live range, energy and route intelligence.</p>

        <div className="loading-track">
          <motion.span
            animate={{ width: `${Math.max(6, progress)}%` }}
            transition={{ ease: 'linear', duration: 0.15 }}
          />
        </div>

        <div className="loading-meta">
          <span className="loading-status"><span className="dot" /> {STEPS[stepIndex]}</span>
          <span className="mono loading-pct">{Math.round(progress)}%</span>
        </div>

        <ul className="loading-steps">
          {STEPS.map((step, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
            return (
              <li key={step} className={state}>
                <span className="loading-step-icon">
                  <AnimatePresence mode="wait" initial={false}>
                    {state === 'done' ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        <CheckCircle2 size={13} />
                      </motion.span>
                    ) : (
                      <motion.span key="pending" className="loading-step-dot" />
                    )}
                  </AnimatePresence>
                </span>
                {step}
              </li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}
