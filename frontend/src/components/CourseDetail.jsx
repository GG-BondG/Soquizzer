import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, friendlyError, subjectLabel } from '../api.js';
import { formatDate, formatPercent, typeLabel } from '../format.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetProvider.jsx';
import { BackIcon, ChevronIcon, CloseIcon, DocIcon, PlusIcon, UploadIcon } from './Icons.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import './CourseDetail.css';

const DELETE_COPY = {
  course: {
    title: (name) => `Delete “${name}”?`,
    body: 'This permanently deletes the course along with its materials, sections, quizzes and attempt history.',
  },
  material: {
    title: (name) => `Remove “${name}”?`,
    body: 'This removes the material from the course.',
  },
  textbook: {
    title: (name) => `Remove “${name}”?`,
    body: 'This removes the textbook from this course. The file stays uploaded and can be added to other courses.',
  },
  section: {
    title: (name) => `Delete section “${name}”?`,
    body: 'This also deletes its quizzes and their attempt history.',
  },
};

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const pet = usePet();

  const course = useApi(() => api.courses.get(courseId), [courseId]);
  const materials = useApi(() => api.materials.list(courseId), [courseId]);
  const textbooks = useApi(() => api.textbooks.list(courseId), [courseId]);
  const sections = useApi(() => api.sections.list(courseId), [courseId]);
  const progress = useApi(() => api.courses.progress(courseId), [courseId]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(null); // filename while an upload is in flight
  const [uploadError, setUploadError] = useState('');

  const textbookInputRef = useRef(null);
  const [textbookUploading, setTextbookUploading] = useState(null); // filename while an upload is in flight
  const [textbookError, setTextbookError] = useState('');

  // A textbook is read in the background after upload; keep checking until none is still processing.
  const textbookReload = textbooks.reload;
  const stillProcessing = textbooks.data?.some((t) => t.status === 'PROCESSING');
  useEffect(() => {
    if (!stillProcessing) return undefined;
    const timer = setTimeout(textbookReload, 3000);
    return () => clearTimeout(timer);
  }, [stillProcessing, textbooks.data, textbookReload]);

  const addSectionRef = useRef(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [sectionBusy, setSectionBusy] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null); // { kind, id, name }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleUpload(e) {
    const file = e.target.files[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setUploading(file.name);
    setUploadError('');
    pet.loading('Reading your PDF… this can take a little while.');
    try {
      await api.materials.upload(courseId, file);
      pet.success('Got it! I read your material.');
      materials.reload();
    } catch (err) {
      setUploadError(friendlyError(err, { 415: 'Only PDF files can be uploaded.' }));
      pet.error('I could not read that file.');
    } finally {
      setUploading(null);
    }
  }

  async function handleTextbookUpload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setTextbookUploading(file.name);
    setTextbookError('');
    pet.loading('Uploading your textbook…');
    try {
      await api.textbooks.upload(courseId, file);
      pet.success('Got it! I will read the textbook in the background.');
      textbooks.reload();
    } catch (err) {
      setTextbookError(friendlyError(err, { 415: 'Textbooks can be PDF, TXT or Markdown files.', 413: 'That file is too large.' }));
      pet.error('I could not take that textbook.');
    } finally {
      setTextbookUploading(null);
    }
  }

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
      if (target.kind === 'material') {
        await api.materials.remove(target.id);
        materials.reload();
      } else if (target.kind === 'textbook') {
        await api.textbooks.detach(courseId, target.id);
        textbooks.reload();
      } else {
        await api.sections.remove(target.id);
        sections.reload();
        progress.reload();
      }
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
          <div className="block-label">Course material</div>
          <button type="button" className="btn btn-small" onClick={() => fileInputRef.current.click()} disabled={!!uploading}>
            <UploadIcon />
            {uploading ? 'Uploading…' : 'Upload PDF'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={handleUpload} />
        </div>

        {uploading && <div className="status-note">Reading “{uploading}”. This can take up to a minute.</div>}
        {uploadError && <div className="error-note">{uploadError}</div>}
        {materials.error && (
          <div className="error-note">
            {materials.error.message}
            <div>
              <button type="button" className="btn btn-small" onClick={materials.reload}>
                Try again
              </button>
            </div>
          </div>
        )}

        {materials.data && materials.data.length > 0 && (
          <div className="row-list">
            {materials.data.map((m) => (
              <div className="row" key={m.id}>
                <DocIcon />
                <span className="row-title">{m.source_filename}</span>
                <span className="row-meta">{formatDate(m.created_at)}</span>
                <button
                  type="button"
                  className="row-action"
                  onClick={() => setPendingDelete({ kind: 'material', id: m.id, name: m.source_filename })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {materials.data && materials.data.length === 0 && !uploading && (
          <div className="empty-note">Upload your slides or notes as a PDF. Quizzes are generated from them.</div>
        )}
      </div>

      <div className="block">
        <div className="block-header">
          <div className="block-label">Textbooks</div>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => textbookInputRef.current.click()}
            disabled={!!textbookUploading}
          >
            <UploadIcon />
            {textbookUploading ? 'Uploading…' : 'Add textbook'}
          </button>
          <input
            ref={textbookInputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            hidden
            onChange={handleTextbookUpload}
          />
        </div>

        {textbookError && <div className="error-note">{textbookError}</div>}
        {textbooks.error && (
          <div className="error-note">
            {textbooks.error.message}
            <div>
              <button type="button" className="btn btn-small" onClick={textbooks.reload}>
                Try again
              </button>
            </div>
          </div>
        )}

        {textbooks.data && textbooks.data.length > 0 && (
          <div className="row-list">
            {textbooks.data.map((t) => (
              <div className="row" key={t.id}>
                <DocIcon />
                <span className="row-title">{t.original_name}</span>
                <span className="row-meta">
                  {t.status === 'PROCESSING' && 'Reading…'}
                  {t.status === 'READY' && 'Ready'}
                  {t.status === 'FAILED' && `Failed${t.error ? `: ${t.error}` : ''}`}
                </span>
                <button
                  type="button"
                  className="row-action"
                  onClick={() => setPendingDelete({ kind: 'textbook', id: t.id, name: t.original_name })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {textbooks.data && textbooks.data.length === 0 && !textbookUploading && (
          <div className="empty-note">
            Optional: add a textbook (PDF, TXT or Markdown). Quizzes then also draw on the passages that match each
            section. A scanned PDF works too, but takes longer to read.
          </div>
        )}
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
