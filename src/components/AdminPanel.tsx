import { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc, Timestamp, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import '../styles/AdminPanel.css';
import type { UserRole } from '../types';
import { createTestMatches } from '../utils/createTestMatches';

interface UserData {
  id: string;
  email: string;
  alias: string;
  role: UserRole;
  position?: string;
  createdAt?: Date;
}

const AdminPanel = () => {
  const { user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  const [users, setUsers] = useState<UserData[]>([]);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    alias: '',
    role: 'PLAYER' as UserRole
  });
  const [emailError, setEmailError] = useState('');
  const [resettingStats, setResettingStats] = useState(false);
  const [creatingTestMatches, setCreatingTestMatches] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);

  // Solo mostrar para administradores
  if (user?.role !== 'ADMIN') {
    return null;
  }

  // Cargar usuarios al montar el componente
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        alias: doc.data().alias || '',
        role: doc.data().role || 'PLAYER',
        position: doc.data().position || undefined,
        createdAt: doc.data().createdAt?.toDate()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('❌ Error al cargar los usuarios');
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('');
      return true; // Permitir campo vacío mientras se escribe
    }
    if (!emailRegex.test(email.trim())) {
      setEmailError('Formato de email inválido');
      return false;
    }
    setEmailError('');
    return true;
  };

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserFormData({ email: '', alias: '', role: 'PLAYER' });
    setEmailError('');
    setShowUserModal(true);
  };

  const openEditUserModal = (userData: UserData) => {
    setEditingUser(userData);
    setUserFormData({
      email: userData.email,
      alias: userData.alias,
      role: userData.role
    });
    setEmailError('');
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    // Validar que todos los campos estén completos
    if (!userFormData.email.trim() || !userFormData.alias.trim()) {
      alert('⚠️ Por favor completa todos los campos');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userFormData.email.trim())) {
      alert('⚠️ Por favor ingresa un email válido');
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        // Editar usuario existente
        await updateDoc(doc(db, 'users', editingUser.id), {
          email: userFormData.email.trim(),
          alias: userFormData.alias.trim(),
          role: userFormData.role
        });
        alert('✅ Usuario actualizado correctamente');
      } else {
        // Agregar nuevo usuario
        await addDoc(collection(db, 'users'), {
          email: userFormData.email.trim(),
          alias: userFormData.alias.trim(),
          role: userFormData.role,
          createdAt: Timestamp.now()
        });
        alert('✅ Usuario agregado correctamente');
      }
      
      setShowUserModal(false);
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('❌ Error al guardar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert('✅ Usuario eliminado correctamente');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('❌ Error al eliminar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvents = async () => {
    setLoading(true);
    try {
      // Obtener todos los eventos
      const eventsRef = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      
      // Obtener todas las asistencias
      const attendancesRef = collection(db, 'attendances');
      const attendancesSnapshot = await getDocs(attendancesRef);
      
      const batch = writeBatch(db);
      let deletedEvents = 0;
      let deletedAttendances = 0;
      
      // Eliminar eventos
      eventsSnapshot.forEach((eventDoc) => {
        batch.delete(eventDoc.ref);
        deletedEvents++;
      });
      
      // Eliminar asistencias
      attendancesSnapshot.forEach((attendanceDoc) => {
        batch.delete(attendanceDoc.ref);
        deletedAttendances++;
      });
      
      await batch.commit();
      
      alert(`✅ Limpieza completada:\n- ${deletedEvents} eventos eliminados\n- ${deletedAttendances} asistencias eliminadas`);
      setShowDeleteModal(false);
      
    } catch (error) {
      console.error('Error deleting events:', error);
      alert('❌ Error al eliminar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const checkEventsCount = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const snapshot = await getDocs(eventsRef);
      setEventsCount(snapshot.size);
    } catch (error) {
      console.error('Error checking events count:', error);
    }
  };

  const openDeleteModal = () => {
    checkEventsCount();
    setShowDeleteModal(true);
  };

  const handleResetStats = async () => {
    const confirmation = confirm(
      '🚨 ¿Estás seguro de que quieres RESETEAR todas las estadísticas?\n\n' +
      'Esta acción eliminará:\n' +
      '• Todas las estadísticas de usuarios (colección stats)\n' +
      '• Todos los eventos archivados (colección events_archive)\n\n' +
      '⚠️ ESTA ACCIÓN ES IRREVERSIBLE\n\n' +
      '¿Deseas continuar?'
    );

    if (!confirmation) {
      return;
    }

    // Segunda confirmación para estar seguros
    const doubleConfirmation = confirm(
      '⚠️ ÚLTIMA CONFIRMACIÓN\n\n' +
      'Se borrarán TODAS las estadísticas y eventos archivados.\n' +
      'Las estadísticas de asistencia volverán a CERO.\n\n' +
      '¿Estás ABSOLUTAMENTE SEGURO?'
    );

    if (!doubleConfirmation) {
      return;
    }

    setResettingStats(true);
    try {
      const batch = writeBatch(db);
      let statsDeleted = 0;
      let archiveDeleted = 0;

      // Eliminar todos los documentos de la colección 'stats'
      const statsRef = collection(db, 'stats');
      const statsSnapshot = await getDocs(statsRef);
      statsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        statsDeleted++;
      });

      // Eliminar todos los documentos de la colección 'events_archive'
      const archiveRef = collection(db, 'events_archive');
      const archiveSnapshot = await getDocs(archiveRef);
      archiveSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        archiveDeleted++;
      });

      await batch.commit();

      alert(
        `✅ Reseteo de estadísticas completado:\n\n` +
        `• ${statsDeleted} estadísticas eliminadas\n` +
        `• ${archiveDeleted} eventos archivados eliminados\n\n` +
        `Las estadísticas ahora están en cero.`
      );
    } catch (error) {
      console.error('Error resetting stats:', error);
      alert('❌ Error al resetear las estadísticas');
    } finally {
      setResettingStats(false);
    }
  };

  const handleCreateTestMatches = async () => {
    if (!confirm('¿Deseas crear 3 partidos de prueba?\n\nEstos partidos serán creados con fechas pasadas para que se archiven automáticamente.')) {
      return;
    }

    setCreatingTestMatches(true);
    try {
      const result = await createTestMatches(user!.id);
      if (result.success) {
        alert('✅ ' + result.message + '\n\nRecarga la página de Eventos para que se archiven automáticamente.');
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      console.error('Error creating test matches:', error);
      alert('❌ Error al crear los partidos de prueba');
    } finally {
      setCreatingTestMatches(false);
    }
  };

  const handleDeleteMatchHistory = async () => {
    const confirmation = confirm(
      '🚨 ¿Estás seguro de que quieres ELIMINAR TODO EL HISTORIAL de partidos?\n\n' +
      'Esta acción eliminará:\n' +
      '• Todos los partidos archivados (eventos tipo MATCH)\n' +
      '• Todas las asistencias de esos partidos\n' +
      '• Todos los resultados ingresados (match_results)\n\n' +
      '⚠️ ESTA ACCIÓN ES IRREVERSIBLE\n\n' +
      '¿Deseas continuar?'
    );

    if (!confirmation) {
      return;
    }

    // Segunda confirmación
    const doubleConfirmation = confirm(
      '⚠️ ÚLTIMA CONFIRMACIÓN\n\n' +
      'Se borrará TODO el historial de partidos.\n' +
      'Los resultados y goles registrados se perderán permanentemente.\n\n' +
      '¿Estás ABSOLUTAMENTE SEGURO?'
    );

    if (!doubleConfirmation) {
      return;
    }

    setDeletingHistory(true);
    try {
      let matchesDeleted = 0;
      let attendancesDeleted = 0;
      let resultsDeleted = 0;

      // 1. Obtener todos los eventos archivados de tipo MATCH
      const eventsArchiveRef = collection(db, 'events_archive');
      const matchesQuery = query(eventsArchiveRef, where('type', '==', 'MATCH'));
      const matchesSnapshot = await getDocs(matchesQuery);
      
      const matchIds: string[] = [];
      const batch1 = writeBatch(db);
      
      matchesSnapshot.forEach((matchDoc) => {
        matchIds.push(matchDoc.id);
        batch1.delete(matchDoc.ref);
        matchesDeleted++;
      });
      
      await batch1.commit();

      // 2. Eliminar asistencias archivadas relacionadas con esos partidos
      if (matchIds.length > 0) {
        const attendancesArchiveRef = collection(db, 'attendances_archive');
        const attendancesSnapshot = await getDocs(attendancesArchiveRef);
        
        const batch2 = writeBatch(db);
        attendancesSnapshot.forEach((attendanceDoc) => {
          const data = attendanceDoc.data();
          if (matchIds.includes(data.eventId)) {
            batch2.delete(attendanceDoc.ref);
            attendancesDeleted++;
          }
        });
        
        await batch2.commit();

        // 3. Eliminar resultados de partidos
        const resultsRef = collection(db, 'match_results');
        const resultsSnapshot = await getDocs(resultsRef);
        
        const batch3 = writeBatch(db);
        resultsSnapshot.forEach((resultDoc) => {
          if (matchIds.includes(resultDoc.id)) {
            batch3.delete(resultDoc.ref);
            resultsDeleted++;
          }
        });
        
        await batch3.commit();
      }

      alert(
        `✅ Historial de partidos eliminado:\n\n` +
        `• ${matchesDeleted} partidos eliminados\n` +
        `• ${attendancesDeleted} asistencias eliminadas\n` +
        `• ${resultsDeleted} resultados eliminados\n\n` +
        `El historial ha sido limpiado completamente.`
      );
    } catch (error) {
      console.error('Error deleting match history:', error);
      alert('❌ Error al eliminar el historial de partidos');
    } finally {
      setDeletingHistory(false);
    }
  };

  return (
    <div className="admin-panel">
      <h1>Panel de Administración</h1>
      
      {/* Sección de Usuarios */}
      <div className="admin-section">
        <div className="section-header">
          <h2>👥 Gestión de Usuarios</h2>
          <button 
            onClick={openAddUserModal}
            className="btn-primary"
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar Usuario
          </button>
        </div>
        
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Alias</th>
                <th>Rol</th>
                <th>Posición</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-users">
                    No hay usuarios registrados
                  </td>
                </tr>
              ) : (
                users.map((userData) => (
                  <tr key={userData.id}>
                    <td>{userData.email}</td>
                    <td>{userData.alias}</td>
                    <td>
                      <span className={`role-badge role-${userData.role.toLowerCase()}`}>
                        {userData.role === 'ADMIN' ? 'ADMIN' : 'JUGADORA'}
                      </span>
                    </td>
                    <td>{userData.role === 'PLAYER' ? (userData.position || '-') : '-'}</td>
                    <td className="actions-cell">
                      <button
                        onClick={() => openEditUserModal(userData)}
                        className="btn-icon btn-edit"
                        disabled={loading}
                        title="Editar usuario"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(userData.id)}
                        className="btn-icon btn-delete"
                        disabled={loading}
                        title="Eliminar usuario"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección de Acciones de Admin */}
      <div className="admin-actions">
        <div className="action-card">
          <h2>🗑️ Limpieza de Datos</h2>
          <p>Elimina todos los eventos y asistencias de la base de datos.</p>
          <p className="warning-text">⚠️ Esta acción no se puede deshacer</p>
          
          <button 
            onClick={openDeleteModal}
            className="btn-danger"
            disabled={loading}
          >
            🗑️ Borrar Tabla de Eventos
          </button>
        </div>

        <div className="action-card">
          <h2>🏆 Gestión de Historial de Partidos</h2>
          <p>Herramientas para administrar el historial de partidos.</p>
          
          <div className="stats-admin-buttons">
            <button 
              onClick={handleCreateTestMatches}
              className="btn-primary"
              disabled={creatingTestMatches}
              title="Crear 3 partidos de prueba con fechas pasadas"
            >
              {creatingTestMatches ? 'Creando...' : '⚽ Crear Partidos de Prueba'}
            </button>
            
            <button 
              onClick={handleDeleteMatchHistory}
              className="btn-danger"
              disabled={deletingHistory}
              title="Eliminar todo el historial de partidos (irreversible)"
            >
              {deletingHistory ? 'Eliminando...' : '🗑️ Borrar Todo el Historial'}
            </button>
          </div>
          
          <p className="info-text">💡 Los partidos de prueba se crean con fechas pasadas y se archivan automáticamente</p>
          <p className="warning-text">⚠️ Borrar el historial eliminará todos los partidos, resultados y goles registrados</p>
        </div>

        <div className="action-card">
          <h2>🔄 Resetear Estadísticas</h2>
          <p>Elimina todas las estadísticas y eventos archivados de la base de datos.</p>
          <p className="warning-text">⚠️ Esta acción es IRREVERSIBLE y eliminará todo el historial de asistencias</p>
          
          <button 
            onClick={handleResetStats}
            className="btn-danger"
            disabled={resettingStats}
          >
            {resettingStats ? 'Reseteando...' : '🔄 Resetear Todas las Estadísticas'}
          </button>
        </div>
      </div>

      {/* Modal para Agregar/Editar Usuario */}
      {showUserModal && (
        <Modal 
          onClose={() => setShowUserModal(false)} 
          title={editingUser ? '✏️ Editar Usuario' : '➕ Agregar Usuario'}
        >
          <div className="user-form">
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                id="email"
                type="email"
                value={userFormData.email}
                onChange={(e) => {
                  const value = e.target.value;
                  setUserFormData({ ...userFormData, email: value });
                  validateEmail(value);
                }}
                onBlur={() => validateEmail(userFormData.email)}
                placeholder="usuario@ejemplo.com"
                maxLength={50}
                disabled={loading}
                className={emailError ? 'error' : ''}
              />
              {emailError && <span className="error-message">{emailError}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="alias">Alias:</label>
              <input
                id="alias"
                type="text"
                value={userFormData.alias}
                onChange={(e) => setUserFormData({ ...userFormData, alias: e.target.value })}
                placeholder="Nombre de la jugadora"
                maxLength={30}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Rol:</label>
              <select
                id="role"
                value={userFormData.role}
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                disabled={loading}
              >
                <option value="ADMIN">ADMIN</option>
                <option value="PLAYER">JUGADORA</option>
              </select>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setShowUserModal(false)} 
                className="btn-secondary"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveUser}
                className="btn-primary"
                disabled={loading || !!emailError || !userFormData.email.trim() || !userFormData.alias.trim()}
              >
                {loading ? 'Guardando...' : editingUser ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal 
          onClose={() => setShowDeleteModal(false)} 
          title="⚠️ CONFIRMAR ELIMINACIÓN"
        >
          <div className="delete-confirmation">
            <div className="warning-section">
              <h3>🚨 ADVERTENCIA</h3>
              <p>Estás a punto de eliminar <strong>TODOS</strong> los eventos y asistencias de la base de datos.</p>
              
              <div className="impact-info">
                <p><strong>Se eliminarán:</strong></p>
                <ul>
                  <li>📅 Todos los eventos ({eventsCount} eventos encontrados)</li>
                  <li>👥 Todas las asistencias registradas</li>
                  <li>📊 Todo el historial de participación</li>
                </ul>
              </div>
              
              <p className="final-warning">
                <strong>Esta acción es IRREVERSIBLE.</strong><br/>
                ¿Estás seguro de que quieres continuar?
              </p>
            </div>

            <div className="confirmation-actions">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="btn-secondary"
                disabled={loading}
              >
                CANCELAR
              </button>
              <button 
                onClick={handleDeleteEvents}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? 'Eliminando...' : '🗑️ SÍ, ELIMINAR TODO'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminPanel;
