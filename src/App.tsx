import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Statistics from './pages/Statistics';
import Goals from './pages/Goals';
import MatchHistory from './pages/MatchHistory';
import Header from './components/Header';
import Navigation from './components/Navigation';
import './App.css';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return !user ? <>{children}</> : <Navigate to="/" />;
};

const AppContent = () => {
  const { user } = useAuth();

  return (
    <Router>
      {user && <Header />}
      <div className="app-container">
        {user && <Navigation />}
        <main className="main-content">
          <Routes>
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/" element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            } />
            <Route path="/statistics" element={
              <PrivateRoute>
                <Statistics />
              </PrivateRoute>
            } />
            <Route path="/goals" element={
              <PrivateRoute>
                <Goals />
              </PrivateRoute>
            } />
            <Route path="/history" element={
              <PrivateRoute>
                <MatchHistory />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
