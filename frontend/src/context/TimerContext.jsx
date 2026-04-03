import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { incrementPomodoro, saveFocusTime, getActivity } from '../api';
import toast from 'react-hot-toast';

const TimerContext = createContext(null);

export function useTimer() {
  return useContext(TimerContext);
}

export function TimerProvider({ children }) {
  const [customTimes, setCustomTimes] = useState({
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15
  });
  const [timeLeft, setTimeLeft] = useState(customTimes.pomodoro * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('pomodoro');
  const [alarmSound, setAlarmSound] = useState(null);
  const [todayFocus, setTodayFocus] = useState(0);
  const [todayRest, setTodayRest] = useState(0);
  const lastTickRef = useRef(null);

  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.load();
    setAlarmSound(audio);

    getActivity().then(res => {
      const d = new Date();
      const todayStr = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('-');
      const todayActivity = res.data.activities.find(a => a.activity_date === todayStr);
      if (todayActivity) {
        setTodayFocus(todayActivity.focus_seconds || 0);
        setTodayRest(todayActivity.rest_seconds || 0);
      }
    }).catch(console.error);
  }, []);

  const syncTime = useCallback(async (focusDelta, restDelta) => {
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
  }, []);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      lastTickRef.current = Date.now();

      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);

      if (lastTickRef.current) {
        const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
        if (delta > 0) {
          if (mode === 'pomodoro') syncTime(delta, 0);
          else syncTime(0, delta);
        }
        lastTickRef.current = null;
      }

      if (alarmSound) {
        alarmSound.currentTime = 0;
        alarmSound.play().catch(e => console.warn("Audio play failed:", e));
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }

      if (mode === 'pomodoro') {
        incrementPomodoro().catch(err => console.error("Could not save pomodoro count:", err));
        toast.success("Pomodoro Complete! Great focus. Take a break.", { icon: '🎯' });
      } else {
        toast.success("Break is over! Time to get back to revision.", { icon: '⏰' });
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
        if (lastTickRef.current) {
          const delta = Math.floor((Date.now() - lastTickRef.current) / 1000);
          if (delta > 0) {
            if (mode === 'pomodoro') setTodayFocus(prev => prev + delta);
            else setTodayRest(prev => prev + delta);
            if (mode === 'pomodoro') syncTime(delta, 0);
            else syncTime(0, delta);
          }
        }
      }
    };
  }, [isActive, timeLeft, mode, alarmSound, syncTime]);

  const toggleTimer = useCallback(() => {
    if (alarmSound && !isActive) {
      alarmSound.play().then(() => {
        alarmSound.pause();
        alarmSound.currentTime = 0;
      }).catch(e => console.log("Audio unlock deferred:", e));
    }
    setIsActive(prev => !prev);
  }, [alarmSound, isActive]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setTimeLeft(customTimes[mode] * 60);
    lastTickRef.current = null;
  }, [customTimes, mode]);

  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(customTimes[newMode] * 60);
    lastTickRef.current = null;
  }, [customTimes]);

  const handleCustomTimeChange = useCallback((timerMode, value) => {
    const val = parseInt(value) || 1;
    setCustomTimes(prev => {
      const next = { ...prev, [timerMode]: val };
      return next;
    });
    if (timerMode === mode && !isActive) {
      setTimeLeft(val * 60);
    }
  }, [mode, isActive]);

  const formatTime = useCallback((seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const formatDurationHR = useCallback((seconds) => {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }, []);

  const value = {
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
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}
