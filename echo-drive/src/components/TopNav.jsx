import { Sun, Moon, Zap, PlayCircle } from 'lucide-react';
import { NAV_ITEMS } from '../data/vehicleData';
import { useAppContext } from '../context/AppContext';
import './TopNav.css';

export default function TopNav({ activeView, onNavigate, onOpenLive }) {
  const { theme, toggleTheme } = useAppContext();

  return (
    <header className="topnav glass-strong">
      <div className="topnav-left">
        <span className="brand-mark" aria-hidden="true">
          <Zap size={16} />
        </span>
        <span className="brand-name">EVIQ <span className="text-cyan">AI</span></span>
      </div>

      <nav className="topnav-center" aria-label="Command center sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="topnav-right">
        <button className="btn btn-primary start-journey-btn" onClick={onOpenLive}>
          <PlayCircle size={14} />
          <span className="btn-label">Start Journey</span>
        </button>
        <button
          className="icon-btn theme-toggle"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
