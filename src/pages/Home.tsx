import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type Event, type Attendance } from '../types';
import Modal from '../components/Modal';
import CreateEvent from '../components/CreateEvent';
import '../styles/Home.css';

const Home = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attending, setAttending] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      // Get future events
      const now = new Date();
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('date', 'asc'));
      const snapshot = await getDocs(q);
      
      const eventsData: Event[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const eventDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        
        // Only include future events
        if (eventDate >= now) {
          eventsData.push({
            id: doc.id,
            type: data.type,
            date: eventDate,
            title: data.title,
            description: data.description,
            createdBy: data.createdBy,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
          });
        }
      });

      setEvents(eventsData);

      // Load user's attendances
      if (user) {
        const attendancesRef = collection(db, 'attendances');
        const attendanceQuery = query(attendancesRef, where('userId', '==', user.id));
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        const attendancesMap: Record<string, Attendance> = {};
        attendanceSnapshot.forEach((doc) => {
          const data = doc.data();
          attendancesMap[data.eventId] = {
            id: doc.id,
            eventId: data.eventId,
            userId: data.userId,
            userDisplayName: data.userDisplayName,
            attending: data.attending,
            comment: data.comment,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
          };
        });
        setAttendances(attendancesMap);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: Event) => {
    const existingAttendance = attendances[event.id];
    setSelectedEvent(event);
    setAttending(existingAttendance?.attending || false);
    setComment(existingAttendance?.comment || '');
  };

  const handleSaveAttendance = async () => {
    if (!selectedEvent || !user) return;

    try {
      const { doc: firestoreDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      const attendanceData = {
        eventId: selectedEvent.id,
        userId: user.id,
        userDisplayName: user.displayName,
        attending,
        comment: comment.trim(),
        updatedAt: serverTimestamp()
      };

      const attendanceId = attendances[selectedEvent.id]?.id || `${user.id}_${selectedEvent.id}`;
      
      if (!attendances[selectedEvent.id]) {
        // New attendance
        await setDoc(firestoreDoc(db, 'attendances', attendanceId), {
          ...attendanceData,
          createdAt: serverTimestamp()
        });
      } else {
        // Update existing
        await setDoc(firestoreDoc(db, 'attendances', attendanceId), attendanceData, { merge: true });
      }

      // Reload events
      await loadEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error al guardar la asistencia');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Cargando eventos...</div>;
  }

  return (
    <div className="home-container">
      <h1>Próximos Eventos</h1>
      
      <CreateEvent onEventCreated={loadEvents} />

      {events.length === 0 ? (
        <p className="no-events">No hay eventos próximos</p>
      ) : (
        <div className="events-list">
          {events.map((event) => {
            const userAttendance = attendances[event.id];
            const isRegistered = !!userAttendance;
            const isAttending = userAttendance?.attending;

            return (
              <div key={event.id} className="event-card">
                <div className="event-type">
                  {event.type === 'TRAINING' ? '⚽ Entrenamiento' : '🏆 Partido'}
                </div>
                <h3>{event.title}</h3>
                <p className="event-date">{formatDate(event.date)}</p>
                {event.description && <p className="event-description">{event.description}</p>}
                
                <div className="event-status">
                  {isRegistered && (
                    <span className={`status-badge ${isAttending ? 'attending' : 'not-attending'}`}>
                      {isAttending ? '✓ Confirmado' : '✗ No asisto'}
                    </span>
                  )}
                </div>

                <button 
                  onClick={() => handleEventClick(event)}
                  className="btn-primary"
                >
                  {isRegistered ? 'Editar Participación' : 'Anotarse'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedEvent && (
        <Modal 
          onClose={() => setSelectedEvent(null)} 
          title={`${selectedEvent.title}`}
        >
          <div className="attendance-form">
            <div className="form-group">
              <label>Participante:</label>
              <input 
                type="text" 
                value={user?.displayName} 
                disabled 
                className="input-disabled"
              />
            </div>

            <div className="form-group toggle-group">
              <label>¿Vas a asistir?</label>
              <div className="toggle-container">
                <button
                  className={`toggle-btn ${!attending ? 'active' : ''}`}
                  onClick={() => setAttending(false)}
                >
                  No
                </button>
                <button
                  className={`toggle-btn ${attending ? 'active' : ''}`}
                  onClick={() => setAttending(true)}
                >
                  Sí
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Comentario (opcional):</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 50))}
                placeholder="Dejá un comentario..."
                maxLength={50}
                rows={3}
              />
              <span className="char-count">{comment.length}/50</span>
            </div>

            <div className="modal-actions">
              <button onClick={() => setSelectedEvent(null)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSaveAttendance} className="btn-primary">
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Home;

