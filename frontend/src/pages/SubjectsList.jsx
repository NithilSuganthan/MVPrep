import { useState, useEffect } from 'react';
import { getSubjects } from '../api';
import { Link } from 'react-router-dom';

export default function SubjectsList() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', total_marks: 100 });

  const fetchSubjects = () => {
    getSubjects().then(res => {
      setSubjects(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = async (e) => {
    e.preventDefault();
    try {
      if (!newSubject.name) return;
      await import('../api').then(api => api.createSubject(newSubject));
      setNewSubject({ name: '', total_marks: 100 });
      setShowForm(false);
      fetchSubjects();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Subjects...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects Overview</h1>
          <p className="text-[var(--text-muted)] mt-1">Select a subject to view and update chapter coverage.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ New Subject'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleAddSubject} className="card bg-[var(--surface-hover)] p-6 mt-4 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Subject Name</label>
            <input 
              type="text" 
              required
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none"
              value={newSubject.name}
              onChange={e => setNewSubject({...newSubject, name: e.target.value})}
              placeholder="e.g. Taxation"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Total Marks</label>
            <input 
              type="number" 
              required min="10"
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none"
              value={newSubject.total_marks}
              onChange={e => setNewSubject({...newSubject, total_marks: parseInt(e.target.value) || 0})}
            />
          </div>
          <button type="submit" className="btn-primary py-3 px-6 h-[50px]">
            Add
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {subjects.map(subject => (
          <Link to={`/subjects/${subject.id}`} key={subject.id} className="card group hover:border-[var(--primary)] hover:shadow-2xl transition-all block relative overflow-hidden">
            
            <div className="flex justify-between items-start mb-6 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-xl font-semibold group-hover:text-[var(--primary)] transition-colors">{subject.name}</h2>
                <div className="text-sm text-[var(--text-muted)] mt-1">Total Marks: <span className="text-[var(--text-main)] font-mono">{subject.total_marks}</span></div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{subject.confidenceScore}%</div>
                <div className="text-xs text-[var(--text-muted)]">Confidence</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Marks Covered</span>
                <span className="font-mono">
                  {subject.marksCovered} / {subject.total_marks}
                </span>
              </div>
              <div className="w-full bg-[var(--surface-hover)] rounded-full h-3 overflow-hidden border border-[var(--border)]">
                <div 
                  className="bg-[var(--success)] h-3 rounded-full progress-fill" 
                  style={{ width: `${Math.min(100, (subject.marksCovered / subject.total_marks) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-[var(--border)] pt-4 mt-6">
              <div className="flex space-x-2">
                <span className="priority-A" title="A Category Marks Covered">
                  {subject.stats.A.covered} / {subject.stats.A.total}
                </span>
                <span className="priority-B" title="B Category Marks Covered">
                  {subject.stats.B.covered} / {subject.stats.B.total}
                </span>
                <span className="priority-C" title="C Category Marks Covered">
                  {subject.stats.C.covered} / {subject.stats.C.total}
                </span>
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                {subject.completedChapters} / {subject.totalChapters} ch
              </div>
            </div>

          </Link>
        ))}
      </div>
    </div>
  );
}
