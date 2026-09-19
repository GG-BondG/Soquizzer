import { formatPercent, typeLabel } from '../format.js';
import './SectionProgress.css';

// How the student is doing in one section: accuracy by question type, the parts of the PDF worth re-reading and the
// mistakes still open. Renders nothing until something has been answered.
export default function SectionProgress({ progress }) {
  const byType = progress?.by_type ?? [];
  const mistakes = progress?.mistakes ?? [];
  const reread = progress?.reread ?? [];
  if (!byType.some((t) => t.total > 0) && mistakes.length === 0) return null;

  return (
    <div className="block">
      <div className="block-label">Correctness</div>

      {byType.length > 0 && (
        <div className="type-list">
          {byType.map((t) => (
            <div className="type-row" key={t.type}>
              <span className="type-name">{typeLabel(t.type)}</span>
              <span className="type-bar">
                <span className="type-bar-fill" style={{ width: formatPercent(t.total ? t.correct / t.total : 0) }} />
              </span>
              <span className="row-mono">
                {t.correct}/{t.total} · {formatPercent(t.total ? t.correct / t.total : null)}
              </span>
            </div>
          ))}
        </div>
      )}

      {reread.length > 0 && (
        <>
          <div className="block-header mistakes-header">
            <div className="block-label">Worth re-reading</div>
            <div className="block-count">{reread.length}</div>
          </div>
          <div className="row-list">
            {reread.map((r) => (
              <div className="mistake" key={r.anchor_section}>
                <div className="mistake-stem">{r.anchor_section}</div>
                <div className="mistake-line mistake-wrong">
                  {r.mistake_count} {r.mistake_count === 1 ? 'question' : 'questions'} still wrong
                </div>
                {r.excerpts.map((text) => (
                  <div className="mistake-explain" key={text}>{text}</div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {mistakes.length > 0 && (
        <>
          <div className="block-header mistakes-header">
            <div className="block-label">Still to fix</div>
            <div className="block-count">{mistakes.length}</div>
          </div>
          <div className="row-list">
            {mistakes.map((m) => (
              <div className="mistake" key={m.question_id}>
                <div className="mistake-stem">{m.stem}</div>
                <div className="mistake-line mistake-wrong">You answered: {m.options[m.selected_index]}</div>
                <div className="mistake-line mistake-right">Correct: {m.options[m.answer_index]}</div>
                {m.explanation && <div className="mistake-explain">{m.explanation}</div>}
                {m.anchor_section && <div className="mistake-explain">Re-read: {m.anchor_section}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
