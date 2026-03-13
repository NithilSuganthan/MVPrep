import { FiTrendingUp, FiCheckCircle, FiXCircle, FiAward, FiTarget } from 'react-icons/fi';

const gradeColors = {
  'A': 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  'B': 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  'C': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  'F': 'text-red-400 bg-red-500/20 border-red-500/30',
};

export default function ScorePredictor({ data }) {
  if (!data?.subjectPredictions || data.subjectPredictions.length === 0) return null;

  const overallPct = data.totalMarks > 0 
    ? Math.round(((data.expectedScore.min + data.expectedScore.max) / 2 / data.totalMarks) * 100) 
    : 0;

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <FiTrendingUp className="text-[#8AB4F8]" /> Score Predictor
        </h3>
        <div className="flex gap-3 items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm ${
            data.allPassing 
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            {data.allPassing ? <FiCheckCircle /> : <FiXCircle />}
            {data.allPassing ? 'On Track to Pass' : `${data.passingSubjects}/${data.totalSubjectCount} Subjects Passing`}
          </div>
          <div className="bg-[var(--surface-hover)] px-4 py-2 rounded-xl border border-[var(--border)] text-sm">
            <span className="text-[var(--text-muted)]">Predicted: </span>
            <span className="font-black text-[#8AB4F8]">{data.expectedScore.min} – {data.expectedScore.max}</span>
            <span className="text-[var(--text-muted)]"> / {data.totalMarks}</span>
          </div>
        </div>
      </div>

      {/* Subject-wise breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.subjectPredictions.map(sub => (
          <div key={sub.id} className={`p-4 rounded-xl border transition-all ${
            sub.isPassing 
              ? 'bg-[var(--surface-hover)] border-[var(--border)]' 
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0 mr-2">
                <p className="font-bold text-white text-sm truncate">{sub.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {sub.doneChapters}/{sub.totalChapters} chapters done
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${gradeColors[sub.grade]}`}>
                  {sub.grade}
                </span>
                {sub.isPassing ? (
                  <FiCheckCircle className="text-emerald-400" size={14} />
                ) : (
                  <FiXCircle className="text-red-400" size={14} />
                )}
              </div>
            </div>

            {/* Score bar */}
            <div className="relative">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[var(--text-muted)]">Predicted</span>
                <span className="font-bold text-white">{sub.predictedScore} / {sub.totalMarks}</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden relative">
                {/* Passing mark indicator line */}
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-yellow-400/60 z-10" 
                  style={{ left: `${(sub.passingMarks / sub.totalMarks) * 100}%` }}
                  title={`Pass: ${sub.passingMarks} marks`}
                ></div>
                <div 
                  className={`h-2 rounded-full transition-all duration-700 ${
                    sub.isPassing ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'
                  }`} 
                  style={{ width: `${sub.pct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] mt-1">
                <span className="text-yellow-400/60">Pass: {sub.passingMarks}m</span>
                <span className="text-[var(--text-muted)]">A Focus: {sub.priorityFocus}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Methodology note */}
      <p className="text-[10px] text-[var(--text-muted)] mt-4 italic">
        Prediction model: Completed chapters = 85% retention, Revising chapters = 50% retention. Pass = 40% of total marks per subject.
      </p>
    </div>
  );
}
