import { useLocation, useNavigate } from 'react-router-dom';
import { FiClock, FiPause, FiPlay } from 'react-icons/fi';
import { useTimer } from '../context/TimerContext';

export default function MiniTimer() {
  const { timeLeft, isActive, mode, formatTime, toggleTimer } = useTimer();
  const location = useLocation();
  const navigate = useNavigate();

  // Only show floating widget when timer is active AND user is NOT on /timer page
  if (!isActive || location.pathname === '/timer') return null;

  const modeColors = {
    pomodoro: 'from-emerald-500 to-emerald-700',
    shortBreak: 'from-blue-500 to-blue-700',
    longBreak: 'from-amber-500 to-amber-700',
  };

  const modeLabels = {
    pomodoro: 'Focus',
    shortBreak: 'Short Break',
    longBreak: 'Long Break',
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 animate-fade-in cursor-pointer group"
      onClick={() => navigate('/timer')}
      title="Click to open Focus Timer"
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r ${modeColors[mode]} shadow-2xl shadow-black/40 border border-white/10 backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-3xl`}>
        {/* Pulsing dot */}
        <div className="relative">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-white/50 animate-ping"></div>
        </div>
        
        {/* Timer display */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider leading-none">
            {modeLabels[mode]}
          </span>
          <span className="text-xl font-bold font-mono text-white tracking-tight leading-tight">
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Pause/Play button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTimer();
          }}
          className="ml-1 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white"
        >
          {isActive ? <FiPause size={14} /> : <FiPlay size={14} />}
        </button>
      </div>
    </div>
  );
}
