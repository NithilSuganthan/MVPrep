import { useState, useEffect } from 'react';
import { getNotes, updateChapter } from '../api';
import { FiEdit3, FiSave, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

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

  const exportAllNotes = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yOffset = 20;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Quick Revision Notes", margin, yOffset);
    yOffset += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, yOffset);
    doc.setTextColor(0, 0, 0);
    yOffset += 12;

    let notesCount = 0;

    data.forEach(subject => {
      const chaptersWithNotes = subject.chapters.filter(ch => ch.notes && ch.notes.trim());
      if (chaptersWithNotes.length === 0) return;

      // Check page overflow for subject header
      if (yOffset > 260) {
        doc.addPage();
        yOffset = 20;
      }

      // Subject header
      doc.setFillColor(30, 30, 30);
      doc.rect(margin, yOffset - 5, maxWidth, 10, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(subject.name, margin + 4, yOffset + 2);
      doc.setTextColor(0, 0, 0);
      yOffset += 14;

      chaptersWithNotes.forEach(ch => {
        // Check page overflow
        if (yOffset > 265) {
          doc.addPage();
          yOffset = 20;
        }

        // Chapter name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(ch.name, margin + 2, yOffset);
        yOffset += 6;

        // Notes content
        doc.setFont("courier", "normal");
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(ch.notes, maxWidth - 8);
        lines.forEach(line => {
          if (yOffset > 280) {
            doc.addPage();
            yOffset = 20;
          }
          doc.text(line, margin + 6, yOffset);
          yOffset += 4.5;
        });

        yOffset += 6;
        notesCount++;
      });

      yOffset += 4;
    });

    if (notesCount === 0) {
      toast.error('No notes to export! Add some notes first.');
      return;
    }

    try {
      doc.save('MVPrep_Quick_Revision_Notes.pdf');
      toast.success(`Exported ${notesCount} notes to PDF!`, { icon: '📄' });
    } catch (e) {
      toast.error('PDF export failed.');
    }
  };

  if (loading) return <div className="text-center mt-20 animate-pulse text-[var(--border)]">Loading Notes...</div>;

  const totalNotes = data.reduce((sum, subject) => sum + subject.chapters.filter(ch => ch.notes && ch.notes.trim()).length, 0);

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
      <header className="border-b border-[var(--border)] pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#d8b4fe] flex items-center gap-3">
            <FiEdit3 /> Quick Revision Notes
          </h1>
          <p className="text-[var(--text-muted)] mt-2 text-sm">
            Your centralized ultra-short notes repository. Perfect for the last 2-hour revision rush before the exam.
          </p>
        </div>
        {totalNotes > 0 && (
          <button
            onClick={exportAllNotes}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#a855f7] hover:bg-[#c084fc] text-black font-bold text-sm rounded-xl shadow-lg transition-colors whitespace-nowrap"
          >
            <FiDownload size={16} /> Export PDF ({totalNotes})
          </button>
        )}
      </header>

      {data.map(subject => {
        return (
          <div key={subject.id} className="card bg-[var(--surface)] border border-[var(--border)] p-0 overflow-hidden mb-6 shadow-lg">
            <div className="bg-[#101010] p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold text-white tracking-wide">{subject.name}</h2>
            </div>
            
            <div className="divide-y divide-[var(--border)]">
              {subject.chapters.map(ch => (
                <div key={ch.id} className="p-4 hover:bg-[var(--surface-hover)] transition-colors">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-semibold text-[var(--primary)] text-base sm:text-lg">{ch.name}</h3>
                    {editingId !== ch.id && (
                      <button 
                        onClick={() => { setEditingId(ch.id); setTempNote(ch.notes || ''); }}
                        className="text-xs px-3 py-1 bg-black border border-[var(--border)] rounded text-[var(--text-muted)] hover:text-white hover:border-[var(--primary)] transition-all shrink-0"
                      >
                        {ch.notes ? 'Edit' : '+ Add Note'}
                      </button>
                    )}
                  </div>

                  {editingId === ch.id ? (
                    <div className="mt-3 animate-fade-in relative z-10">
                      <textarea 
                        className="w-full bg-[#0a0a0a] border border-[#a855f7] p-3 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#a855f7] min-h-[120px] font-mono leading-relaxed shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                        placeholder={"e.g. \n- Goodwill adjustment formula\n- Hidden goodwill calculation"}
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
