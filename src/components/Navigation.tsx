import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import { Tooltip } from 'react-tooltip';
import { Calendar, Trophy, CalendarDays, BarChart2, Settings, User, LogOut, Menu } from 'lucide-react';
import furiaLogo from '../assets/logo furia.png';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type PlayerPosition } from '../types';
import '../styles/Navigation.css';

const Navigation = () => {
  const { user, signOut, updateDisplayName, updateBirthday, updatePosition, isReadOnly } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [newPosition, setNewPosition] = useState<PlayerPosition | ''>('');
  const [saving, setSaving] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleEditName = async () => {
    setNewName(user?.displayName || '');
    
    // Cargar el cumpleaños y posición actuales del usuario desde Firestore
    if (user?.email) {
      try {
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', user.email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          // Convertir formato de cumpleaños a DD/MM si existe
          if (userData.birthday) {
            const birthday = userData.birthday;
            // Si viene en formato YYYY-MM-DD o MM-DD, extraer día y mes
            if (birthday.includes('-')) {
              const parts = birthday.split('-');
              const month = parts.length === 3 ? parts[1] : parts[0];
              const day = parts.length === 3 ? parts[2] : parts[1];
              setNewBirthday(`${day.padStart(2, '0')}/${month.padStart(2, '0')}`);
            } else {
              setNewBirthday(birthday);
            }
          } else {
            setNewBirthday('');
          }
          setNewPosition(userData.position || '');
        }
      } catch (error) {
        console.error('Error al cargar los datos del usuario:', error);
      }
    }
    
    setShowEditModal(true);
  };

  const handleBirthdayChange = (value: string) => {
    // Solo permitir números y /
    const cleaned = value.replace(/[^\d/]/g, '');
    
    // Formatear automáticamente DD/MM
    let formatted = cleaned;
    if (cleaned.length >= 2 && !cleaned.includes('/')) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    
    // Limitar a DD/MM (5 caracteres máximo)
    if (formatted.length <= 5) {
      setNewBirthday(formatted);
    }
  };

  const validateBirthday = (birthday: string): boolean => {
    if (!birthday) return true; // Opcional
    
    const regex = /^(\d{2})\/(\d{2})$/;
    const match = birthday.match(regex);
    
    if (!match) {
      alert('⚠️ El formato del cumpleaños debe ser DD/MM (ejemplo: 15/03)');
      return false;
    }
    
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    
    if (month < 1 || month > 12) {
      alert('⚠️ El mes debe estar entre 01 y 12');
      return false;
    }
    
    if (day < 1 || day > 31) {
      alert('⚠️ El día debe estar entre 01 y 31');
      return false;
    }
    
    return true;
  };

  const handleSaveProfile = async () => {
    if (!newName.trim()) {
      alert('⚠️ El nombre no puede estar vacío');
      return;
    }

    // Validar formato del cumpleaños
    if (!validateBirthday(newBirthday)) {
      return;
    }

    if (!saving) {
      setSaving(true);
      try {
        // Actualizar el nombre
        await updateDisplayName(newName.trim());
        
        // Actualizar el cumpleaños si se proporcionó
        if (newBirthday) {
          // Convertir DD/MM a MM-DD para guardar en la DB
          const [day, month] = newBirthday.split('/');
          const formattedBirthday = `${month}-${day}`;
          await updateBirthday(formattedBirthday);
        }
        
        // Actualizar la posición solo si es PLAYER
        if (user?.role === 'PLAYER') {
          await updatePosition(newPosition);
        }
        
        alert('✅ Perfil actualizado correctamente');
        setShowEditModal(false);
      } catch (error) {
        console.error('Error al guardar:', error);
        alert('❌ Error al guardar los datos. Intentá de nuevo.');
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
        
        {/* Mobile menu button (visible only on small screens via CSS) */}
        <button
          className="mobile-menu-button"
          aria-label="Abrir menú"
          onClick={() => setShowMobileMenu(true)}
        >
          <Menu size={20} />
        </button>
        
        {/* Desktop user info */}
        <div className="nav-user-info">
          <span className="nav-username">{user?.displayName}</span>
          <div className="nav-user-actions">
            {!isReadOnly && (
              <button 
                onClick={handleEditName} 
                className="btn-icon btn-profile"
                data-tooltip-id="nav-profile-tooltip"
                data-tooltip-content="Editar Perfil"
              >
                <User size={20} />
              </button>
            )}
            
            <button 
              onClick={signOut} 
              className="btn-icon btn-logout"
              data-tooltip-id="nav-logout-tooltip"
              data-tooltip-content="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <Calendar className="nav-icon" />
            <span className="nav-label">Eventos</span>
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <Trophy className="nav-icon" />
            <span className="nav-label">Historial</span>
          </NavLink>
          <NavLink to="/fixture" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <CalendarDays className="nav-icon" />
            <span className="nav-label">Fixture</span>
          </NavLink>
          <NavLink to="/statistics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <BarChart2 className="nav-icon" />
            <span className="nav-label">Estadísticas</span>
          </NavLink>
          {(user?.role === 'ADMIN' || user?.role === 'VIEWER') && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active admin-link' : 'nav-link admin-link'}>
              <Settings className="nav-icon" />
              <span className="nav-label">Admin</span>
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
        <Modal onClose={() => setShowEditModal(false)} title="Editar Perfil">
          <div className="modal-form">
            <label>
              Nombre:
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ingresá tu nombre"
                maxLength={30}
                disabled={saving}
              />
            </label>
            
            <label>
              Fecha de cumpleaños (opcional):
              <input
                type="text"
                value={newBirthday}
                onChange={(e) => handleBirthdayChange(e.target.value)}
                placeholder="DD/MM (ej: 15/03)"
                maxLength={5}
                disabled={saving}
              />
            </label>
            
            {user?.role === 'PLAYER' && (
              <label>
                Posición (opcional):
                <select
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value as PlayerPosition | '')}
                  disabled={saving}
                >
                  <option value="">Seleccioná una posición</option>
                  <option value="Arquera">Arquera</option>
                  <option value="Defensora">Defensora</option>
                  <option value="Mediocampista">Mediocampista</option>
                  <option value="Delantera">Delantera</option>
                </select>
              </label>
            )}
            
            <p className="info-hint">
              💡 Si agregás tu cumpleaños, se creará automáticamente un evento recordatorio cada año.
            </p>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowEditModal(false)} 
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProfile} 
                className="btn-primary"
                disabled={saving || !newName.trim()}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Mobile menu modal */}
      {showMobileMenu && (
        <Modal onClose={() => setShowMobileMenu(false)} title="Menú">
          <div className="mobile-menu-list">
            <NavLink to="/" onClick={() => setShowMobileMenu(false)} className={({ isActive }) => isActive ? 'nav-link mobile-item active' : 'nav-link mobile-item'}>
              <Calendar className="nav-icon" />
              <span className="nav-label">Eventos</span>
            </NavLink>
            <NavLink to="/history" onClick={() => setShowMobileMenu(false)} className={({ isActive }) => isActive ? 'nav-link mobile-item active' : 'nav-link mobile-item'}>
              <Trophy className="nav-icon" />
              <span className="nav-label">Historial</span>
            </NavLink>
            <NavLink to="/fixture" onClick={() => setShowMobileMenu(false)} className={({ isActive }) => isActive ? 'nav-link mobile-item active' : 'nav-link mobile-item'}>
              <CalendarDays className="nav-icon" />
              <span className="nav-label">Fixture</span>
            </NavLink>
            <NavLink to="/statistics" onClick={() => setShowMobileMenu(false)} className={({ isActive }) => isActive ? 'nav-link mobile-item active' : 'nav-link mobile-item'}>
              <BarChart2 className="nav-icon" />
              <span className="nav-label">Estadísticas</span>
            </NavLink>
            {(user?.role === 'ADMIN' || user?.role === 'VIEWER') && (
              <NavLink to="/admin" onClick={() => setShowMobileMenu(false)} className={({ isActive }) => isActive ? 'nav-link mobile-item active admin-link' : 'nav-link mobile-item admin-link'}>
                <Settings className="nav-icon" />
                <span className="nav-label">Admin</span>
              </NavLink>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default Navigation;

