import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type EventType } from '../types';
import Modal from './Modal';
import '../styles/CreateEvent.css';

interface CreateEventProps {
  onEventCreated: () => void;
}

const CreateEvent = ({ onEventCreated }: CreateEventProps) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [eventType, setEventType] = useState<EventType>('TRAINING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weekly' | 'monthly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !date || !time || !user) return;
    if (isRecurring && !recurringEndDate) {
      alert('Debes especificar una fecha de finalización para eventos recurrentes');
      return;
    }

    setLoading(true);
    try {
      const startDate = new Date(`${date}T${time}`);
      const endDate = isRecurring ? new Date(`${recurringEndDate}T${time}`) : startDate;
      
      const eventsToCreate = [];
      const currentDate = new Date(startDate);
      
      if (isRecurring) {
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
            recurringType,
            originalEventId: null // Se puede usar para agrupar eventos relacionados
          });
          
          // Incrementar fecha según el tipo de recurrencia
          if (recurringType === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (recurringType === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      } else {
        // Crear evento único
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

      // Crear todos los eventos
      const batch = [];
      for (const eventData of eventsToCreate) {
        batch.push(addDoc(collection(db, 'events'), eventData));
      }
      
      await Promise.all(batch);

      // Reset form
      setTitle('');
      setDescription('');
      setLocation('');
      setDate('');
      setTime('');
      setEventType('TRAINING');
      setIsRecurring(false);
      setRecurringType('weekly');
      setRecurringEndDate('');
      setShowModal(false);
      onEventCreated();
      
      const eventCount = eventsToCreate.length;
      alert(`¡Evento${eventCount > 1 ? 's' : ''} creado${eventCount > 1 ? 's' : ''} exitosamente! ${eventCount > 1 ? `Se crearon ${eventCount} eventos.` : ''}`);
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error al crear el evento');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-primary create-event-btn">
        ➕ Crear Evento
      </button>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title="Crear Nuevo Evento">
          <div className="event-form">
            <div className="form-group">
              <label>Tipo de Evento:</label>
              <div className="toggle-container">
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

            <div className="form-group">
              <label>Hora:</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

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
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button 
                onClick={handleSubmit} 
                className="btn-primary"
                disabled={loading || !title || !date || !time}
              >
                {loading ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CreateEvent;

