import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourses } from '../data/CoursesContext.jsx';
import { PlusIcon, UploadIcon, DocIcon, CloseIcon } from './Icons.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import { fileSummary } from './fileSummary.js';
import './MainMenu.css';

const EMPTY_FORM = { code: '', syllabus: null, materials: [] };

export default function MainMenu() {
  const { courses, addCourse } = useCourses();
  const navigate = useNavigate();
  const createCardRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  function handleOpen() {
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const err = addCourse(form);
    if (err) return setError(err);
    navigate(`/course/${encodeURIComponent(form.code.trim().toUpperCase().replace(/\s+/g, ''))}`);
  }

  return (
    <div className="page menu-page">
      <div className="menu-header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Coursebook</span>
        </div>
        <button className="btn">
          <UploadIcon />
          Import
        </button>
      </div>

      <div className="menu-label">Your courses · {courses.length}</div>

      <div className="menu-grid">
        <button
          type="button"
          ref={createCardRef}
          aria-label="Create new course"
          className="course-card create-card"
          onClick={handleOpen}
        >
          <PlusIcon />
        </button>

        {courses.map((course) => (
          <Link key={course.code} to={`/course/${encodeURIComponent(course.code)}`} className="course-card">
            <CourseCardBody course={course} />
          </Link>
        ))}
      </div>

      <FloatingWindow
        originRef={createCardRef}
        open={open}
        onClose={() => setOpen(false)}
        collapsed={<PlusIcon />}
      >
        <form className="form-inner" onSubmit={handleSubmit}>
          <div className="form-header">
            <div className="form-title">New course</div>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              <CloseIcon />
              Cancel
            </button>
          </div>

          <div className="form-fields">
            <label className="field">
              <span className="field-label">Course code</span>
              <input
                type="text"
                placeholder="e.g. MAT235"
                value={form.code}
                onChange={(e) => setField('code', e.target.value)}
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">Course outline</span>
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setField('syllabus', e.target.files[0] ?? null)}
              />
              <div className="file-drop">
                <span>{form.syllabus ? form.syllabus.name : 'Required · PDF'}</span>
                <span className="file-drop-cta">
                  <UploadIcon />
                  {form.syllabus ? 'Replace' : 'Upload'}
                </span>
              </div>
            </label>

            <label className="field">
              <span className="field-label">Course material</span>
              <input
                type="file"
                accept=".pdf,.ppt,.pptx"
                multiple
                hidden
                onChange={(e) => setField('materials', [...e.target.files])}
              />
              <div className="file-drop">
                <span>{fileSummary(form.materials, 'Optional · slides or PDFs')}</span>
                <span className="file-drop-cta">
                  <UploadIcon />
                  {form.materials.length ? 'Replace' : 'Upload'}
                </span>
              </div>
            </label>
          </div>

          <div className="form-footer">
            <div className="form-error">{error}</div>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </FloatingWindow>
    </div>
  );
}

function CourseCardBody({ course }) {
  return (
    <>
      <div>
        <div className="course-code">{course.code}</div>
        <div className="course-title">{course.title}</div>
      </div>
      <div className="course-meta">
        <DocIcon />
        {course.sections.length > 0
          ? `${course.sections.length} sections · ${course.sections.reduce((n, s) => n + s.decks, 0)} slides`
          : 'No sections yet'}
      </div>
    </>
  );
}
