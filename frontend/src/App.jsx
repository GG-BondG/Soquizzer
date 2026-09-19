import { Routes, Route } from 'react-router-dom';
import MainMenu from './components/MainMenu.jsx';
import CourseDetail from './components/CourseDetail.jsx';
import SectionDetail from './components/SectionDetail.jsx';
import QuizPage from './components/QuizPage.jsx';
import HistoryPage from './components/HistoryPage.jsx';
import AttemptDetail from './components/AttemptDetail.jsx';
import StudyPet from './pet/StudyPet.jsx';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/course/:courseId" element={<CourseDetail />} />
        <Route path="/section/:sectionId" element={<SectionDetail />} />
        <Route path="/quiz/:quizId" element={<QuizPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/attempts/:attemptId" element={<AttemptDetail />} />
      </Routes>
      <StudyPet />
    </>
  );
}
