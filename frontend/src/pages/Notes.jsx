import { useState, useEffect } from 'react';
import { getNotes, updateChapter } from '../api';
import { FiEdit3, FiSave, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Notes() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [tempNote, setTempNote] = useState('');

  const fetchNotes = () => {
    getNotes().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      toast.error('Failed to load notes');
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSave = async (chapterId) => {
    try {
      await updateChapter(chapterId, { notes: tempNote });
      toast.success('Notes saved successfully', { icon: '📝' });
      setEditingId(null);
      fetchNotes();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save notes');
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Notes...</div>;

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
      <header className="border-b border-[var(--border)] pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#d8b4fe] flex items-center gap-3">
          <FiEdit3 /> Quick Revision Notes
        </h1>
        <p className="text-[var(--text-muted)] mt-2">
          Your centralized ultra-short notes repository. Perfect for the last 2-hour revision rush before the exam.
        </p>
      </header>

      {data.map(subject => {
        const hasNotesOrIsEditing = subject.chapters.some(ch => ch.notes || editingId === ch.id);
        
        // Only show subjects that have at least one note, or if we are actively editing a chapter in it
        // Actually, let's show all chapters so the student CAN add notes from here.
        return (
          <div key={subject.id} className="card bg-[var(--surface)] border border-[var(--border)] p-0 overflow-hidden mb-6 shadow-lg">
            <div className="bg-[#101010] p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold text-white tracking-wide">{subject.name}</h2>
            </div>
            
            <div className="divide-y divide-[var(--border)]">
              {subject.chapters.map(ch => (
                <div key={ch.id} className="p-4 hover:bg-[var(--surface-hover)] transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-[var(--primary)] text-lg">{ch.name}</h3>
                    {editingId !== ch.id && (
                      <button 
                        onClick={() => { setEditingId(ch.id); setTempNote(ch.notes || ''); }}
                        className="text-xs px-3 py-1 bg-black border border-[var(--border)] rounded text-[var(--text-muted)] hover:text-white hover:border-[var(--primary)] transition-all opacity-0 group-hover:opacity-100"
                      >
                        {ch.notes ? 'Edit' : '+ Add Note'}
                      </button>
                    )}
                  </div>

                  {editingId === ch.id ? (
                    <div className="mt-3 animate-fade-in relative z-10">
                      <textarea 
                        className="w-full bg-[#0a0a0a] border border-[#a855f7] p-3 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#a855f7] min-h-[120px] font-mono leading-relaxed shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                        placeholder="e.g. &#10;- Goodwill adjustment formula&#10;- Hidden goodwill calculation"
                        value={tempNote}
                        autoFocus
                        onChange={(e) => setTempNote(e.target.value)}
                      />
                      <div className="flex justify-end gap-3 mt-3">
                        <button 
                          onClick={() => setEditingId(null)} 
                          className="px-4 py-1.5 rounded text-sm text-[var(--text-muted)] hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleSave(ch.id)} 
                          className="flex items-center gap-2 px-5 py-1.5 rounded bg-[#a855f7] hover:bg-[#c084fc] text-black font-bold text-sm shadow transition-colors"
                        >
                          <FiSave /> Save Memory
                        </button>
                      </div>
                    </div>
                  ) : (
                    ch.notes ? (
                      <div className="mt-2 text-sm text-gray-300 font-mono leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-[#a855f7]/50 bg-black/20 p-3 rounded-r-lg">
                        {ch.notes}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] italic opacity-50">No quick notes stored yet.</p>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {data.length === 0 && (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <FiEdit3 size={48} className="mx-auto mb-4 opacity-50" />
          <p>No subjects found. Create some subjects first to start tracking notes!</p>
        </div>
      )}
    </div>
  );
}
