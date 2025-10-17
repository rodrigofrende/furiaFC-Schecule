import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import { Tooltip } from 'react-tooltip';
import furiaLogo from '../assets/logo furia.png';
import '../styles/Navigation.css';

const Navigation = () => {
  const { user, signOut, updateDisplayName } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEditName = () => {
    setNewName(user?.displayName || '');
    setShowEditModal(true);
  };

  const handleSaveName = async () => {
    if (newName.trim() && !saving) {
      setSaving(true);
      try {
        await updateDisplayName(newName.trim());
        setShowEditModal(false);
      } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar el nombre. Intentá de nuevo.');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <>
      <nav className="navigation">
        <div className="nav-brand">
          <img src={furiaLogo} alt="Furia FC" className="nav-logo" />
          <span className="nav-brand-text">FURIA FC</span>
        </div>
        
        {/* Desktop user info */}
        <div className="nav-user-info">
          <span className="nav-username">{user?.displayName}</span>
          <div className="nav-user-actions">
            <button 
              onClick={handleEditName} 
              className="btn-icon btn-profile"
              data-tooltip-id="nav-profile-tooltip"
              data-tooltip-content="Editar Perfil"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
            
            <button 
              onClick={signOut} 
              className="btn-icon btn-logout"
              data-tooltip-id="nav-logout-tooltip"
              data-tooltip-content="Cerrar Sesión"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            📆 Eventos
          </NavLink>
          <NavLink to="/statistics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            📊 Estadísticas
          </NavLink>
          <NavLink to="/goals" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            ⚽ Goleadoras
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active admin-link' : 'nav-link admin-link'}>
              🔧 Admin
            </NavLink>
          )}
        </div>
      </nav>

      <Tooltip 
        id="nav-profile-tooltip" 
        place="right" 
        className="nav-tooltip"
        style={{ zIndex: 'var(--z-tooltip)' }}
      />
      <Tooltip 
        id="nav-logout-tooltip" 
        place="right" 
        className="nav-tooltip"
        style={{ zIndex: 'var(--z-tooltip)' }}
      />

      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)} title="Editar Nombre">
          <div className="modal-form">
            <label>
              Nuevo nombre:
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ingresá tu nombre"
                maxLength={30}
              />
            </label>
            <div className="modal-actions">
              <button 
                onClick={() => setShowEditModal(false)} 
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveName} 
                className="btn-primary"
                disabled={saving || !newName.trim()}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default Navigation;

