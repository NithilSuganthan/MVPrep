import { useState } from 'react';
import { createAdminTemplateSubject, updateAdminTemplateSubject, deleteAdminTemplateSubject, createAdminTemplateChapter, updateAdminTemplateChapter, deleteAdminTemplateChapter } from '../api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiLayers } from 'react-icons/fi';

const levelLabels = { foundation: 'Foundation', inter: 'Intermediate', final: 'Final' };

export default function SyllabusManager({ templates, fetchData }) {
  const [activeLevel, setActiveLevel] = useState('foundation');
  const [editingSubId, setEditingSubId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Subjects Handlers
  const handleAddSubject = async () => {
    try {
      await createAdminTemplateSubject({ level: activeLevel, name: 'New Subject', total_marks: 100 });
      fetchData();
      toast.success('Subject Added');
    } catch(err) { toast.error('Error adding subject'); }
  };

  const handleUpdateSubject = async (id) => {
    try {
      await updateAdminTemplateSubject(id, editForm);
      setEditingSubId(null);
      fetchData();
      toast.success('Subject Updated');
    } catch(err) { toast.error('Error updating subject'); }
  };

  const handleDeleteSubject = async (id, name) => {
    if(!window.confirm(`Delete subject "${name}" AND all its chapters from the default template?`)) return;
    try {
      await deleteAdminTemplateSubject(id);
      fetchData();
      toast.success('Subject Deleted');
    } catch(err) { toast.error('Error deleting subject'); }
  };

  // Chapters Handlers
  const handleAddChapter = async (subjectId) => {
    try {
      await createAdminTemplateChapter({ template_subject_id: subjectId, name: 'New Chapter', marks: 10, priority: 'B' });
      fetchData();
      toast.success('Chapter Added');
    } catch(err) { toast.error('Error adding chapter'); }
  };

  const handleUpdateChapter = async (id) => {
    try {
      await updateAdminTemplateChapter(id, editForm);
      setEditingSubId(null);
      fetchData();
      toast.success('Chapter Updated');
    } catch(err) { toast.error('Error updating chapter'); }
  };

  const handleDeleteChapter = async (id) => {
    if(!window.confirm('Delete this chapter from the template?')) return;
    try {
      await deleteAdminTemplateChapter(id);
      fetchData();
      toast.success('Chapter Deleted');
    } catch(err) { toast.error('Error deleting chapter'); }
  };

  const renderSubjectEditForm = (sub) => (
    <div className="flex gap-2 items-center w-full">
      <input type="text" className="flex-1 bg-black/50 border border-blue-500/50 p-2 text-sm text-white rounded" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} />
      <input type="number" className="w-20 bg-black/50 border border-blue-500/50 p-2 text-sm text-white rounded" value={editForm.total_marks} onChange={e=>setEditForm({...editForm, total_marks: e.target.value})} />
      <button onClick={() => handleUpdateSubject(sub.id)} className="p-2 text-green-400 hover:text-green-300"><FiSave size={16}/></button>
      <button onClick={() => setEditingSubId(null)} className="p-2 text-red-400 hover:text-red-300"><FiX size={16}/></button>
    </div>
  );

  const renderChapterEditForm = (ch) => (
    <div className="flex flex-wrap gap-2 items-center w-full bg-black/20 p-2 rounded border border-blue-500/30">
      <input type="text" className="flex-1 min-w-[150px] bg-black/50 border border-[var(--border)] p-1.5 text-xs text-white rounded" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} />
      <input type="number" className="w-16 bg-black/50 border border-[var(--border)] p-1.5 text-xs text-white rounded" value={editForm.marks} onChange={e=>setEditForm({...editForm, marks: e.target.value})} />
      <select className="bg-black/50 border border-[var(--border)] p-1.5 text-xs text-white rounded" value={editForm.priority} onChange={e=>setEditForm({...editForm, priority: e.target.value})}>
        <option value="A">A</option><option value="B">B</option><option value="C">C</option>
      </select>
      <button onClick={() => handleUpdateChapter(ch.id)} className="p-1.5 text-green-400"><FiSave size={14}/></button>
      <button onClick={() => setEditingSubId(null)} className="p-1.5 text-red-400"><FiX size={14}/></button>
    </div>
  );

  const currentLevelSubjects = templates[activeLevel] || [];

  return (
    <div className="card space-y-6">
      <div className="flex justify-between items-center bg-[var(--surface-hover)] p-2 rounded-lg border border-[var(--border)]">
        <div className="flex gap-1">
          {['foundation', 'inter', 'final'].map(lvl => (
            <button key={lvl} onClick={() => setActiveLevel(lvl)}
              className={`px-4 py-2 rounded font-bold text-sm transition-all ${activeLevel === lvl ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              CA {levelLabels[lvl]}
            </button>
          ))}
        </div>
        <button onClick={handleAddSubject} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm text-white font-bold transition">
          <FiPlus/> Add Subject
        </button>
      </div>

      <div className="space-y-4">
        {currentLevelSubjects.length === 0 ? (
          <p className="text-center text-gray-500 py-10">No subjects configured for this level.</p>
        ) : (
          currentLevelSubjects.map((sub, idx) => (
            <div key={sub.id} className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
              {/* Subject Header */}
              <div className="bg-gradient-to-r from-[var(--surface-hover)] to-transparent p-4 border-b border-[var(--border)] flex justify-between items-center group">
                {editingSubId === `sub_${sub.id}` ? renderSubjectEditForm(sub) : (
                  <>
                    <div>
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">{idx + 1}</span>
                        {sub.name}
                      </h3>
                      <p className="text-xs text-gray-400 max-w-lg mt-1">{sub.total_marks} Marks Total</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingSubId(`sub_${sub.id}`); setEditForm(sub); }} className="p-2 text-gray-400 hover:text-blue-400"><FiEdit2 size={16}/></button>
                      <button onClick={() => handleDeleteSubject(sub.id, sub.name)} className="p-2 text-gray-400 hover:text-red-400"><FiTrash2 size={16}/></button>
                    </div>
                  </>
                )}
              </div>

              {/* Chapters List */}
              <div className="p-2 bg-black/20">
                <div className="grid grid-cols-[1fr_60px_60px_80px] gap-2 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div>Chapter Name</div>
                  <div className="text-center">Marks</div>
                  <div className="text-center">Priority</div>
                  <div className="text-right">Actions</div>
                </div>
                
                {sub.chapters?.map((ch, cidx) => (
                  <div key={ch.id} className="grid grid-cols-1 md:grid-cols-[1fr_60px_60px_80px] gap-2 items-center px-3 py-2 border-t border-[var(--border)] border-dashed hover:bg-[var(--surface-hover)] transition group">
                    {editingSubId === `ch_${ch.id}` ? (
                      <div className="col-span-full">{renderChapterEditForm(ch)}</div>
                    ) : (
                      <>
                        <div className="flex gap-2 items-center text-sm text-gray-300">
                          <span className="text-gray-600 text-xs w-4">{cidx + 1}.</span> 
                          {ch.name}
                        </div>
                        <div className="text-center font-mono text-sm text-blue-400">{ch.marks}</div>
                        <div className="text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${ch.priority==='A' ? 'bg-green-500/20 text-green-400' : ch.priority==='B' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{ch.priority}</span>
                        </div>
                        <div className="text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingSubId(`ch_${ch.id}`); setEditForm(ch); }} className="p-1.5 text-gray-400 hover:text-blue-400"><FiEdit2 size={14}/></button>
                          <button onClick={() => handleDeleteChapter(ch.id)} className="p-1.5 text-gray-400 hover:text-red-400"><FiTrash2 size={14}/></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                
                <div className="p-3 border-t border-[var(--border)] border-dashed">
                  <button onClick={() => handleAddChapter(sub.id)} className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <FiPlus/> Add Chapter to {sub.name}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
