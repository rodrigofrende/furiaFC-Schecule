import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type EventType, type Event } from '../types';
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
  const [eventType, setEventType] = useState<EventType>('TRAINING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Load event data when editing
  useEffect(() => {
    if (editingEvent) {
      setEventType(editingEvent.type);
      setTitle(editingEvent.title);
      setDescription(editingEvent.description || '');
      setLocation(editingEvent.location || '');
      
      // Format date and time
      const eventDate = editingEvent.date;
      const dateStr = eventDate.toISOString().split('T')[0];
      const timeStr = eventDate.toTimeString().slice(0, 5);
      setDate(dateStr);
      setTime(timeStr);
      
      setIsRecurring(editingEvent.isRecurring || false);
      setRecurringType(editingEvent.recurringType || 'weekly');
    } else {
      // Reset form when not editing
      resetForm();
    }
  }, [editingEvent]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setDate('');
    setTime('');
    setEventType('TRAINING');
    setIsRecurring(false);
    setRecurringType('weekly');
    setRecurringEndDate('');
  };

  const handleSubmit = async () => {
    // Para cumpleaños no se requiere hora (será 00:00 por defecto)
    const isBirthday = eventType === 'BIRTHDAY';
    if (!title || !date || (!time && !isBirthday) || !user) return;
    
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
          isRecurring: isRecurring
        };
        
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
        
        if (shouldBeRecurring) {
          // Crear eventos recurrentes
          while (currentDate <= endDate) {
            eventsToCreate.push({
              type: eventType,
              title,
              description: description.trim(),
              location: location.trim(),
              date: new Date(currentDate),
              createdBy: user.id,
              createdAt: serverTimestamp(),
              isRecurring: true,
              recurringType: effectiveRecurringType,
              originalEventId: null
            });
            
            if (effectiveRecurringType === 'weekly') {
              currentDate.setDate(currentDate.getDate() + 7);
            } else if (effectiveRecurringType === 'monthly') {
              currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (effectiveRecurringType === 'yearly') {
              currentDate.setFullYear(currentDate.getFullYear() + 1);
            }
          }
        } else {
          eventsToCreate.push({
            type: eventType,
            title,
            description: description.trim(),
            location: location.trim(),
            date: startDate,
            createdBy: user.id,
            createdAt: serverTimestamp(),
            isRecurring: false
          });
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
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error al guardar el evento');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return null;
  }

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
                    />
                  </div>
                </div>
                
                {isRecurring && (
                  <div className="recurring-options">
                    <div className="form-group">
                      <label>Tipo de Repetición:</label>
                      <div className="toggle-container">
                        <button
                          className={`toggle-btn ${recurringType === 'weekly' ? 'active' : ''}`}
                          onClick={() => setRecurringType('weekly')}
                        >
                          📅 Semanal
                        </button>
                        <button
                          className={`toggle-btn ${recurringType === 'monthly' ? 'active' : ''}`}
                          onClick={() => setRecurringType('monthly')}
                        >
                          📆 Mensual
                        </button>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label>Fecha de Finalización:</label>
                      <input
                        type="date"
                        value={recurringEndDate}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        min={date}
                      />
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
                  ⭐ Los eventos personalizados son únicos, ideales para ocasiones especiales
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
    </>
  );
};

export default CreateEvent;

