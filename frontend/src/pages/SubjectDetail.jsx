import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSubject, updateChapter, updateSubject } from '../api';
import { FiArrowLeft, FiCheckCircle, FiCircle, FiPlayCircle, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function SubjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newChapter, setNewChapter] = useState({ name: '', marks: 5, priority: 'B', frequency: 'Frequent' });
  const [editingNotes, setEditingNotes] = useState(null);
  const [tempNotes, setTempNotes] = useState('');

  // Subject editing state
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: '', total_marks: 100 });

  // Chapter editing state
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [chapterForm, setChapterForm] = useState({ name: '', marks: 0, priority: 'B', frequency: 'Frequent' });

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
      toast.success('Chapter added!', { icon: '📖' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to add chapter');
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
      fetchSubject();
    } catch (err) {
      console.error(err);
    }
  };

  // Subject editing handlers
  const startEditingSubject = () => {
    setSubjectForm({ name: data.name, total_marks: data.total_marks });
    setEditingSubject(true);
  };

  const handleSaveSubject = async () => {
    if (!subjectForm.name.trim()) return toast.error('Subject name is required');
    if (subjectForm.total_marks < 1) return toast.error('Total marks must be at least 1');
    try {
      await updateSubject(id, {
        name: subjectForm.name.trim(),
        total_marks: parseInt(subjectForm.total_marks)
      });
      setEditingSubject(false);
      fetchSubject();
      toast.success('Subject updated!', { icon: '✏️' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update subject');
    }
  };

  // Chapter editing handlers
  const startEditingChapter = (ch) => {
    setChapterForm({
      name: ch.name,
      marks: ch.marks,
      priority: ch.priority,
      frequency: ch.frequency || 'Frequent'
    });
    setEditingChapterId(ch.id);
    setEditingNotes(null); // close notes if open
  };

  const handleSaveChapter = async (chapterId) => {
    if (!chapterForm.name.trim()) return toast.error('Chapter name is required');
    try {
      await updateChapter(chapterId, {
        name: chapterForm.name.trim(),
        marks: parseInt(chapterForm.marks) || 0,
        priority: chapterForm.priority,
        frequency: chapterForm.frequency
      });
      setEditingChapterId(null);
      fetchSubject();
      toast.success('Chapter updated!', { icon: '✏️' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update chapter');
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Subject Data...</div>;

  const marksCovered = data.chapters.filter(ch => ch.status === 'Done').reduce((sum, ch) => sum + ch.marks, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link to="/subjects" className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
            <FiArrowLeft size={24} />
          </Link>

          {editingSubject ? (
            <div className="flex items-center gap-3 flex-1 min-w-0 animate-fade-in">
              <input
                type="text"
                value={subjectForm.name}
                onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="flex-1 min-w-0 bg-[var(--surface-hover)] border border-[var(--primary)] rounded-lg px-3 py-2 text-white text-xl font-bold focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveSubject(); if (e.key === 'Escape') setEditingSubject(false); }}
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Total:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={subjectForm.total_marks}
                  onChange={e => setSubjectForm({ ...subjectForm, total_marks: e.target.value })}
                  className="w-20 bg-[var(--surface-hover)] border border-[var(--primary)] rounded-lg px-2 py-2 text-white text-center font-bold focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveSubject(); if (e.key === 'Escape') setEditingSubject(false); }}
                />
              </div>
              <button onClick={handleSaveSubject} className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors" title="Save">
                <FiSave size={18} />
              </button>
              <button onClick={() => setEditingSubject(false)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Cancel">
                <FiX size={18} />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-3 min-w-0">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{data.name}</h1>
                <p className="text-[var(--text-muted)] mt-1">Marks Covered: <span className="text-[var(--primary)] font-bold">{marksCovered}</span> / {data.total_marks}</p>
              </div>
              <button
                onClick={startEditingSubject}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Edit Subject"
              >
                <FiEdit2 size={16} />
              </button>
            </div>
          )}
        </div>
        {!editingSubject && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="btn-primary"
          >
            {showForm ? 'Cancel' : '+ New Chapter'}
          </button>
        )}
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
                    {/* Chapter name with inline edit */}
                    {editingChapterId === ch.id ? (
                      <div className="animate-fade-in space-y-3 bg-black/40 p-4 rounded-xl border border-[var(--primary)]/50 shadow-lg">
                        <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest">Edit Chapter</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase font-bold mb-1">Name</label>
                            <input
                              type="text"
                              value={chapterForm.name}
                              onChange={e => setChapterForm({ ...chapterForm, name: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2.5 text-white text-sm font-bold focus:border-[var(--primary)] focus:outline-none"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveChapter(ch.id); if (e.key === 'Escape') setEditingChapterId(null); }}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase font-bold mb-1">Marks</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={chapterForm.marks}
                              onChange={e => setChapterForm({ ...chapterForm, marks: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2.5 text-white text-sm font-mono focus:border-[var(--primary)] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase font-bold mb-1">Priority</label>
                            <select
                              value={chapterForm.priority}
                              onChange={e => setChapterForm({ ...chapterForm, priority: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2.5 text-white text-sm focus:border-[var(--primary)] focus:outline-none"
                            >
                              <option value="A">A — High Priority</option>
                              <option value="B">B — Medium Priority</option>
                              <option value="C">C — Low Priority</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase font-bold mb-1">Exam Frequency</label>
                            <select
                              value={chapterForm.frequency}
                              onChange={e => setChapterForm({ ...chapterForm, frequency: e.target.value })}
                              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-2.5 text-white text-sm focus:border-[var(--primary)] focus:outline-none"
                            >
                              <option value="Very Frequent">Very Frequent</option>
                              <option value="Frequent">Frequent</option>
                              <option value="Rare">Rare</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingChapterId(null)}
                            className="px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-white transition-colors rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveChapter(ch.id)}
                            className="flex items-center gap-1.5 px-5 py-1.5 bg-[var(--primary)] text-black text-sm font-bold rounded-lg hover:bg-blue-400 transition-colors shadow"
                          >
                            <FiSave size={14} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 group/name">
                          <span className="font-bold text-lg text-white tracking-wide">{ch.name}</span>
                          <button
                            onClick={() => startEditingChapter(ch)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] rounded transition-all opacity-0 group-hover/name:opacity-100"
                            title="Edit chapter details"
                          >
                            <FiEdit2 size={13} />
                          </button>
                        </div>
                    
                        {/* Notes Section */}
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
                            onClick={() => { setEditingNotes(ch.id); setTempNotes(ch.notes || ''); setEditingChapterId(null); }}
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
                      </>
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
