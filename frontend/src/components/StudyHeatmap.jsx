import { useState, useEffect, useMemo } from 'react';
import { getActivity } from '../api';
import { FiZap, FiTrendingUp, FiCalendar, FiActivity } from 'react-icons/fi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];

function getColor(count) {
  if (count === 0) return 'bg-[#161b22]';
  if (count <= 2) return 'bg-emerald-900/70';
  if (count <= 5) return 'bg-emerald-700/80';
  if (count <= 10) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

export default function StudyHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);

  useEffect(() => {
    getActivity().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const { grid, monthLabels } = useMemo(() => {
    if (!data) return { grid: [], monthLabels: [] };

    const activityMap = {};
    const focusMap = {};
    const restMap = {};
    data.activities.forEach(a => { 
      activityMap[a.activity_date] = a.total_count; 
      focusMap[a.activity_date] = a.focus_seconds || 0;
      restMap[a.activity_date] = a.rest_seconds || 0;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Build 52 weeks of data (364 days) ending today
    const weeks = [];
    const labels = [];
    
    // Find the start date (go back to beginning of the week, 52 weeks ago)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 363);
    // Adjust to start on Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let currentDate = new Date(startDate);
    let currentWeek = [];
    let lastMonth = -1;

    while (currentDate <= today) {
      const dateStr = [
        currentDate.getFullYear(),
        String(currentDate.getMonth() + 1).padStart(2, '0'),
        String(currentDate.getDate()).padStart(2, '0')
      ].join('-');
      const dayOfWeek = currentDate.getDay();
      const month = currentDate.getMonth();

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      if (month !== lastMonth) {
        labels.push({ month: MONTHS[month], weekIndex: weeks.length });
        lastMonth = month;
      }

      currentWeek.push({
        date: dateStr,
        count: activityMap[dateStr] || 0,
        focusSeconds: focusMap[dateStr] || 0,
        restSeconds: restMap[dateStr] || 0,
        display: `${currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      // Pad the last week
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', count: -1, focusSeconds: 0, restSeconds: 0, display: '' });
      }
      weeks.push(currentWeek);
    }

    return { grid: weeks, monthLabels: labels };
  }, [data]);

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) return <div className="card animate-pulse h-40 flex items-center justify-center text-[var(--text-muted)]">Loading activity...</div>;
  if (!data) return null;

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <FiActivity className="text-emerald-400" /> Study Activity
        </h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2 bg-[var(--surface-hover)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
            <FiZap className="text-orange-400" size={14} />
            <span className="text-[var(--text-muted)]">Streak:</span>
            <span className="font-bold text-white">{data.currentStreak} days</span>
          </div>
          <div className="flex items-center gap-2 bg-[var(--surface-hover)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
            <FiTrendingUp className="text-blue-400" size={14} />
            <span className="text-[var(--text-muted)]">Longest:</span>
            <span className="font-bold text-white">{data.longestStreak} days</span>
          </div>
          <div className="flex items-center gap-2 bg-[var(--surface-hover)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
            <FiCalendar className="text-purple-400" size={14} />
            <span className="text-[var(--text-muted)]">Active:</span>
            <span className="font-bold text-white">{data.totalActiveDays} days</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        {/* Month labels */}
        <div className="flex mb-1 ml-8">
          {monthLabels.map((label, i) => (
            <div
              key={i}
              className="text-[10px] text-[var(--text-muted)] font-medium"
              style={{ 
                position: 'relative',
                left: `${label.weekIndex * 14}px`,
                width: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {label.month}
            </div>
          ))}
        </div>

        <div className="flex gap-[2px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] mr-1 justify-center">
            {DAYS.map((day, i) => (
              <div key={i} className="h-[12px] text-[9px] text-[var(--text-muted)] leading-[12px] w-6 text-right pr-1">
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) => {
                // Determine color based on focus_seconds if available, otherwise fallback to actions count
                const hasFocus = day.focusSeconds > 0;
                let bgColor = '';
                if (day.count < 0) bgColor = 'bg-transparent';
                else if (hasFocus) {
                  // Scale: <1h, <2h, <4h, 4h+
                  if (day.focusSeconds <= 3600) bgColor = 'bg-emerald-900/70';
                  else if (day.focusSeconds <= 7200) bgColor = 'bg-emerald-700/80';
                  else if (day.focusSeconds <= 14400) bgColor = 'bg-emerald-500';
                  else bgColor = 'bg-emerald-400';
                } else {
                  bgColor = getColor(day.count);
                }

                return (
                  <div
                    key={di}
                    className={`w-[12px] h-[12px] rounded-[2px] transition-all duration-150 ${bgColor} ${day.count >= 0 ? 'hover:ring-1 hover:ring-white/40 cursor-pointer' : ''}`}
                    onMouseEnter={() => day.count >= 0 && setHoveredCell({ ...day, x: wi, y: di })}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredCell && (
          <div className="mt-2 text-xs text-[var(--text-muted)] bg-[var(--surface-hover)] inline-block px-3 py-1.5 rounded-lg border border-[var(--border)]">
            <span className="font-bold text-white">{hoveredCell.count} action{hoveredCell.count !== 1 ? 's' : ''}</span> on {hoveredCell.display}
            {(hoveredCell.focusSeconds > 0 || hoveredCell.restSeconds > 0) && (
              <span className="ml-2 pl-2 border-l border-[var(--border)]">
                {hoveredCell.focusSeconds > 0 && <span className="text-emerald-400 mr-2">{formatDuration(hoveredCell.focusSeconds)} focused</span>}
                {hoveredCell.restSeconds > 0 && <span className="text-orange-400">{formatDuration(hoveredCell.restSeconds)} rested</span>}
              </span>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 justify-end text-[10px] text-[var(--text-muted)]">
          <span>Less</span>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-[#161b22]"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-emerald-900/70"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-emerald-700/80"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-emerald-500"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-emerald-400"></div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
