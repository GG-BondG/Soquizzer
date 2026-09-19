import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, friendlyError } from '../api.js';
import { formatDate } from '../format.js';
import { QUIZ_MODES } from '../quizModes.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetProvider.jsx';
import { BackIcon, ChevronIcon, DocIcon, UploadIcon } from './Icons.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

export default function SectionDetail() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const pet = usePet();

  const section = useApi(() => api.sections.get(sectionId), [sectionId]);
  const course = useApi(() => (section.data ? api.courses.get(section.data.course_id) : null), [section.data?.course_id]);
  const quizzes = useApi(() => api.quizzes.list(sectionId), [sectionId]);
  const materials = useApi(() => api.materials.list(sectionId), [sectionId]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(null); // filename while an upload is in flight
  const [uploadError, setUploadError] = useState('');
  const [pendingRemove, setPendingRemove] = useState(null); // the PDF being removed
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const [creating, setCreating] = useState(null); // 'trivia' | 'mock' while that kind of quiz is being generated
  const [createError, setCreateError] = useState(null); // { status, message, mode }

  async function newQuiz(mode) {
    setCreating(mode);
    setCreateError(null);
    pet.loading('Writing 20 questions for you… hang tight!');
    try {
      const quiz = await api.quizzes.create(sectionId, { type: QUIZ_MODES[mode].apiType });
      pet.success('Your quiz is ready. Good luck!');
      // the response already holds the questions, so hand them over instead of refetching
      navigate(`/quiz/${quiz.id}`, { state: { quiz, mode } });
    } catch (err) {
      setCreateError({ status: err.status, message: err.message, mode });
      pet.error(err.status === 409 ? 'I need some material first.' : 'That did not work.');
      setCreating(null);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setUploading(file.name);
    setUploadError('');
    pet.loading('Reading your PDF… this can take a little while.');
    try {
      await api.materials.upload(sectionId, file);
      pet.success('Got it! I read your PDF.');
      materials.reload();
    } catch (err) {
      setUploadError(friendlyError(err, { 415: 'Only PDF files can be uploaded.', 413: 'That PDF is too large.' }));
      pet.error('I could not read that file.');
    } finally {
      setUploading(null);
    }
  }

  async function confirmRemove() {
    setRemoving(true);
    setRemoveError('');
    try {
      await api.materials.remove(pendingRemove.id);
      materials.reload();
      setPendingRemove(null);
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  if (section.error) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="error-note">
          {section.error.status === 404 ? 'This section does not exist (it may have been deleted).' : section.error.message}
        </div>
      </div>
    );
  }

  if (!section.data) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <div className="status-note">Loading…</div>
      </div>
    );
  }

  const g = section.data;
  const list = quizzes.data ?? [];
  const pdfs = materials.data ?? [];

  return (
    <div className="page detail-page">
      <Link to={`/course/${g.course_id}`} className="back-link">
        <BackIcon /> {course.data?.name ?? 'Course'}
      </Link>

      <div className="detail-title-row">
        <div className="detail-title">
          <span className="detail-code">{g.name}</span>
        </div>
        <div className="detail-actions">
          {Object.entries(QUIZ_MODES).map(([mode, config]) => (
            <button
              key={mode}
              type="button"
              className="btn btn-primary"
              onClick={() => newQuiz(mode)}
              disabled={!!creating || !!uploading || (materials.data && pdfs.length === 0)}
            >
              {creating === mode ? 'Generating…' : `New ${config.label}`}
            </button>
          ))}
        </div>
      </div>

      {creating && (
        <div className="status-note">
          Generating a {QUIZ_MODES[creating].label} quiz from this section’s PDF. This can take up to a minute.
        </div>
      )}

      {createError?.status === 409 && (
        <div className="info-note">
          This section has no PDF yet. Upload one above, then create a quiz.
        </div>
      )}
      {createError && createError.status !== 409 && (
        <div className="error-note">
          {createError.status === 502
            ? 'Generating the quiz failed. Nothing was saved, so it is safe to try again.'
            : createError.message}
          <div>
            <button type="button" className="btn btn-small" onClick={() => newQuiz(createError.mode)} disabled={!!creating}>
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="block">
        <div className="block-header">
          <div className="block-label">Section PDF</div>
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

        {pdfs.length > 0 && (
          <div className="row-list">
            {pdfs.map((m) => (
              <div className="row" key={m.id}>
                <DocIcon />
                <span className="row-title">{m.source_filename}</span>
                <span className="row-meta">{formatDate(m.created_at)}</span>
                <button type="button" className="row-action" onClick={() => setPendingRemove(m)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {materials.data && pdfs.length === 0 && !uploading && (
          <div className="empty-note">Upload this section’s slides or notes as a PDF. Every quiz in this section is written from it.</div>
        )}
      </div>

      <div className="block">
        <div className="block-header">
          <div className="block-label">Quizzes</div>
          {quizzes.data && <div className="block-count">{list.length} total</div>}
        </div>

        {quizzes.error && (
          <div className="error-note">
            {quizzes.error.message}
            <div>
              <button type="button" className="btn btn-small" onClick={quizzes.reload}>
                Try again
              </button>
            </div>
          </div>
        )}

        {list.length > 0 && (
          <div className="row-list">
            {list.map((q, i) => (
              <div className="row" key={q.id}>
                {/* the list is newest first, so number from the bottom */}
                <Link to={`/quiz/${q.id}`} className="row-link">
                  <span className="row-index">{String(list.length - i).padStart(2, '0')}</span>
                  <span className="row-title">Quiz {list.length - i}</span>
                  <span className="row-meta">
                    {q.question_count} questions · {q.attempt_count} attempt{q.attempt_count === 1 ? '' : 's'}
                  </span>
                  <span className="row-meta">{formatDate(q.created_at, { time: true })}</span>
                  <ChevronIcon stroke="var(--text-3)" />
                </Link>
              </div>
            ))}
          </div>
        )}
        {quizzes.data && list.length === 0 && <div className="empty-note">No quizzes yet. Press “New Trivia” or “New Mock Test” to generate the first one.</div>}
      </div>

      <ConfirmDialog
        open={!!pendingRemove}
        title={pendingRemove ? `Remove “${pendingRemove.source_filename}”?` : ''}
        busy={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => {
          setPendingRemove(null);
          setRemoveError('');
        }}
      >
        This removes the PDF from this section. Quizzes already made stay, but new ones need another PDF.
      </ConfirmDialog>
    </div>
  );
}
