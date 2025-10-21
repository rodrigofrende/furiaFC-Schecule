import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Statistics = lazy(() => import('./pages/Statistics'));
const MatchHistory = lazy(() => import('./pages/MatchHistory'));
const Fixture = lazy(() => import('./pages/Fixture'));
const Admin = lazy(() => import('./pages/Admin'));
const Header = lazy(() => import('./components/Header'));
const Navigation = lazy(() => import('./components/Navigation'));

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

const LoadingFallback = () => (
  <div className="loading" style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '1.2rem'
  }}>
    Cargando...
  </div>
);

const AppContent = () => {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="*" element={
            <PrivateRoute>
              <>
                <Header />
                <div className="app-container">
                  <Navigation />
                  <main className="main-content">
                    <Suspense fallback={<div className="loading">Cargando página...</div>}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/statistics" element={<Statistics />} />
                        <Route path="/history" element={<MatchHistory />} />
                        <Route path="/fixture" element={<Fixture />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="*" element={<Navigate to="/" />} />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </>
            </PrivateRoute>
          } />
        </Routes>
      </Suspense>
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
