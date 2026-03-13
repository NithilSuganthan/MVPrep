import { useState, useEffect } from 'react';
import { FiPlay, FiPause, FiRefreshCw } from 'react-icons/fi';
import { incrementPomodoro } from '../api';
import toast from 'react-hot-toast';

export default function FocusTimer() {
  const [customTimes, setCustomTimes] = useState({
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15
  });
  const [timeLeft, setTimeLeft] = useState(customTimes.pomodoro * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('pomodoro'); // pomodoro, shortBreak, longBreak
  const [alarmSound, setAlarmSound] = useState(null);

  useEffect(() => {
    // Preload audio on mount
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.load();
    setAlarmSound(audio);
  }, []);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      
      // Play a ringing sound
      if (alarmSound) {
        alarmSound.currentTime = 0;
        alarmSound.play().catch(e => console.warn("Audio play failed:", e));
      }

      // Attempt vibrating the device
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]); // Vibrate pattern
      }

      // Log completed pomodoro if it was a pomodoro session
      if (mode === 'pomodoro') {
        incrementPomodoro().catch(err => console.error("Could not save pomodoro count:", err));
        toast.success("Pomodoro Complete! Great focus. Take a break.", { icon: '🎯' });
      } else {
        toast.success("Break is over! Time to get back to revision.", { icon: '⏰' });
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => {
    // Force audio unlock on mobile and strict desktop browsers
    if (alarmSound && !isActive) {
      alarmSound.play().then(() => {
        alarmSound.pause();
        alarmSound.currentTime = 0;
      }).catch(e => console.log("Audio unlock deferred:", e));
    }
    
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(customTimes[mode] * 60);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(customTimes[newMode] * 60);
  };

  const handleCustomTimeChange = (timerMode, value) => {
    const val = parseInt(value) || 1;
    setCustomTimes(prev => ({ ...prev, [timerMode]: val }));
    if (mode === timerMode && !isActive) {
      setTimeLeft(val * 60);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-xl mx-auto mt-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Focus Timer</h1>
        <p className="text-[var(--text-muted)] mt-1">Boost productivity explicitly for long 1.5 day revisions.</p>
      </header>

      <div className="card text-center py-10 mt-8 relative overflow-hidden">
        
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
