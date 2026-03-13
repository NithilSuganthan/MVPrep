import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SubjectsList from './pages/SubjectsList';
import SubjectDetail from './pages/SubjectDetail';
import Planner from './pages/Planner';
import Settings from './pages/Settings';
import FocusTimer from './pages/FocusTimer';
import Notes from './pages/Notes';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import { Toaster } from 'react-hot-toast';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAuthSuccess = () => {
    setToken(localStorage.getItem('token'));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return (
      <>
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: { background: '#1E1E1E', color: '#E8EAED', border: '1px solid #3C4043' },
          }} 
        />
        <Auth onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  return (
    <Router>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: { background: '#1E1E1E', color: '#E8EAED', border: '1px solid #3C4043' },
        }} 
      />
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/subjects" element={<SubjectsList />} />
          <Route path="/subjects/:id" element={<SubjectDetail />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/timer" element={<FocusTimer />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin-secret-dashboard" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
