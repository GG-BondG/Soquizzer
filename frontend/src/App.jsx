import { Routes, Route } from 'react-router-dom';
import MainMenu from './components/MainMenu.jsx';
import CourseDetail from './components/CourseDetail.jsx';
import QuizTrivia from './components/QuizTrivia.jsx';
import QuizMockExam from './components/QuizMockExam.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/course/:code" element={<CourseDetail />} />
      <Route path="/course/:code/trivia" element={<QuizTrivia />} />
      <Route path="/course/:code/exam" element={<QuizMockExam />} />
    </Routes>
  );
}
