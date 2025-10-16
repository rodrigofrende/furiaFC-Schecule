import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { MASTER_PASSWORD } from '../config/allowedUsers';
import '../styles/Login.css';

interface FirestoreUser {
  email: string;
  admin: boolean;
  alias: string;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (password !== MASTER_PASSWORD) {
        setError('Email no autorizado o contraseña incorrecta. Comunicate con alguien del equipo.');
        setLoading(false);
        return;
      }

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Email no autorizado o contraseña incorrecta. Comunicate con alguien del equipo.');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as FirestoreUser;

      const role = userData.admin ? 'ADMIN' : 'PLAYER';
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
            src="https://via.placeholder.com/150x150?text=FURIA+FC" 
            alt="FURIA FC Logo" 
          />
        </div>
        <h1>FURIA FC</h1>
        
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          {error && <p className="error-message">{error}</p>}
          
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

