import { useState, useEffect } from 'react';
import { getSubjects, createRevisionPlan, getRevisionPlans } from '../api';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

export default function Planner() {
  const [subjects, setSubjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [hours, setHours] = useState(12);
  const [studySpeed, setStudySpeed] = useState('normal');
  const [includeC, setIncludeC] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([getSubjects(), getRevisionPlans()]).then(([subRes, planRes]) => {
      setSubjects(subRes.data);
      setPlans(planRes.data);
      if (subRes.data.length > 0) setSelectedSubject(subRes.data[0].id);
      setLoading(false);
    });
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await createRevisionPlan({ 
        subject_id: selectedSubject, 
        hours_available: hours,
        study_speed: studySpeed,
        include_c: includeC
      });
      const planRes = await getRevisionPlans();
      setPlans(planRes.data);
      toast.success("Optimum Revision Schedule Generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate schedule.");
    } finally {
      setGenerating(false);
    }
  };

  const exportPDF = (plan) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`1.5 Day Revision Plan: ${plan.subject_name}`, 20, 20);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Hours Available: ${plan.hours_available} | Unrevised Marks Output: ${plan.plan_data.reduce((s, p) => s + p.totalMarks, 0)}`, 20, 30);

    let yOffset = 45;
    
    plan.plan_data.forEach(slot => {
      if (yOffset > 270) {
        doc.addPage();
        yOffset = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${slot.slot} - (${slot.hours} hrs, Targeting ${slot.totalMarks} Marks)`, 20, yOffset);
      yOffset += 8;

      doc.setFont("helvetica", "normal");
      slot.chapters.forEach(ch => {
        if (yOffset > 280) {
          doc.addPage();
          yOffset = 20;
        }
        doc.text(`- [Priority ${ch.priority}] ${ch.name} (${ch.marks} Marks)`, 25, yOffset);
        yOffset += 7;
      });
      yOffset += 5;
    });

    try {
      doc.save(`${plan.subject_name.replace(/[^a-zA-Z0-9]/g, '_')}_Revision_Plan.pdf`);
      toast.success("PDF exported successfully!");
    } catch (e) {
      toast.error("PDF export failed.");
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Planner Data...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">1.5 Day Revision Planner</h1>
        <p className="text-[var(--text-muted)] mt-1">Automatically schedule unrevised chapters based on ABC analysis.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Generator Form */}
        <div className="card col-span-1 border-tl-4 border-t-0 border-r-0 border-b-0 border-[var(--primary)] h-min">
          <h2 className="text-xl font-semibold mb-6">Create New Schedule</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Subject</label>
              <select 
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
              >
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name} (Cov: {Math.round((s.marksCovered/s.total_marks)*100)}%)</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Available Study Hours</label>
              <input 
                type="number" 
                min="1" max="48" step="0.5"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors font-mono"
                value={hours}
                onChange={e => setHours(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Study Speed</label>
              <select
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none transition-colors"
                value={studySpeed}
                onChange={e => setStudySpeed(e.target.value)}
              >
                <option value="slow">Thorough / Slow (Focus on concepts)</option>
                <option value="normal">Standard (Balanced revision)</option>
                <option value="fast">Aggressive / Fast (Quick scan)</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-4">
              <input 
                type="checkbox" 
                checked={includeC} 
                onChange={e => setIncludeC(e.target.checked)}
                className="w-5 h-5 accent-[var(--primary)] bg-[var(--background)] rounded border-[var(--border)] cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--text-muted)]">Include C-Category Chapters</span>
            </label>

            <button 
              type="submit" 
              disabled={generating}
              className="w-full btn-primary flex justify-center mt-6"
            >
              {generating ? 'Generating...' : 'Generate Plan'}
            </button>
          </form>
        </div>

        {/* Saved Plans */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold mb-2">Saved Schedules</h2>
          
          {plans.length === 0 ? (
            <div className="card bg-transparent border-dashed text-center p-12 text-[var(--text-muted)]">
              No schedules generated yet. Create one to get started.
            </div>
          ) : plans.map(p => (
            <div key={p.id} className="card relative transition-all hover:border-[#5f6368]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--primary)] to-blue-400">
                    {p.subject_name}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1 font-mono">
                    {p.hours_available} Hours Schedule | Targeting {p.plan_data.reduce((s, slot) => s + slot.totalMarks, 0)} Marks 
                  </p>
                </div>
                <button onClick={() => exportPDF(p)} className="btn-secondary text-sm">
                  Export PDF
                </button>
              </div>
              
              <div className="space-y-4">
                {p.plan_data.map((slot, i) => (
                  <div key={i} className="bg-[var(--background)] border border-[var(--border)] rounded-lg overflow-hidden">
                    <div className="bg-[var(--surface-hover)] px-4 py-2 flex justify-between items-center text-sm font-semibold border-b border-[var(--border)]">
                      <span>{slot.slot}</span>
                      <span className="text-[var(--primary)]">{slot.totalMarks} Marks Cover</span>
                    </div>
                    {slot.chapters.length > 0 ? (
                      <div className="divide-y divide-[var(--border)]">
                        {slot.chapters.map(ch => (
                          <div key={ch.id} className="p-3 flex justify-between items-center text-sm">
                            <div className="flex items-center gap-3">
                              <span className={`priority-${ch.priority} px-1.5 py-0.5 text-[10px]`}>{ch.priority}</span>
                              <span className="font-medium">{ch.name}</span>
                            </div>
                            <span className="font-mono text-xs text-[var(--text-muted)]">{ch.marks} Marks</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-[var(--text-muted)] text-center italic">No chapters assigned, or finished tracking.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
