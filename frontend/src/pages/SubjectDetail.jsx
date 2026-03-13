import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSubject, updateChapter } from '../api';
import { FiArrowLeft, FiCheckCircle, FiCircle, FiPlayCircle } from 'react-icons/fi';

export default function SubjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newChapter, setNewChapter] = useState({ name: '', marks: 5, priority: 'B', frequency: 'Frequent' });
  const [editingNotes, setEditingNotes] = useState(null);
  const [tempNotes, setTempNotes] = useState('');

  useEffect(() => {
    fetchSubject();
  }, [id]);

  const handleAddChapter = async (e) => {
    e.preventDefault();
    try {
      if (!newChapter.name) return;
      await import('../api').then(api => api.createChapter({
        subject_id: id,
        ...newChapter
      }));
      setNewChapter({ name: '', marks: 5, priority: 'B', frequency: 'Frequent' });
      setShowForm(false);
      fetchSubject();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubject = () => {
    getSubject(id).then(res => {
      setData(res.data);
      setLoading(false);
    });
  };

  const handleStatusChange = async (chapterId, currentStatus) => {
    let newStatus = 'Done';
    if (currentStatus === 'Not Started') newStatus = 'Revising';
    else if (currentStatus === 'Revising') newStatus = 'Done';
    else newStatus = 'Not Started';

    try {
      await updateChapter(chapterId, { status: newStatus });
      fetchSubject(); // refresh data
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Subject Data...</div>;

  const marksCovered = data.chapters.filter(ch => ch.status === 'Done').reduce((sum, ch) => sum + ch.marks, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-6">
        <div className="flex items-center gap-4">
          <Link to="/subjects" className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
            <FiArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{data.name}</h1>
            <p className="text-[var(--text-muted)] mt-1">Marks Covered: <span className="text-[var(--primary)] font-bold">{marksCovered}</span> / {data.total_marks}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ New Chapter'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleAddChapter} className="card bg-[var(--surface-hover)] p-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Chapter Name</label>
            <input 
              type="text" 
              required
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none"
              value={newChapter.name}
              onChange={e => setNewChapter({...newChapter, name: e.target.value})}
              placeholder="e.g. Audit of Banks"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Marks</label>
            <input 
              type="number" 
              required min="1" max="100"
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none"
              value={newChapter.marks}
              onChange={e => setNewChapter({...newChapter, marks: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Priority</label>
            <select
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none"
              value={newChapter.priority}
              onChange={e => setNewChapter({...newChapter, priority: e.target.value})}
            >
              <option value="A">Priority A</option>
              <option value="B">Priority B</option>
              <option value="C">Priority C</option>
            </select>
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Frequency</label>
            <select
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-white focus:border-[var(--primary)] focus:outline-none"
              value={newChapter.frequency || 'Frequent'}
              onChange={e => setNewChapter({...newChapter, frequency: e.target.value})}
            >
              <option value="Very Frequent">Very Frequent</option>
              <option value="Frequent">Frequent</option>
              <option value="Rare">Rare</option>
            </select>
          </div>
          <button type="submit" className="btn-primary py-3 px-6 h-[50px]">
            Add
          </button>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b-2 border-[var(--border)] bg-[#101010] text-[var(--text-muted)] uppercase text-xs tracking-wider">
              <th className="p-4 font-semibold w-7/12 rounded-tl-xl">Chapter & Notes</th>
              <th className="p-4 font-semibold text-center w-32 relative group cursor-help" title="Based on Previous Year Question mapping">
                Weight / Freq <span className="text-[10px] bg-white/10 px-1 rounded ml-1">i</span>
              </th>
              <th className="p-4 font-semibold text-center w-28">Priority Heatmap</th>
              <th className="p-4 font-semibold text-right w-36 rounded-tr-xl">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.chapters.map(ch => (
              <tr 
                key={ch.id} 
                className={`border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors 
                  ${ch.status === 'Done' ? 'opacity-[0.65]' : ''}`
                }
              >
                <td className="p-4 align-top">
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-lg text-white tracking-wide">{ch.name}</span>
                    
                    {/* Notes Section - Useful for last 2-hour revision */}
                    {editingNotes === ch.id ? (
                      <div className="mt-2 flex flex-col gap-2 bg-black/60 p-3 rounded-lg border border-[var(--primary)] shadow-lg animate-fade-in relative">
                        <span className="absolute -top-3 left-4 bg-[var(--background)] px-2 text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest border border-[var(--primary)] rounded">Quick Notes</span>
                        <textarea 
                          className="w-full bg-transparent text-sm text-gray-300 p-2 rounded focus:outline-none resize-none min-h-[80px]"
                          placeholder="Store ultra-short notes (Formulas, Limits, AS numbers)..."
                          value={tempNotes}
                          autoFocus
                          onChange={(e) => setTempNotes(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 mt-1">
                          <button onClick={() => setEditingNotes(null)} className="text-xs text-[var(--text-muted)] hover:text-white transition-colors font-medium">Cancel</button>
                          <button onClick={async () => {
                            try {
                              await updateChapter(ch.id, { notes: tempNotes });
                              setEditingNotes(null);
                              fetchSubject();
                            } catch (e) {
                              console.error(e);
                            }
                          }} className="bg-[var(--primary)] text-black text-xs font-bold px-4 py-1.5 rounded hover:bg-white transition-colors shadow">Save Notes</button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="mt-1 group cursor-text bg-[#1A1A1A] hover:bg-[#222] p-3 rounded-lg border border-dashed border-[#333] hover:border-[var(--primary)]/50 transition-all select-none"
                        onClick={() => { setEditingNotes(ch.id); setTempNotes(ch.notes || ''); }}
                      >
                        {ch.notes ? (
                          <div className="text-sm text-[var(--text-muted)] font-mono leading-relaxed whitespace-pre-wrap pl-2 border-l-2 border-[var(--primary)]/50 group-hover:border-[var(--primary)]">{ch.notes}</div>
                        ) : (
                          <span className="text-xs text-gray-500 italic flex items-center gap-2 group-hover:text-[#8AB4F8] transition-colors">
                            <span className="bg-black border border-gray-600 rounded px-1 group-hover:border-[#8AB4F8]">+</span> Add ultra-short revision notes (Useful for last 2-hour rush)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4 text-center align-top">
                  <div className="font-mono font-black text-xl text-white">{ch.marks} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">marks</span></div>
                  <div className={`mt-3 text-[10px] font-bold px-2 py-1 rounded-full inline-block uppercase tracking-wider
                    ${ch.frequency === 'Very Frequent' ? 'bg-[#3b0764] text-[#d8b4fe] border border-[#d8b4fe]/30 shadow-[0_0_10px_rgba(216,180,254,0.1)]' : 
                      ch.frequency === 'Rare' ? 'bg-[#1f2937] text-[#9ca3af] border border-[#374151]' : 'bg-[#1e3a8a] text-[#93c5fd] border border-[#93c5fd]/30'}`}>
                    {ch.frequency || 'Frequent'}
                  </div>
                </td>
                <td className="p-4 text-center align-top pt-6">
                  <div className="flex justify-center">
                    <span className={`px-4 py-1.5 rounded shadow-sm text-sm font-bold text-black border border-black/20 
                      ${ch.priority === 'A' ? 'bg-[#81C995] shadow-[0_0_15px_rgba(129,201,149,0.25)]' : 
                        ch.priority === 'B' ? 'bg-[#FDD663] shadow-[0_0_15px_rgba(253,214,99,0.25)]' : 
                        'bg-[#F28B82] shadow-[0_0_15px_rgba(242,139,130,0.25)]'}`}>
                      {ch.priority}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-right align-top pt-5">
                  <button 
                    onClick={() => handleStatusChange(ch.id, ch.status)}
                    className={`inline-flex items-center justify-center min-w-[120px] gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border shadow-sm
                      ${ch.status === 'Done' ? 'bg-[#1e3a2b] text-[var(--success)] border-[var(--success)]' : 
                        ch.status === 'Revising' ? 'bg-[#453a1a] text-[var(--warning)] border-[var(--warning)]' : 'bg-black/40 text-[var(--text-muted)] border-[var(--border)] hover:border-white hover:text-white'}`}
                  >
                    {ch.status === 'Done' ? <FiCheckCircle size={16} /> : ch.status === 'Revising' ? <FiPlayCircle size={16} /> : <FiCircle size={16} />}
                    {ch.status}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
