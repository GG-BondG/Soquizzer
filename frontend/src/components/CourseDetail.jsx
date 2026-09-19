import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, friendlyError, subjectLabel } from '../api.js';
import { formatDate, formatPercent, typeLabel } from '../format.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetContext.jsx';
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
  const sections = useApi(() => api.sections.list(courseId), [courseId]);
  const progress = useApi(() => api.courses.progress(courseId), [courseId]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(null); // filename while an upload is in flight
  const [uploadError, setUploadError] = useState('');

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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
