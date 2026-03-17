import { useState, useEffect, useRef } from 'react';
import { FiPlay, FiPause, FiRefreshCw, FiClock, FiCoffee } from 'react-icons/fi';
import { incrementPomodoro, saveFocusTime, getActivity } from '../api';
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
  
  // Track daily stats
  const [todayFocus, setTodayFocus] = useState(0);
  const [todayRest, setTodayRest] = useState(0);
  const lastTickRef = useRef(null);

  useEffect(() => {
    // Preload audio on mount
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.load();
    setAlarmSound(audio);

    // Load today's stats
    getActivity().then(res => {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayActivity = res.data.activities.find(a => a.activity_date === todayStr);
      if (todayActivity) {
        setTodayFocus(todayActivity.focus_seconds || 0);
        setTodayRest(todayActivity.rest_seconds || 0);
      }
    }).catch(console.error);
  }, []);

  // Sync accumulated time to backend
  const syncTime = async (focusDelta, restDelta) => {
    if (focusDelta === 0 && restDelta === 0) return;
    try {
      const res = await saveFocusTime({
        focusSeconds: focusDelta,
        restSeconds: restDelta
      });
      if (res.data.success) {
        setTodayFocus(res.data.focusSecondsToday);
        setTodayRest(res.data.restSecondsToday);
      }
    } catch (err) {
      console.error("Failed to sync focus time", err);
    }
  };

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      lastTickRef.current = Date.now();
      
      interval = setInterval(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      
      // Calculate remaining exact delta for the final tick
      if (lastTickRef.current) {
        const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
        if (delta > 0) {
          if (mode === 'pomodoro') syncTime(delta, 0);
          else syncTime(0, delta);
        }
        lastTickRef.current = null;
      }

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
    
    // Cleanup interval
    return () => {
      if (interval) {
        clearInterval(interval);
        
        // When interval clears (pause or unmount), sync elapsed time
        if (lastTickRef.current) {
          const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
          if (delta > 0) {
            // Update local state immediately for snappy UI
            if (mode === 'pomodoro') setTodayFocus(prev => prev + delta);
            else setTodayRest(prev => prev + delta);
            
            // Sync to backend
            if (mode === 'pomodoro') syncTime(delta, 0);
            else syncTime(0, delta);
          }
        }
      }
    };
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => {
    // Force audio unlock on mobile and strict desktop browsers
    if (alarmSound && !isActive) {
      alarmSound.play().then(() => {
        alarmSound.pause();
        alarmSound.currentTime = 0;
      }).catch(e => console.log("Audio unlock deferred:", e));
    }
    
    // If pausing, the useEffect cleanup will handle the sync
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(customTimes[mode] * 60);
    lastTickRef.current = null;
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(customTimes[newMode] * 60);
    lastTickRef.current = null;
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

  const formatDurationHR = (seconds) => {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

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
