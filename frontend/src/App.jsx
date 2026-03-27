import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './context/AuthContext';
import BottomNav from './components/BottomNav';
import useScreenTimeTracker from './hooks/useScreenTimeTracker';
import Home from './pages/Home';
import Symptoms from './pages/Symptoms';
import Analysis from './pages/Analysis';
import Chat from './pages/Chat';
import Auth from './pages/Auth';

function AppContent() {
  useScreenTimeTracker();

  return (
    <div className="app-container">
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/symptoms" element={<ProtectedRoute><Symptoms /></ProtectedRoute>} />
        <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
