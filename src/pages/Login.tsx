import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { MASTER_PASSWORD } from '../config/allowedUsers';
import furiaLogo from '../assets/logo furia.png';
import '../styles/Login.css';

interface FirestoreUser {
  email: string;
  role: 'ADMIN' | 'PLAYER' | 'VIEWER';
  alias: string;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Special handling for demo user 'testfuria'
      if (email.toLowerCase() === 'testfuria') {
        signIn('testfuria@demo.com', 'Test Furia', 'VIEWER');
        setLoading(false);
        return;
      }

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Email no autorizado. Comunicate con alguien del equipo.');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as FirestoreUser;

      const role = userData.role || 'PLAYER';

      // Si es ADMIN y no hemos verificado la contraseña aún
      if (role === 'ADMIN' && !isAdminLogin) {
        setIsAdminLogin(true);
        setLoading(false);
        return;
      }

      // Si es ADMIN y estamos en la segunda fase, verificar contraseña
      if (role === 'ADMIN' && isAdminLogin) {
        if (password !== MASTER_PASSWORD) {
          setError('Contraseña incorrecta para administrador.');
          setLoading(false);
          return;
        }
      }

      // Si es PLAYER, no requiere contraseña
      const displayName = userData.alias || email.split('@')[0];
      signIn(userData.email, displayName, role);
    } catch (err: any) {
      setError('Error al iniciar sesión. Intentá de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo">
          <img 
            src={furiaLogo} 
            alt="FURIA FC Logo" 
          />
        </div>
        <h1>FURIA FC</h1>
        
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="Email o Usuario"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isAdminLogin}
            autoComplete="username"
          />
          
          {isAdminLogin && (
            <input
              type="password"
              placeholder="Contraseña de Administrador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
          
          {error && <p className="error-message">{error}</p>}
          
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Ingresando...' : isAdminLogin ? 'Verificar Contraseña' : 'Ingresar'}
          </button>
          
          {isAdminLogin && (
            <button 
              type="button" 
              onClick={() => {
                setIsAdminLogin(false);
                setPassword('');
                setError('');
              }}
              className="btn-secondary"
            >
              Volver
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;

