import { NavLink } from 'react-router-dom';
import '../styles/Navigation.css';

const Navigation = () => {
  return (
    <nav className="navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        🏠 Inicio
      </NavLink>
      <NavLink to="/statistics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        📊 Estadísticas
      </NavLink>
      <NavLink to="/goals" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        ⚽ Goleadoras
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        📜 Historial
      </NavLink>
    </nav>
  );
};

export default Navigation;

