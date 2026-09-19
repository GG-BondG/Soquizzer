import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, friendlyError, subjectLabel } from '../api.js';
import { formatDate } from '../format.js';
import { useApi } from '../useApi.js';
import { usePet } from '../pet/PetProvider.jsx';
import { BackIcon, ChevronIcon, CloseIcon, DocIcon, PlusIcon, UploadIcon } from './Icons.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import QuizModeBox from './QuizModeBox.jsx';

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

  const addSectionRef = useRef(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [sectionBusy, setSectionBusy] = useState(false);
  const sectionFileRef = useRef(null);
  const [sectionFiles, setSectionFiles] = useState([]); // the section's PDFs still to upload
  const [sectionProgress, setSectionProgress] = useState('');
  const [createdSection, setCreatedSection] = useState(null); // set once the section exists, so a retry only re-uploads

  const [pendingDelete, setPendingDelete] = useState(null); // { kind, id, name }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function openSectionForm() {
    setSectionName('');
    setSectionFiles([]);
    setCreatedSection(null);
    setSectionError('');
    setSectionOpen(true);
  }

  // A section needs at least one PDF. Create it, then upload the PDFs to it one at a time. If none of them can be
  // read the section is removed again, so a section never exists without material (its quizzes are written from it).
  async function submitSection(e) {
    e.preventDefault();
    if (!createdSection && sectionFiles.length === 0) {
      setSectionError('Add at least one PDF as course material for this section.');
      return;
    }
    setSectionBusy(true);
    setSectionError('');
    try {
      let section = createdSection;
      if (!section) {
        const created = await api.sections.create(courseId, sectionName);
        section = { ...created, readCount: 0 };
        setCreatedSection(section);
        sections.reload();
      }

      const failed = [];
      let readCount = section.readCount;
      for (let i = 0; i < sectionFiles.length; i++) {
        const file = sectionFiles[i];
        setSectionProgress(`Reading “${file.name}” (${i + 1} of ${sectionFiles.length})…`);
        pet.loading('Reading your PDFs… this can take a little while.');
        try {
          await api.materials.upload(section.id, file);
          readCount++;
        } catch (err) {
          failed.push({ file, message: friendlyError(err, { 415: 'not a PDF', 413: 'too large' }) });
        }
      }
      const failureText = failed.map((f) => `${f.file.name} (${f.message})`).join('; ');

      if (readCount === 0) {
        // nothing could be read: take the section back out, and keep the files listed so the student can retry
        await api.sections.remove(section.id).catch(() => {});
        setCreatedSection(null);
        sections.reload();
        setSectionFiles(failed.map((f) => f.file));
        setSectionError(`None of the files could be read, so the section was not created: ${failureText}`);
        pet.error('I could not read those files.');
        return;
      }

      setCreatedSection({ ...section, readCount });
      if (failed.length > 0) {
        // keep the section, and leave only the files that failed so pressing the button again retries just those
        setSectionFiles(failed.map((f) => f.file));
        setSectionError(
          `The section was created, but ${failed.length === 1 ? '1 file' : `${failed.length} files`} could not be read: ${failureText}`
        );
        pet.error('Some files did not work.');
        return;
      }
      pet.success('Section added, and I read your materials!');
      setSectionOpen(false);
    } catch (err) {
      setSectionError(err.message);
      pet.error('That did not work.');
    } finally {
      setSectionBusy(false);
      setSectionProgress('');
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

      <div className="quiz-row">
        <QuizModeBox mode="trivia" sections={sections.error ? [] : sections.data} />
        <QuizModeBox mode="mock" sections={sections.error ? [] : sections.data} />
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
                  disabled={sectionBusy || !!createdSection}
                />
              </label>

              <div className="field">
                <span className="field-label">Course Materials</span>
                <button
                  type="button"
                  className="file-drop file-drop-button"
                  onClick={() => sectionFileRef.current.click()}
                  disabled={sectionBusy}
                >
                  <span>
                    {sectionFiles.length > 0
                      ? `${sectionFiles.length} file${sectionFiles.length === 1 ? '' : 's'} selected`
                      : 'Required · one or more PDFs'}
                  </span>
                  <span className="file-drop-cta">
                    <UploadIcon />
                    {sectionFiles.length > 0 ? 'Add more' : 'Upload'}
                  </span>
                </button>
                <input
                  ref={sectionFileRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  hidden
                  onChange={(e) => {
                    const picked = [...e.target.files]; // copy first: clearing the input below empties its FileList
                    setSectionFiles((prev) => [...prev, ...picked]);
                    setSectionError('');
                    e.target.value = ''; // allow picking the same file again
                  }}
                />
                {sectionFiles.length > 0 && (
                  <div className="file-chips">
                    {sectionFiles.map((f, i) => (
                      <span className="file-chip" key={`${f.name}-${i}`}>
                        <DocIcon />
                        <span className="file-chip-name">{f.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          disabled={sectionBusy}
                          onClick={() => setSectionFiles((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <CloseIcon width={12} height={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-footer">
              {sectionBusy && sectionProgress ? (
                <div className="form-progress">{sectionProgress}</div>
              ) : (
                <div className="form-error">{sectionError}</div>
              )}
              <button type="submit" className="btn btn-primary" disabled={sectionBusy}>
                {sectionBusy ? (sectionProgress ? 'Reading…' : 'Creating…') : createdSection ? 'Retry uploads' : 'Create'}
              </button>
            </div>
          </form>
        </FloatingWindow>
      </div>

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
