import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, subjectLabel } from '../api.js';
import { formatDate, formatPercent, typeLabel } from '../format.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetProvider.jsx';
import { BackIcon, ChevronIcon, CloseIcon, PlusIcon } from './Icons.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import './CourseDetail.css';

const DELETE_COPY = {
  course: {
    title: (name) => `Delete “${name}”?`,
    body: 'This permanently deletes the course along with its sections, their PDFs, quizzes and attempt history.',
  },
  section: {
    title: (name) => `Delete section “${name}”?`,
    body: 'This also deletes its PDFs, quizzes and their attempt history.',
  },
};

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const pet = usePet();

  const course = useApi(() => api.courses.get(courseId), [courseId]);
  const sections = useApi(() => api.sections.list(courseId), [courseId]);
  const progress = useApi(() => api.courses.progress(courseId), [courseId]);

  const addSectionRef = useRef(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [sectionBusy, setSectionBusy] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null); // { kind, id, name }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function openSectionForm() {
    setSectionName('');
    setSectionError('');
    setSectionOpen(true);
  }

  async function submitSection(e) {
    e.preventDefault();
    setSectionBusy(true);
    try {
      await api.sections.create(courseId, sectionName);
      setSectionOpen(false);
      sections.reload();
    } catch (err) {
      setSectionError(err.message);
    } finally {
      setSectionBusy(false);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setDeleting(true);
    setDeleteError('');
    try {
      if (target.kind === 'course') {
        await api.courses.remove(target.id);
        pet.success('Course deleted.');
        navigate('/');
        return;
      }
      await api.sections.remove(target.id);
      sections.reload();
      progress.reload();
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (course.error) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="error-note">
          {course.error.status === 404 ? 'This course does not exist (it may have been deleted).' : course.error.message}
          {course.error.status !== 404 && (
            <div>
              <button type="button" className="btn btn-small" onClick={course.reload}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!course.data) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="status-note">Loading…</div>
      </div>
    );
  }

  const c = course.data;
  const copy = pendingDelete && DELETE_COPY[pendingDelete.kind];
  const hasProgress = progress.data && (progress.data.by_type.some((t) => t.total > 0) || progress.data.mistakes.length > 0);

  return (
    <div className="page detail-page">
      <Link to="/" className="back-link">
        <BackIcon /> Courses
      </Link>

      <div className="detail-title-row">
        <div className="detail-title">
          <span className="detail-code">{c.name}</span>
          <span className="pill">{subjectLabel(c.subject)}</span>
        </div>
        <div className="detail-actions">
          <button type="button" className="btn btn-danger" onClick={() => setPendingDelete({ kind: 'course', id: c.id, name: c.name })}>
            Delete course
          </button>
        </div>
      </div>

      <div className="block">
        <div className="block-header">
          <div className="block-label">Sections</div>
          {sections.data && <div className="block-count">{sections.data.length} total</div>}
        </div>

        {sections.error && (
          <div className="error-note">
            {sections.error.message}
            <div>
              <button type="button" className="btn btn-small" onClick={sections.reload}>
                Try again
              </button>
            </div>
          </div>
        )}

        <div className="row-list">
          {(sections.data ?? []).map((g, i) => (
            <div className="row" key={g.id}>
              <Link to={`/section/${g.id}`} className="row-link">
                <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="row-title">{g.name}</span>
                <span className="row-meta">{formatDate(g.created_at)}</span>
                <ChevronIcon stroke="var(--text-3)" />
              </Link>
              <button
                type="button"
                className="row-action"
                onClick={() => setPendingDelete({ kind: 'section', id: g.id, name: g.name })}
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <button type="button" ref={addSectionRef} className="add-row" onClick={openSectionForm}>
          <PlusIcon width={14} height={14} />
          Add section
        </button>

        <FloatingWindow
          originRef={addSectionRef}
          open={sectionOpen}
          onClose={() => !sectionBusy && setSectionOpen(false)}
          collapsed={
            <>
              <PlusIcon width={14} height={14} />
              Add section
            </>
          }
        >
          <form className="form-inner" onSubmit={submitSection}>
            <div className="form-header">
              <div className="form-title">New section</div>
              <button type="button" className="btn" onClick={() => setSectionOpen(false)} disabled={sectionBusy}>
                <CloseIcon />
                Cancel
              </button>
            </div>

            <div className="form-fields">
              <label className="field">
                <span className="field-label">Section name</span>
                <input
                  type="text"
                  placeholder="e.g. Chapter 1"
                  value={sectionName}
                  onChange={(e) => {
                    setSectionName(e.target.value);
                    setSectionError('');
                  }}
                  autoFocus
                />
              </label>
            </div>

            <div className="form-footer">
              <div className="form-error">{sectionError}</div>
              <button type="submit" className="btn btn-primary" disabled={sectionBusy}>
                {sectionBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </FloatingWindow>
      </div>

      {hasProgress && <Progress progress={progress.data} />}

      <ConfirmDialog
        open={!!pendingDelete}
        title={copy ? copy.title(pendingDelete.name) : ''}
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError('');
        }}
      >
        {copy?.body}
      </ConfirmDialog>
    </div>
  );
}

function Progress({ progress }) {
  const { by_type: byType, mistakes } = progress;
  const reread = progress.reread ?? [];
  return (
    <div className="block">
      <div className="block-label">Progress</div>

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
