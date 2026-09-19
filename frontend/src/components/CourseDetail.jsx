import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCourses } from '../data/CoursesContext.jsx';
import {
  BackIcon,
  DocIcon,
  ChevronIcon,
  LightbulbIcon,
  ClipboardIcon,
  UploadIcon,
  PlusIcon,
  CloseIcon,
} from './Icons.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import { fileSummary } from './fileSummary.js';
import './CourseDetail.css';

const EMPTY_SECTION = { title: '', materials: [] };

function formatSize(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function CourseDetail() {
  const { code } = useParams();
  const { getCourse, addSection, addPapers } = useCourses();
  const course = getCourse(code);
  const addSectionRef = useRef(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState(EMPTY_SECTION);
  const [sectionError, setSectionError] = useState('');

  function openSectionForm() {
    setSectionForm(EMPTY_SECTION);
    setSectionError('');
    setSectionOpen(true);
  }

  function setSectionField(name, value) {
    setSectionForm((f) => ({ ...f, [name]: value }));
    setSectionError('');
  }

  function submitSection(e) {
    e.preventDefault();
    const err = addSection(course.code, sectionForm);
    if (err) return setSectionError(err);
    setSectionOpen(false);
  }

  if (!course) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          <BackIcon /> Courses
        </Link>
        <p>Course "{code}" was not found.</p>
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <Link to="/" className="back-link">
        <BackIcon /> Courses
      </Link>

      <div className="detail-title-row">
        <div className="detail-title">
          <span className="detail-code">{course.code}</span>
          <span className="detail-name">{course.title}</span>
        </div>
        <div className="detail-pills">
          {course.syllabus && (
            <span className="pill">
              <DocIcon /> {course.syllabus}
            </span>
          )}
          {course.textbook && <span className="pill">{course.textbook}</span>}
        </div>
      </div>

      <div className="quiz-row">
        <Link to={`/course/${course.code}/trivia`} className="quiz-card quiz-card-trivia">
          <div className="quiz-card-top">
            <span className="quiz-icon quiz-icon-trivia">
              <LightbulbIcon />
            </span>
            <span className="quiz-tag quiz-tag-trivia">Warm-up</span>
          </div>
          <div>
            <div className="quiz-name">Trivia</div>
            <div className="quiz-desc">Playful context questions to open the lesson</div>
          </div>
          <div className="quiz-stat">
            {course.quizStats.trivia
              ? `last · ${course.quizStats.trivia.label} · ${course.quizStats.trivia.time}`
              : 'not attempted yet'}
          </div>
        </Link>

        <Link to={`/course/${course.code}/exam`} className="quiz-card quiz-card-exam">
          <div className="quiz-card-top">
            <span className="quiz-icon quiz-icon-exam">
              <ClipboardIcon />
            </span>
            <span className="quiz-tag quiz-tag-exam">Timed · graded</span>
          </div>
          <div>
            <div className="quiz-name">Mock Exam</div>
            <div className="quiz-desc">Full exam-style questions, generated fresh</div>
          </div>
          <div className="quiz-stat">
            {course.quizStats.exam ? `last · ${course.quizStats.exam.label} · ${course.quizStats.exam.time}` : 'not attempted yet'}
          </div>
        </Link>
      </div>

      <div className="sections-block">
        <div className="block-header">
            <div className="block-label">Sections</div>
            <div className="block-count">{course.sections.length} total</div>
          </div>
          <div className="sections-list">
            {course.sections.map((s, i) => (
              <div className="section-row" key={s.title}>
                <div className="section-index">{String(i + 1).padStart(2, '0')}</div>
                <div className="section-title">{s.title}</div>
                <div className="section-meta">
                  {s.decks > 0 ? `${s.decks} slide deck${s.decks > 1 ? 's' : ''}` : ''}
                  {s.decks > 0 && s.pdfs > 0 ? ' · ' : ''}
                  {s.pdfs > 0 ? `${s.pdfs} PDF${s.pdfs > 1 ? 's' : ''}` : ''}
                </div>
                <ChevronIcon stroke="var(--text-3)" />
              </div>
            ))}
          </div>

          <button type="button" ref={addSectionRef} className="add-section" onClick={openSectionForm}>
            <PlusIcon width={14} height={14} />
            Add section
          </button>

          <FloatingWindow
            originRef={addSectionRef}
            open={sectionOpen}
            onClose={() => setSectionOpen(false)}
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
                <button type="button" className="btn" onClick={() => setSectionOpen(false)}>
                  <CloseIcon />
                  Cancel
                </button>
              </div>

              <div className="form-fields">
                <label className="field">
                  <span className="field-label">Section name</span>
                  <input
                    type="text"
                    placeholder="e.g. Limits and Continuity"
                    value={sectionForm.title}
                    onChange={(e) => setSectionField('title', e.target.value)}
                    autoFocus
                  />
                </label>

                <label className="field">
                  <span className="field-label">Materials</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    hidden
                    onChange={(e) => setSectionField('materials', [...e.target.files])}
                  />
                  <div className="file-drop">
                    <span>{fileSummary(sectionForm.materials, 'PDFs')}</span>
                    <span className="file-drop-cta">
                      <UploadIcon />
                      {sectionForm.materials.length ? 'Replace' : 'Upload'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="form-footer">
                <div className="form-error">{sectionError}</div>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </FloatingWindow>
      </div>

      {(course.materials ?? []).length > 0 && (
        <div className="papers-block">
          <div className="block-header">
            <div className="block-label">Course material</div>
            <div className="block-count">{course.materials.length} files</div>
          </div>
          <div className="activity-list">
            {course.materials.map((m, i) => (
              <div className="activity-row" key={i}>
                <DocIcon />
                <span className="paper-name">{m.name}</span>
                <span className="activity-time">{formatSize(m.size)}</span>
                <span className="activity-date">{new Date(m.addedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="papers-block">
        <div className="block-header">
          <div className="block-label">Uploaded papers</div>
          <label className="btn btn-small">
            <UploadIcon />
            Upload
            <input
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => {
                addPapers(course.code, [...e.target.files]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {(course.papers ?? []).length > 0 ? (
          <div className="activity-list">
            {course.papers.map((p, i) => (
              <div className="activity-row" key={i}>
                <DocIcon />
                <span className="paper-name">{p.name}</span>
                <span className="activity-time">{formatSize(p.size)}</span>
                <span className="activity-date">{new Date(p.addedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-note">Past papers you upload will be used to shape mock exams.</div>
        )}
      </div>

      {course.recentActivity.length > 0 && (
        <div className="activity-block">
          <div className="block-label">Recent activity</div>
          <div className="activity-list">
            {course.recentActivity.map((a, i) => (
              <div className="activity-row" key={i}>
                <span className={`activity-dot activity-dot-${a.type}`} />
                <span className="activity-label">{a.label}</span>
                <span className="activity-result">{a.result}</span>
                <span className="activity-time">{a.time}</span>
                <span className="activity-date">{a.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
