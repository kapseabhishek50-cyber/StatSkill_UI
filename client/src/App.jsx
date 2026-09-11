import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AdminCourses from './pages/admin/Courses.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminOfficers from './pages/admin/Officers.jsx';
import AdminQuestionBank from './pages/admin/QuestionBank.jsx';
import Assessment from './pages/learner/Assessment.jsx';
import Dashboard from './pages/learner/Dashboard.jsx';
import LearningPath from './pages/learner/LearningPath.jsx';
import MyLearning from './pages/learner/MyLearning.jsx';
import Profile from './pages/learner/Profile.jsx';
import Quiz from './pages/learner/Quiz.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Assistant from './pages/learner/Assistant.jsx';
import Progress from './pages/learner/Progress.jsx';
import Streak from './pages/learner/Streak.jsx';
import Discussions from './pages/learner/Discussions.jsx';
import Leaderboard from './pages/learner/Leaderboard.jsx';
import TrainerDashboard from './pages/trainer/Dashboard.jsx';
import QuizGenerator from './pages/trainer/QuizGenerator.jsx';
import CloudShaderDemo from './components/cloud-shader-demo.jsx';

// The public landing ships its own chunk (three.js lives behind this import),
// so authenticated app users never download the 3D engine.
const FoldcraftHero = lazy(() => import('./components/FoldcraftHero.jsx'));
const LandingFallback = () => (
  <div className="grid min-h-screen place-items-center bg-plane">
    <p className="text-sm font-medium text-ink-muted">Loading StatSkill AI…</p>
  </div>
);

export default function App() {
  const { isAdmin, isTrainer } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Role landing page: admins to workforce analytics, trainers to trainer portal, learners to dashboard */}
        <Route
          index
          element={
            isAdmin ? (
              <Navigate to="/admin" replace />
            ) : isTrainer ? (
              <Navigate to="/trainer" replace />
            ) : (
              <Dashboard />
            )
          }
        />
        <Route path="profile" element={<Profile />} />
        <Route path="assessment" element={<Assessment />} />
        <Route path="path" element={<LearningPath />} />
        <Route path="my-learning" element={<MyLearning />} />
        <Route path="progress" element={<Progress />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="quiz/:competencyId" element={<Quiz />} />
        <Route path="streak" element={<Streak />} />
        <Route path="discussions" element={<Discussions />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="shader-demo" element={<CloudShaderDemo />} />

        {/* Trainer & Assessment authoring routes */}
        <Route
          path="trainer"
          element={
            <ProtectedRoute role={['trainer', 'admin']}>
              <TrainerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="trainer/generator"
          element={
            <ProtectedRoute role={['trainer', 'admin']}>
              <QuizGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="trainer/materials"
          element={
            <ProtectedRoute role={['trainer', 'admin']}>
              <TrainerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Workforce & Governance routes */}
        <Route
          path="admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/officers"
          element={
            <ProtectedRoute role="admin">
              <AdminOfficers />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/courses"
          element={
            <ProtectedRoute role="admin">
              <AdminCourses />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/questions"
          element={
            <ProtectedRoute role={['admin', 'trainer']}>
              <AdminQuestionBank />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Public Foldcraft Hero Landing Page (lazy — carries the 3D engine) */}
      <Route
        path="/foldcraft"
        element={
          <Suspense fallback={<LandingFallback />}>
            <FoldcraftHero />
          </Suspense>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
