// Thin wrapper around the backend REST API (see backend/app/controller/API.md).
// Every call resolves to parsed JSON (or null for 204) and rejects with an ApiError
// whose `message` is always human-readable.

// Override with VITE_API_URL in frontend/.env.local (see .env.example).
export const BASE_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 30_000;
// Uploading a PDF and generating a quiz both wait on Gemini: seconds to tens of seconds.
const LONG_TIMEOUT_MS = 180_000;

export const SUBJECTS = [
  { value: 'MATH', label: 'Math' },
  { value: 'PHYSICS', label: 'Physics' },
  { value: 'CHEMISTRY', label: 'Chemistry' },
  { value: 'BIOLOGY', label: 'Biology' },
  { value: 'COMPUTER_SCIENCE', label: 'Computer science' },
  { value: 'ENGLISH', label: 'English' },
  { value: 'HISTORY', label: 'History' },
  { value: 'GEOGRAPHY', label: 'Geography' },
  { value: 'ECONOMICS', label: 'Economics' },
  { value: 'OTHER', label: 'Other' },
];

export function subjectLabel(value) {
  return SUBJECTS.find((s) => s.value === value)?.label ?? value;
}

export class ApiError extends Error {
  constructor(message, { status = 0, detail = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status, or 0 for network failures and timeouts
    this.detail = detail;
  }
}

// `detail` is a string for business errors and an array of
// {loc, msg, ...} objects for 422 validation failures. Turn either into text.
export function formatDetail(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const msg = item?.msg ?? JSON.stringify(item);
        const field = Array.isArray(item?.loc)
          ? item.loc.filter((part) => !['body', 'query', 'path'].includes(part)).join('.')
          : '';
        return field ? `${field[0].toUpperCase()}${field.slice(1)}: ${msg}` : msg;
      })
      .join('; ');
  }
  return null;
}

// Pick a friendlier message for specific statuses, falling back to the server's text.
export function friendlyError(err, byStatus = {}) {
  if (err instanceof ApiError && byStatus[err.status]) return byStatus[err.status];
  return err?.message || 'Something went wrong.';
}

async function request(path, { method = 'GET', json, form, params, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const init = { method, signal: controller.signal };
  if (json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(json);
  } else if (form) {
    init.body = form; // the browser sets the multipart boundary itself
  }

  let res;
  let text;
  try {
    res = await fetch(url, init);
    text = await res.text();
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new ApiError(`The request timed out after ${Math.round(timeout / 1000)}s. The server may still be working, so check back shortly.`);
    }
    throw new ApiError(`Can't reach the server at ${BASE_URL}. Is the backend running?`);
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const detail = body?.detail ?? null;
    throw new ApiError(formatDetail(detail) ?? `Request failed (${res.status} ${res.statusText}).`, {
      status: res.status,
      detail,
    });
  }
  return body;
}

const id = encodeURIComponent;

export const api = {
  courses: {
    list: () => request('/api/courses'),
    get: (courseId) => request(`/api/courses/${id(courseId)}`),
    create: ({ name, subject }) => request('/api/courses', { method: 'POST', json: { name, subject } }),
    remove: (courseId) => request(`/api/courses/${id(courseId)}`, { method: 'DELETE' }),
    progress: (courseId) => request(`/api/courses/${id(courseId)}/progress`),
  },
  materials: {
    list: (courseId) => request(`/api/courses/${id(courseId)}/materials`),
    upload: (courseId, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`/api/courses/${id(courseId)}/materials`, { method: 'POST', form, timeout: LONG_TIMEOUT_MS });
    },
    remove: (materialId) => request(`/api/materials/${id(materialId)}`, { method: 'DELETE' }),
  },
  groups: {
    list: (courseId) => request(`/api/courses/${id(courseId)}/groups`),
    get: (groupId) => request(`/api/groups/${id(groupId)}`),
    create: (courseId, name) => request(`/api/courses/${id(courseId)}/groups`, { method: 'POST', json: { name } }),
    remove: (groupId) => request(`/api/groups/${id(groupId)}`, { method: 'DELETE' }),
  },
  quizzes: {
    list: (groupId) => request(`/api/groups/${id(groupId)}/quizzes`),
    get: (quizId) => request(`/api/quizzes/${id(quizId)}`),
    // Takes no parameters: the backend picks the questions itself.
    create: (groupId) => request(`/api/groups/${id(groupId)}/quizzes`, { method: 'POST', timeout: LONG_TIMEOUT_MS }),
    submit: (quizId, { answers, timeSpentSeconds }) =>
      request(`/api/quizzes/${id(quizId)}/submissions`, {
        method: 'POST',
        json: { answers, time_spent_seconds: timeSpentSeconds },
      }),
  },
  history: {
    list: ({ courseId, groupId, limit } = {}) =>
      request('/api/history', { params: { course_id: courseId, group_id: groupId, limit } }),
    attempt: (attemptId) => request(`/api/attempts/${id(attemptId)}`),
  },
};
