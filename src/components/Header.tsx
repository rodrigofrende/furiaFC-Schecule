import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import '../styles/Header.css';

const Header = () => {
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
      <header className="header">
        <div className="header-content">
          <div className="user-info">
            <span className="username">{user?.displayName}</span>
          </div>
          <div className="header-actions">
            <button onClick={handleEditName} className="btn-secondary">
              Editar Nombre
            </button>
            <button onClick={signOut} className="btn-danger">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

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

export default Header;

