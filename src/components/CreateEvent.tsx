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
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !date || !time || !user) return;

    setLoading(true);
    try {
      const eventDate = new Date(`${date}T${time}`);
      
      await addDoc(collection(db, 'events'), {
        type: eventType,
        title,
        description: description.trim(),
        date: eventDate,
        createdBy: user.id,
        createdAt: serverTimestamp()
      });

      // Reset form
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setEventType('TRAINING');
      setShowModal(false);
      onEventCreated();
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
                maxLength={100}
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
              <label>Descripción (opcional):</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Información adicional..."
                maxLength={200}
                rows={3}
              />
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

