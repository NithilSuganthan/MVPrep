import { useState, useEffect } from 'react';
import { getDashboardInfo, saveSettings } from '../api';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { FiTarget, FiZap, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import StudyHeatmap from '../components/StudyHeatmap';
import ScorePredictor from '../components/ScorePredictor';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [strategy, setStrategy] = useState('both');
  const [strategyLoading, setStrategyLoading] = useState(false);

  const fetchDashboard = () => {
    getDashboardInfo().then(res => {
      setData(res.data);
      setStrategy(res.data.interStrategy || 'both');
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleStrategyChange = async (newStrategy) => {
    if (newStrategy === strategy) return;
    setStrategyLoading(true);
    try {
      await saveSettings({ ca_inter_strategy: newStrategy });
      setStrategy(newStrategy);
      // Refresh dashboard with new filtered data
      const res = await getDashboardInfo();
      setData(res.data);
    } catch (err) {
      console.error('Failed to save strategy:', err);
    }
    setStrategyLoading(false);
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--text-muted)]">Loading Dashboard...</div>;

  const pieData = {
    labels: ['A (High Priority)', 'B (Medium Priority)', 'C (Low Priority)'],
    datasets: [{
      data: [data.breakdown.A.total, data.breakdown.B.total, data.breakdown.C.total],
      backgroundColor: ['#81C995', '#FDD663', '#F28B82'],
      borderColor: '#1E1E1E',
      borderWidth: 2,
    }]
  };

  const coverageData = {
    labels: ['A Category', 'B Category', 'C Category'],
    datasets: [
      {
        label: 'Marks Covered',
        data: [data.breakdown.A.covered, data.breakdown.B.covered, data.breakdown.C.covered],
        backgroundColor: '#8AB4F8',
        borderRadius: 4,
      },
      {
        label: 'Total Marks',
        data: [data.breakdown.A.total, data.breakdown.B.total, data.breakdown.C.total],
        backgroundColor: '#3C4043',
        borderRadius: 4,
      }
    ]
  };

  const barOptions = {
    responsive: true,
    scales: {
      y: { stacked: false, ticks: { color: '#9AA0A6' }, grid: { color: '#3C4043' } },
      x: { ticks: { color: '#9AA0A6' }, grid: { display: false } }
    },
    plugins: {
      legend: { labels: { color: '#E8EAED' } }
    }
  };

  const pieOptions = {
    plugins: {
      legend: { position: 'bottom', labels: { color: '#E8EAED', padding: 20 } }
    }
  };

  const renderMeter = (score) => {
    const filled = Math.min(10, Math.round(score / 10));
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${score}%`;
  };

  const getConfidenceLabel = (score) => {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  if (focusMode) {
    return (
      <div className="animate-fade-in space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-red-500 flex items-center gap-2"><FiTarget /> FOCUS MODE ACTIVE</h1>
            <p className="text-[var(--text-muted)] mt-1">Total blackout. Only highest priority pending targets shown.</p>
          </div>
          <button onClick={() => setFocusMode(false)} className="btn-secondary whitespace-nowrap px-8 py-2 border-[var(--border)]">
            Exit Focus Mode
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div className="card border-2 border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(220,38,38,0.1)]">
            <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
              <FiAlertTriangle /> Pending High Priority Chapters
            </h2>
            <div className="space-y-4">
              {data.highRiskChapters?.length > 0 ? data.highRiskChapters.map((ch, idx) => (
                <div key={ch.id} className="p-4 bg-black/40 rounded-xl border border-[var(--border)] flex justify-between items-center group hover:border-red-500/50 transition-colors">
                  <div>
                    <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider">{ch.subject_name}</span>
                    <h3 className="font-bold text-lg text-white mt-1">{idx + 1}. {ch.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="bg-red-500 text-black px-3 py-1 rounded shadow text-sm font-bold">{ch.marks} Marks</span>
                  </div>
                </div>
              )) : <p className="text-green-400 font-medium">All high risk chapters covered! Great job!</p>}
            </div>
          </div>

          <div className="card border-2 border-blue-500/50 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
              <FiZap /> Optimal Revision Queue
            </h2>
            <div className="space-y-4">
              {data.smartRevisionOrder?.length > 0 ? data.smartRevisionOrder.map((ch, idx) => (
                <div key={ch.id} className="p-4 bg-black/40 rounded-xl border border-[var(--border)] flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                  <div>
                    <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider">{ch.subject_name}</span>
                    <h3 className="font-bold text-lg text-white mt-1">{idx + 1}. {ch.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded shadow text-sm font-bold text-black ${ch.priority === 'A' ? 'bg-[#81C995]' : ch.priority === 'B' ? 'bg-[#FDD663]' : 'bg-[#F28B82]'}`}>
                      {ch.marks} Marks
                    </span>
                    <p className="text-xs mt-2 text-[var(--text-muted)] text-right font-medium">{ch.frequency}</p>
                  </div>
                </div>
              )) : <p className="text-green-400 font-medium">Nothing pending left in optimal queue!</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const levelMap = {
    'foundation': 'CA Foundation',
    'inter': 'CA Intermediate',
    'final': 'CA Final'
  };
  const levelTitle = levelMap[data.level] || 'CA';

  const strategyOptions = [
    { value: 'both', label: 'Both Groups', desc: 'Papers 1–6' },
    { value: 'group_1', label: 'Group 1', desc: 'Papers 1–3' },
    { value: 'group_2', label: 'Group 2', desc: 'Papers 4–6' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-blue-400">
            {levelTitle} Dashboard
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Track your progress for the 1.5-day revision.</p>
        </div>
        <button 
          onClick={() => setFocusMode(true)} 
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)]"
        >
          <FiTarget size={18} /> ENTER FOCUS MODE
        </button>
      </header>

      {/* CA Inter Exam Strategy Toggle */}
      {data.level === 'inter' && (
        <div className="card border border-[var(--border)] bg-gradient-to-r from-[var(--surface)]/80 to-[var(--surface-hover)]/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Exam Strategy</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 opacity-70">Choose your attempt structure — dashboard recalculates accordingly</p>
            </div>
            <div className="flex items-center gap-1 bg-[var(--background)] rounded-xl p-1 border border-[var(--border)]">
              {strategyOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStrategyChange(opt.value)}
                  disabled={strategyLoading}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                    strategy === opt.value
                      ? 'bg-[var(--primary)] text-black shadow-lg shadow-[var(--primary)]/20'
                      : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)]'
                  } ${strategyLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span>{opt.label}</span>
                  <span className="hidden sm:inline text-[10px] ml-1 opacity-70">({opt.desc})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Passing Subjects */}
        <div className={`card border-l-4 ${data.allPassing ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-bold">Passing Progress</p>
          <div className={`text-3xl font-black mt-2 ${data.allPassing ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.passingSubjects} / {data.totalSubjectCount}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-2 font-medium">Subjects on track to pass</p>
        </div>

        {/* Confidence Meter */}
        <div className="card border-l-4 border-l-[var(--success)] pr-2">
          <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-bold">Exam Confidence</p>
          <div className="font-mono text-xl mt-3 text-[var(--success)] tracking-tighter w-full overflow-hidden text-ellipsis">
            {renderMeter(data.confidenceScore)}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3 font-bold uppercase">
            Level: <span className={data.confidenceScore >= 70 ? 'text-green-400' : data.confidenceScore >= 40 ? 'text-yellow-400' : 'text-red-400'}>{getConfidenceLabel(data.confidenceScore)}</span>
          </p>
        </div>

        {/* Existing Stats modified */}
        <div className="card">
          <p className="text-[var(--text-muted)] text-sm uppercase tracking-wide">Marks Covered</p>
          <div className="text-3xl font-bold mt-2">
            {data.marksCovered} <span className="text-xl text-[var(--text-muted)] font-normal">/ {data.totalMarks}</span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-2 mt-4 overflow-hidden">
            <div 
              className="bg-[var(--success)] h-2 rounded-full progress-fill" 
              style={{ width: `${Math.min(100, data.confidenceScore)}%` }}
            ></div>
          </div>
        </div>

        <div className="card">
          <p className="text-[var(--text-muted)] text-sm uppercase tracking-wide">Chapter Progress</p>
          <div className="text-3xl font-bold mt-2">
            {data.completedChapters} <span className="text-xl text-[var(--text-muted)] font-normal">/ {data.totalChapters}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">{data.revisingChapters} currently revising</p>
        </div>

        <div className="card">
          <p className="text-[var(--text-muted)] text-sm uppercase tracking-wide">Flow Sessions</p>
          <div className="text-3xl font-bold mt-2">
            {data.totalPomodoros || 0} <span className="text-xl text-[var(--text-muted)] font-normal">Pomodoros</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Focus segments completed</p>
        </div>
      </div>

      {/* Enhanced Score Predictor */}
      <ScorePredictor data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ABC Analysis Distribution */}
        <div className="card col-span-1 lg:col-span-1 flex flex-col">
          <h2 className="text-lg font-semibold mb-6 text-center lg:text-left">Weightage Distribution</h2>
          <div className="flex-1 w-full flex items-center justify-center relative min-h-[250px]">
            <Pie data={pieData} options={pieOptions} />
          </div>
        </div>

        {/* Coverage by Category */}
        <div className="card col-span-1 lg:col-span-2 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-center lg:text-left">Coverage by ABC Category</h2>
          <div className="flex-1 w-full relative min-h-[250px]">
            <Bar data={coverageData} options={{...barOptions, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Smart Analysis Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pb-10">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 text-[#8AB4F8] flex items-center gap-2"><FiZap /> Smart Revision Order</h2>
          <div className="space-y-3">
            {data.smartRevisionOrder?.map((ch, idx) => (
              <div key={ch.id} className="flex justify-between items-center p-3 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
                <div>
                  <p className="font-medium">{idx + 1}. {ch.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{ch.subject_name} <span className="px-1">•</span> <span className="italic">{ch.frequency}</span></p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-bold text-black ${ch.priority === 'A' ? 'bg-[#81C995]' : ch.priority === 'B' ? 'bg-[#FDD663]' : 'bg-[#F28B82]'}`}>{ch.marks} Marks</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-2 border-red-500/20 bg-red-500/5">
          <h2 className="text-lg font-semibold mb-4 text-red-500 flex items-center gap-2"><FiAlertTriangle /> High Risk Chapters Alert</h2>
          <div className="space-y-3">
            {data.highRiskChapters?.map((ch, idx) => (
              <div key={ch.id} className="flex justify-between items-center p-3 rounded-lg bg-[var(--surface-hover)] border border-red-500/30">
                 <div>
                  <p className="font-bold text-red-400">⚠ {ch.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{ch.subject_name}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 rounded shadow text-xs font-bold bg-red-500 text-black">{ch.marks} Marks</span>
                </div>
              </div>
            ))}
            {data.highRiskChapters?.length === 0 && <p className="text-green-400 text-sm mt-4 font-medium">No high risk chapters pending! Great job.</p>}
          </div>
        </div>
      </div>

      {/* Study Activity Heatmap */}
      <StudyHeatmap />

    </div>
  );
}
