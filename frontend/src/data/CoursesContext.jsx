import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { courses as seedCourses } from './courses.js';

// Front-end course store. Persists to localStorage so courses, quiz history and
// uploaded-paper records survive restarts. Once the backend API exists, replace
// the load/save below with fetch() calls -- consumers only use the hook.
//
// Papers are stored as metadata only ({ name, size, addedAt }); the file bytes
// belong to the backend upload endpoint.

const STORAGE_KEY = 'soquizzer.courses';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt or unavailable storage -- fall back to seed data
  }
  return seedCourses;
}

function toRecord(file) {
  return { name: file.name, size: file.size, addedAt: new Date().toISOString() };
}

const CoursesContext = createContext(null);

export function CoursesProvider({ children }) {
  const [courses, setCourses] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch {
      // storage full/unavailable -- state still works for this session
    }
  }, [courses]);

  const getCourse = useCallback((code) => courses.find((c) => c.code === code), [courses]);

  // `syllabus` is the course outline (a File, required); `materials` is an
  // optional File[]. Returns an error message, or null on success.
  const addCourse = useCallback(
    ({ code, syllabus, materials = [] }) => {
      const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
      if (!normalized) return 'Enter a course code.';
      if (courses.some((c) => c.code === normalized)) return `${normalized} already exists.`;
      if (!syllabus) return 'Upload the course outline.';
      setCourses((prev) => [
        ...prev,
        {
          code: normalized,
          title: '',
          textbook: '',
          syllabus: syllabus.name,
          sections: [],
          materials: materials.map(toRecord),
          papers: [],
          quizStats: { trivia: null, exam: null },
          recentActivity: [],
        },
      ]);
      return null;
    },
    [courses]
  );

  // `materials` is the section's PDFs (File[]). Returns an error message, or null on success.
  const addSection = useCallback(
    (code, { title, materials = [] }) => {
      const name = title.trim();
      if (!name) return 'Enter a section name.';
      const course = courses.find((c) => c.code === code);
      if (course.sections.some((s) => s.title.toLowerCase() === name.toLowerCase())) {
        return `"${name}" already exists.`;
      }
      const section = { title: name, decks: 0, pdfs: materials.length, materials: materials.map(toRecord) };
      setCourses((prev) => prev.map((c) => (c.code === code ? { ...c, sections: [...c.sections, section] } : c)));
      return null;
    },
    [courses]
  );

  const addPapers = useCallback((code, files) => {
    const added = files.map(toRecord);
    setCourses((prev) => prev.map((c) => (c.code === code ? { ...c, papers: [...(c.papers ?? []), ...added] } : c)));
  }, []);

  const value = useMemo(
    () => ({ courses, getCourse, addCourse, addSection, addPapers }),
    [courses, getCourse, addCourse, addSection, addPapers]
  );

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>;
}

export function useCourses() {
  return useContext(CoursesContext);
}
