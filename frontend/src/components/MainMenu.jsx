import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, SUBJECTS, subjectLabel } from '../api.js';
import { MAX_ATTEMPTS } from '../activity.js';
import { formatDate } from '../format.js';
import { useApi } from '../useApi.js';
import { useAssistant } from '../pet/PetProvider.jsx';
import { PlusIcon, ClockIcon, DocIcon, CloseIcon } from './Icons.jsx';
import FloatingWindow from './FloatingWindow.jsx';
import ActivityHeatmap from './ActivityHeatmap.jsx';
import PowerRadar from './PowerRadar.jsx';
import logo from '../../resources/200_001-removebg-preview.png';
import './MainMenu.css';

const EMPTY_FORM = { name: '', subject: 'OTHER' };

export default function MainMenu() {
  const { data: courses, error: loadError, loading, reload } = useApi(() => api.courses.list(), []);
  // one request feeds both the heatmap and the power chart
  const history = useApi(() => api.history.list({ limit: MAX_ATTEMPTS }), []);
  const navigate = useNavigate();
  const assistant = useAssistant();
  const createCardRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleOpen() {
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const course = await api.courses.create(form);
      assistant.success(`${course.name} is ready. Upload a PDF next!`);
      navigate(`/course/${course.id}`);
    } catch (err) {
      setError(err.message);
      assistant.error('That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page menu-page">
      <div className="menu-header">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="" />
          <span className="brand-name">Soquizzer</span>
        </div>
        <Link to="/history" className="btn">
          <ClockIcon />
          History
        </Link>
      </div>

      <div className="insights">
        <ActivityHeatmap history={history} />
        <PowerRadar history={history} />
      </div>

      <div className="menu-label">Your courses{courses ? ` · ${courses.length}` : ''}</div>

      {loadError && (
        <div className="error-note">
          {loadError.message}
          <div>
            <button type="button" className="btn btn-small" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      )}
      {loading && !courses && <div className="status-note">Loading courses…</div>}

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

        {(courses ?? []).map((course) => (
          <Link key={course.id} to={`/course/${course.id}`} className="course-card">
            <div>
              <div className="course-code">{course.name}</div>
              <div className="course-title">{subjectLabel(course.subject)}</div>
            </div>
            <div className="course-meta">
              <DocIcon />
              Created {formatDate(course.created_at)}
            </div>
          </Link>
        ))}
      </div>

      <FloatingWindow originRef={createCardRef} open={open} onClose={() => !busy && setOpen(false)} collapsed={<PlusIcon style={{ color: 'var(--brand)' }} />}>
        <form className="form-inner" onSubmit={handleSubmit}>
          <div className="form-header">
            <div className="form-title">New course</div>
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>
              <CloseIcon />
              Cancel
            </button>
          </div>

          <div className="form-fields">
            <label className="field">
              <span className="field-label">Course name</span>
              <input
                type="text"
                placeholder="e.g. Biology 101"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">Subject</span>
              <select value={form.subject} onChange={(e) => setField('subject', e.target.value)}>
                {SUBJECTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-footer">
            <div className="form-error">{error}</div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </FloatingWindow>
    </div>
  );
}
