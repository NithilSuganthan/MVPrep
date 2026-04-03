import { FiPlay, FiPause, FiRefreshCw, FiClock, FiCoffee } from 'react-icons/fi';
import { useTimer } from '../context/TimerContext';

export default function FocusTimer() {
  const {
    customTimes,
    timeLeft,
    isActive,
    mode,
    todayFocus,
    todayRest,
    toggleTimer,
    resetTimer,
    switchMode,
    handleCustomTimeChange,
    formatTime,
    formatDurationHR,
  } = useTimer();

  return (
    <div className="animate-fade-in space-y-6 max-w-xl mx-auto mt-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Focus Timer</h1>
        <p className="text-[var(--text-muted)] mt-1">Boost productivity explicitly for long 1.5 day revisions.</p>
      </header>
      
      {/* Daily Progress Bar */}
      <div className="flex gap-4 mb-2 mt-4 justify-center">
        <div className="bg-[var(--surface-hover)] px-4 py-3 rounded-xl border border-[var(--border)] flex items-center justify-between w-40">
           <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
             <FiClock className="text-emerald-400" /> Focus
           </div>
           <span className="font-bold text-white tracking-tight">{formatDurationHR(todayFocus)}</span>
        </div>
        <div className="bg-[var(--surface-hover)] px-4 py-3 rounded-xl border border-[var(--border)] flex items-center justify-between w-40">
           <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
             <FiCoffee className="text-orange-400" /> Rest
           </div>
           <span className="font-bold text-white tracking-tight">{formatDurationHR(todayRest)}</span>
        </div>
      </div>

      <div className="card text-center py-10 mt-2 relative overflow-hidden">
        
        {/* Animated Background Pulse if Active */}
        <div className={`absolute inset-0 bg-gradient-to-t from-[var(--primary)] to-transparent opacity-5 transition-opacity duration-1000 ${isActive ? 'opacity-20 animate-pulse' : ''}`}></div>

        <div className="flex justify-center gap-4 mb-8 relative z-10">
          <button 
            onClick={() => switchMode('pomodoro')} 
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'pomodoro' ? 'bg-[var(--primary)] text-black' : 'bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-white'}`}
          >
            Pomodoro
          </button>
          <button 
            onClick={() => switchMode('shortBreak')} 
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'shortBreak' ? 'bg-[var(--success)] text-black' : 'bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-white'}`}
          >
            Short Break
          </button>
          <button 
            onClick={() => switchMode('longBreak')} 
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${mode === 'longBreak' ? 'bg-[var(--warning)] text-black' : 'bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-white'}`}
          >
            Long Break
          </button>
        </div>

        <div className="text-[6rem] font-bold font-mono tracking-tighter mb-8 relative z-10 drop-shadow-lg text-white">
          {formatTime(timeLeft)}
        </div>

        <div className="flex justify-center gap-6 relative z-10">
          <button 
            onClick={toggleTimer}
            className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold text-xl hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
          >
            {isActive ? <><FiPause /> Pause</> : <><FiPlay /> Start</>}
          </button>
          <button 
            onClick={resetTimer}
            className="flex items-center gap-2 px-6 py-4 bg-[var(--surface-hover)] text-white rounded-xl font-bold hover:bg-[var(--border)] transition-colors border border-[var(--border)]"
          >
            <FiRefreshCw /> Reset
          </button>
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="text-lg font-semibold mb-4 text-center">Customize Timers (Minutes)</h3>
        <div className="flex gap-4 justify-center">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1 text-center">Pomodoro</label>
            <input 
              type="number" min="1" max="120"
              className="w-20 bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 text-center text-white focus:border-[var(--primary)] focus:outline-none"
              value={customTimes.pomodoro}
              onChange={(e) => handleCustomTimeChange('pomodoro', e.target.value)}
              disabled={isActive && mode === 'pomodoro'}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1 text-center">Short Break</label>
            <input 
              type="number" min="1" max="60"
              className="w-20 bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 text-center text-white focus:border-[var(--primary)] focus:outline-none"
              value={customTimes.shortBreak}
              onChange={(e) => handleCustomTimeChange('shortBreak', e.target.value)}
              disabled={isActive && mode === 'shortBreak'}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1 text-center">Long Break</label>
            <input 
              type="number" min="1" max="60"
              className="w-20 bg-[var(--background)] border border-[var(--border)] rounded-lg p-2 text-center text-white focus:border-[var(--primary)] focus:outline-none"
              value={customTimes.longBreak}
              onChange={(e) => handleCustomTimeChange('longBreak', e.target.value)}
              disabled={isActive && mode === 'longBreak'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
