import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteField, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type EventType, type Event, type Rival } from '../types';
import Modal from './Modal';
import '../styles/CreateEvent.css';

interface CreateEventProps {
  onEventCreated: () => void;
  editingEvent?: Event | null;
  isOpen?: boolean;
  onClose?: () => void;
}

const CreateEvent = ({ onEventCreated, editingEvent, isOpen, onClose }: CreateEventProps) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  // Los PLAYER por defecto tienen CUSTOM, los ADMIN tienen TRAINING
  const [eventType, setEventType] = useState<EventType>(user?.role === 'PLAYER' ? 'CUSTOM' : 'TRAINING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  
  // Rival selection states
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [selectedRivalId, setSelectedRivalId] = useState('');
  const [showAddRivalModal, setShowAddRivalModal] = useState(false);
  const [showEditRivalModal, setShowEditRivalModal] = useState(false);
  const [editingRival, setEditingRival] = useState<Rival | null>(null);
  const [newRivalName, setNewRivalName] = useState('');
  const [savingRival, setSavingRival] = useState(false);

  // Load rivals on mount
  useEffect(() => {
    loadRivals();
  }, []);

  // Load event data when editing
  useEffect(() => {
    if (editingEvent) {
      setEventType(editingEvent.type);
      setTitle(editingEvent.title);
      setDescription(editingEvent.description || '');
      setLocation(editingEvent.location || '');
      setSelectedRivalId(editingEvent.rivalId || '');
      
      // Format date and time
      const eventDate = editingEvent.date;
      const dateStr = eventDate.toISOString().split('T')[0];
      const timeStr = eventDate.toTimeString().slice(0, 5);
      setDate(dateStr);
      setTime(timeStr);
      
      setIsRecurring(editingEvent.isRecurring || false);
      setRecurringType(editingEvent.recurringType || 'weekly');
      setSuspended(editingEvent.suspended || false);
      
      // Cargar fecha de finalización de eventos recurrentes
      if (editingEvent.recurringEndDate) {
        const endDateStr = editingEvent.recurringEndDate.toISOString().split('T')[0];
        setRecurringEndDate(endDateStr);
      }
    } else {
      // Reset form when not editing
      resetForm();
    }
  }, [editingEvent]);

  const loadRivals = async () => {
    try {
      const rivalsRef = collection(db, 'rivals');
      const rivalsQuery = query(rivalsRef, orderBy('name', 'asc'));
      const rivalsSnapshot = await getDocs(rivalsQuery);
      
      const rivalsData: Rival[] = [];
      rivalsSnapshot.forEach((doc) => {
        const data = doc.data();
        rivalsData.push({
          id: doc.id,
          name: data.name,
          logoUrl: data.logoUrl,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy
        });
      });
      
      setRivals(rivalsData);
    } catch (error) {
      console.error('Error loading rivals:', error);
    }
  };

  const handleAddRival = async () => {
    if (!newRivalName.trim()) {
      alert('⚠️ Por favor ingresa el nombre del rival');
      return;
    }

    setSavingRival(true);
    try {
      const rivalData = {
        name: newRivalName.trim(),
        createdAt: serverTimestamp(),
        createdBy: user?.id || 'unknown'
      };

      const docRef = await addDoc(collection(db, 'rivals'), rivalData);
      
      // Add to local state
      const newRival: Rival = {
        id: docRef.id,
        name: newRivalName.trim(),
        createdAt: new Date(),
        createdBy: user?.id || 'unknown'
      };
      
      setRivals([...rivals, newRival].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedRivalId(docRef.id);
      setNewRivalName('');
      setShowAddRivalModal(false);
      
      alert('✅ Rival agregado correctamente');
    } catch (error: any) {
      console.error('Error adding rival:', error);
      let errorMessage = '❌ Error al agregar el rival';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      alert(errorMessage);
      console.error('Full error details:', error);
    } finally {
      setSavingRival(false);
    }
  };

  const handleEditRivalClick = () => {
    const rival = rivals.find(r => r.id === selectedRivalId);
    if (rival) {
      setEditingRival(rival);
      setNewRivalName(rival.name);
      setShowEditRivalModal(true);
    }
  };

  const handleUpdateRival = async () => {
    if (!editingRival || !newRivalName.trim()) {
      alert('⚠️ Por favor ingresa el nombre del rival');
      return;
    }

    setSavingRival(true);
    try {
      const rivalRef = doc(db, 'rivals', editingRival.id);
      await updateDoc(rivalRef, {
        name: newRivalName.trim()
      });
      
      // Update local state
      setRivals(rivals.map(r => 
        r.id === editingRival.id 
          ? { ...r, name: newRivalName.trim() }
          : r
      ).sort((a, b) => a.name.localeCompare(b.name)));
      
      setNewRivalName('');
      setEditingRival(null);
      setShowEditRivalModal(false);
      
      alert('✅ Rival actualizado correctamente');
    } catch (error: any) {
      console.error('Error updating rival:', error);
      let errorMessage = '❌ Error al actualizar el rival';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      alert(errorMessage);
      console.error('Full error details:', error);
    } finally {
      setSavingRival(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setDate('');
    setTime('');
    setSelectedRivalId('');
    // Los PLAYER solo pueden crear eventos CUSTOM
    setEventType(user?.role === 'PLAYER' ? 'CUSTOM' : 'TRAINING');
    setIsRecurring(false);
    setRecurringType('weekly');
    setRecurringEndDate('');
    setSuspended(false);
  };

  const handleSubmit = async () => {
    // Validar que las jugadoras solo puedan crear eventos CUSTOM
    if (user?.role === 'PLAYER' && eventType !== 'CUSTOM') {
      alert('⚠️ Las jugadoras solo pueden crear eventos personalizados');
      return;
    }

    // Para cumpleaños no se requiere hora (será 00:00 por defecto)
    const isBirthday = eventType === 'BIRTHDAY';
    const isMatch = eventType === 'MATCH';
    
    if (!title || !date || (!time && !isBirthday) || !user) return;
    
    // Validar que los partidos tengan rival seleccionado
    if (isMatch && !selectedRivalId) {
      alert('⚠️ Por favor selecciona un rival para el partido');
      return;
    }
    
    setLoading(true);
    try {
      if (editingEvent) {
        // Edit existing event
        const eventTime = isBirthday ? '00:00' : time;
        const eventDate = new Date(`${date}T${eventTime}`);
        const eventRef = doc(db, 'events', editingEvent.id);
        
        // Construir el objeto de actualización sin valores undefined
        const updateData: any = {
          type: eventType,
          title,
          description: description.trim(),
          location: location.trim(),
          date: eventDate,
          isRecurring: isRecurring,
          suspended: suspended
        };
        
        // Si se está suspendiendo el evento, agregar metadata
        if (suspended && !editingEvent.suspended) {
          updateData.suspendedBy = user.id;
          updateData.suspendedAt = serverTimestamp();
        }
        
        // Si se está reactivando el evento, eliminar metadata de suspensión
        if (!suspended && editingEvent.suspended) {
          updateData.suspendedBy = deleteField();
          updateData.suspendedAt = deleteField();
        }
        
        // Add or remove rival info based on event type
        if (isMatch && selectedRivalId) {
          const rival = rivals.find(r => r.id === selectedRivalId);
          if (rival) {
            updateData.rivalId = selectedRivalId;
            updateData.rivalName = rival.name;
          }
        } else {
          // Si no es MATCH o no hay rival seleccionado, eliminar los campos
          updateData.rivalId = deleteField();
          updateData.rivalName = deleteField();
        }
        
        // Si es recurrente, agregar el tipo; si no, eliminarlo del documento
        if (isRecurring) {
          updateData.recurringType = recurringType;
        } else {
          updateData.recurringType = deleteField();
        }
        
        await updateDoc(eventRef, updateData);
        
        alert('✓ Evento actualizado exitosamente');
        resetForm();
        if (onClose) onClose();
        onEventCreated();
      } else {
        // Create new event(s)
        const shouldBeRecurring = isRecurring || isBirthday;
        
        if (shouldBeRecurring && !isBirthday && !recurringEndDate) {
          alert('Debes especificar una fecha de finalización para eventos recurrentes');
          return;
        }

        const eventTime = isBirthday ? '00:00' : time;
        const startDate = new Date(`${date}T${eventTime}`);
        const endDate = isBirthday 
          ? new Date(startDate.getFullYear() + 5, startDate.getMonth(), startDate.getDate())
          : shouldBeRecurring 
            ? new Date(`${recurringEndDate}T${eventTime}`) 
            : startDate;
        
        const eventsToCreate = [];
        const currentDate = new Date(startDate);
        const effectiveRecurringType = isBirthday ? 'yearly' : recurringType;
        
        // Get rival info if it's a match
        const rivalInfo = isMatch && selectedRivalId ? rivals.find(r => r.id === selectedRivalId) : null;
        
        if (shouldBeRecurring) {
          // Crear eventos recurrentes
          while (currentDate <= endDate) {
            const eventData: any = {
              type: eventType,
              title,
              description: description.trim(),
              location: location.trim(),
              date: new Date(currentDate),
              createdBy: user.id,
              createdAt: serverTimestamp(),
              isRecurring: true,
              recurringType: effectiveRecurringType,
              recurringEndDate: endDate, // Guardar la fecha de finalización de la serie
              originalEventId: null
            };
            
            if (rivalInfo) {
              eventData.rivalId = selectedRivalId;
              eventData.rivalName = rivalInfo.name;
            }
            
            eventsToCreate.push(eventData);
            
            if (effectiveRecurringType === 'weekly') {
              currentDate.setDate(currentDate.getDate() + 7);
            } else if (effectiveRecurringType === 'monthly') {
              currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (effectiveRecurringType === 'yearly') {
              currentDate.setFullYear(currentDate.getFullYear() + 1);
            }
          }
        } else {
          const eventData: any = {
            type: eventType,
            title,
            description: description.trim(),
            location: location.trim(),
            date: startDate,
            createdBy: user.id,
            createdAt: serverTimestamp(),
            isRecurring: false
          };
          
          if (rivalInfo) {
            eventData.rivalId = selectedRivalId;
            eventData.rivalName = rivalInfo.name;
          }
          
          eventsToCreate.push(eventData);
        }

        const batch = [];
        for (const eventData of eventsToCreate) {
          batch.push(addDoc(collection(db, 'events'), eventData));
        }
        
        await Promise.all(batch);

        const eventCount = eventsToCreate.length;
        const message = isBirthday 
          ? `¡Cumpleaños creado exitosamente! 🎂 Se crearon ${eventCount} eventos anuales.`
          : `¡Evento${eventCount > 1 ? 's' : ''} creado${eventCount > 1 ? 's' : ''} exitosamente! ${eventCount > 1 ? `Se crearon ${eventCount} eventos.` : ''}`;
        alert(message);
        
        resetForm();
        setShowModal(false);
        onEventCreated();
      }
    } catch (error: any) {
      console.error('Error saving event:', error);
      
      let errorMessage = '❌ Error al guardar el evento';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.code === 'unavailable') {
        errorMessage += '\n🌐 No se puede conectar a Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      
      alert(errorMessage);
      console.error('Full error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    } finally {
      setLoading(false);
    }
  };

  // Permitir acceso a ADMIN y PLAYER
  if (!user || (user.role !== 'ADMIN' && user.role !== 'PLAYER')) {
    return null;
  }

  const isPlayer = user.role === 'PLAYER';

  const modalIsOpen = editingEvent ? isOpen : showModal;
  
  const handleClose = () => {
    if (editingEvent && onClose) {
      // Si estamos editando, usar el callback de Home
      onClose();
    } else {
      // Si estamos creando, usar estado local
      setShowModal(false);
    }
    resetForm();
  };
  
  const handleOpenModal = () => {
    if (editingEvent && onClose) {
      // Si estamos editando, no deberíamos abrir desde el botón
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      {!editingEvent && (
        <button onClick={handleOpenModal} className="btn-primary create-event-btn">
          ➕ Crear Evento
        </button>
      )}

      {modalIsOpen && (
        <Modal 
          onClose={handleClose} 
          title={editingEvent ? "Editar Evento" : "Crear Nuevo Evento"}
          onSubmit={handleSubmit}
        >
          <div className="event-form">
            <div className="form-group">
              <label>Tipo de Evento:</label>
              {isPlayer ? (
                // Las jugadoras solo pueden crear eventos CUSTOM
                <div className="toggle-container event-type-single">
                  <button
                    className={`toggle-btn active`}
                    disabled
                  >
                    ⭐ Evento Personalizado
                  </button>
                </div>
              ) : (
                // Los admins pueden crear todos los tipos
                <div className="toggle-container event-type-grid">
                  <button
                    className={`toggle-btn ${eventType === 'TRAINING' ? 'active' : ''}`}
                    onClick={() => setEventType('TRAINING')}
                  >
                    ⚽ Entrenamiento
                  </button>
                  <button
                    className={`toggle-btn ${eventType === 'MATCH' ? 'active' : ''}`}
                    onClick={() => setEventType('MATCH')}
                  >
                    🏆 Partido
                  </button>
                  <button
                    className={`toggle-btn ${eventType === 'BIRTHDAY' ? 'active' : ''}`}
                    onClick={() => {
                      setEventType('BIRTHDAY');
                      setIsRecurring(true);
                      setRecurringType('yearly');
                    }}
                  >
                    🎂 Cumpleaños
                  </button>
                  <button
                    className={`toggle-btn ${eventType === 'CUSTOM' ? 'active' : ''}`}
                    onClick={() => setEventType('CUSTOM')}
                  >
                    ⭐ Personalizado
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Título:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Entrenamiento Semanal"
                maxLength={35}
              />
            </div>

            {eventType === 'MATCH' && (
              <div className="form-group">
                <label>Rival:</label>
                <div className="rival-selector">
                  <select
                    value={selectedRivalId}
                    onChange={(e) => setSelectedRivalId(e.target.value)}
                    className="rival-select"
                  >
                    <option value="">Seleccionar rival</option>
                    {rivals.map((rival) => (
                      <option key={rival.id} value={rival.id}>
                        {rival.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleEditRivalClick}
                    className="btn-edit-rival"
                    title="Editar rival"
                    disabled={!selectedRivalId}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddRivalModal(true)}
                    className="btn-add-rival"
                    title="Agregar nuevo rival"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Fecha:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {eventType !== 'BIRTHDAY' && (
              <div className="form-group">
                <label>Hora:</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Ubicación:</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Liverpool, Francisco Vazquez 4.601"
                maxLength={50}
              />
            </div>

            {eventType === 'TRAINING' && (
              <div className="form-group">
                <div className="recurring-toggle">
                  <div className="toggle-label">
                    <span className="toggle-text">🔄 Evento Recurrente</span>
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      disabled={!!editingEvent}
                    />
                  </div>
                  {editingEvent && (
                    <span style={{ 
                      fontSize: '0.85rem', 
                      color: '#666', 
                      marginTop: '8px',
                      fontStyle: 'italic',
                      display: 'block'
                    }}>
                      ℹ️ No puede cambiar si el evento es recurrente al editarlo
                    </span>
                  )}
                </div>
                
                {isRecurring && (
                  <div className="recurring-options">
                    <div className="form-group">
                      <label>Tipo de Repetición:</label>
                      <div className="toggle-container">
                        <button
                          className={`toggle-btn ${recurringType === 'weekly' ? 'active' : ''}`}
                          onClick={() => setRecurringType('weekly')}
                          disabled={!!editingEvent}
                        >
                          📅 Semanal
                        </button>
                        <button
                          className={`toggle-btn ${recurringType === 'monthly' ? 'active' : ''}`}
                          onClick={() => setRecurringType('monthly')}
                          disabled={!!editingEvent}
                        >
                          📆 Mensual
                        </button>
                      </div>
                      {editingEvent && (
                        <span style={{ 
                          fontSize: '0.85rem', 
                          color: '#666', 
                          marginTop: '8px',
                          fontStyle: 'italic'
                        }}>
                          ℹ️ El tipo de repetición no puede modificarse al editar un evento individual de la serie
                        </span>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Fecha de Finalización:</label>
                      <input
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        min={date}
                        disabled={!!editingEvent}
                        className={editingEvent ? 'input-disabled' : ''}
                      />
                      {editingEvent && recurringEndDate && (
                        <span style={{ 
                          fontSize: '0.85rem', 
                          color: '#666', 
                          marginTop: '8px',
                          fontStyle: 'italic'
                        }}>
                          ℹ️ La fecha de finalización no puede modificarse al editar un evento individual de la serie
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {eventType === 'BIRTHDAY' && (
              <div className="form-group">
                <div className="info-box" style={{ 
                  padding: '12px', 
                  backgroundColor: '#fff3cd', 
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#856404'
                }}>
                  🎂 Los cumpleaños son eventos de todo el día y se repiten automáticamente cada año durante 5 años
                </div>
              </div>
            )}

            {eventType === 'CUSTOM' && (
              <div className="form-group">
                <div className="info-box" style={{ 
                  padding: '12px', 
                  backgroundColor: '#e7f3ff', 
                  border: '1px solid #2196F3',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#0d47a1'
                }}>
                  {isPlayer 
                    ? '⭐ Como jugadora, puedes crear eventos personalizados para actividades especiales del equipo'
                    : '⭐ Los eventos personalizados son únicos, ideales para ocasiones especiales'
                  }
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Descripción (opcional):</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Información adicional..."
                maxLength={80}
                rows={3}
              />
              <span className="char-count">{description.length}/80</span>
            </div>

            {/* Opción de suspender evento - solo para admins y solo al editar */}
            {editingEvent && user?.role === 'ADMIN' && (
              <div className="form-group">
                <div className="suspended-toggle">
                  <div className="toggle-label">
                    <span className="toggle-text">🚫 Suspender Evento</span>
                    <input
                      type="checkbox"
                      checked={suspended}
                      onChange={(e) => setSuspended(e.target.checked)}
                    />
                  </div>
                </div>
                {suspended && (
                  <div className="info-box" style={{ 
                    padding: '12px', 
                    backgroundColor: '#ffe5e5', 
                    border: '1px solid #ff4444',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#cc0000',
                    marginTop: '12px'
                  }}>
                    ⚠️ El evento suspendido mostrará un banner informativo y no permitirá que los participantes se anoten o editen su asistencia. Solo será posible ver la lista de participantes.
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={handleClose} className="btn-secondary">
                Cancelar
              </button>
              <button 
                onClick={handleSubmit} 
                className="btn-primary"
                disabled={loading || !title || !date || (!time && eventType !== 'BIRTHDAY')}
              >
                {loading 
                  ? (editingEvent ? 'Guardando...' : 'Creando...') 
                  : (editingEvent ? 'Guardar Cambios' : 'Crear Evento')
                }
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal para agregar nuevo rival */}
      {showAddRivalModal && (
        <Modal
          onClose={() => {
            setShowAddRivalModal(false);
            setNewRivalName('');
          }}
          title="Agregar Nuevo Rival"
        >
          <div className="add-rival-form">
            <div className="form-group">
              <label>Nombre del Rival:</label>
              <input
                type="text"
                value={newRivalName}
                onChange={(e) => setNewRivalName(e.target.value)}
                placeholder="Ej: Las Leonas FC"
                maxLength={50}
                disabled={savingRival}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Logo / Escudo:</label>
              <div className="logo-upload-placeholder">
                <div className="upload-icon">📷</div>
                <div className="upload-text">
                  <strong>PRÓXIMAMENTE</strong>
                  <p>Podrás subir el logo del rival</p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowAddRivalModal(false);
                  setNewRivalName('');
                }}
                className="btn-secondary"
                disabled={savingRival}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddRival}
                className="btn-primary"
                disabled={savingRival || !newRivalName.trim()}
              >
                {savingRival ? 'Guardando...' : 'Agregar Rival'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal para editar rival existente */}
      {showEditRivalModal && editingRival && (
        <Modal
          onClose={() => {
            setShowEditRivalModal(false);
            setEditingRival(null);
            setNewRivalName('');
          }}
          title="Editar Rival"
        >
          <div className="add-rival-form">
            <div className="form-group">
              <label>Nombre del Rival:</label>
              <input
                type="text"
                value={newRivalName}
                onChange={(e) => setNewRivalName(e.target.value)}
                placeholder="Ej: Las Leonas FC"
                maxLength={50}
                disabled={savingRival}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Logo / Escudo:</label>
              <div className="logo-upload-placeholder">
                <div className="upload-icon">📷</div>
                <div className="upload-text">
                  <strong>PRÓXIMAMENTE</strong>
                  <p>Podrás subir el logo del rival</p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowEditRivalModal(false);
                  setEditingRival(null);
                  setNewRivalName('');
                }}
                className="btn-secondary"
                disabled={savingRival}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateRival}
                className="btn-primary"
                disabled={savingRival || !newRivalName.trim()}
              >
                {savingRival ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CreateEvent;

