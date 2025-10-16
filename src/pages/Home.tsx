import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type Event, type Attendance } from '../types';
import Modal from '../components/Modal';
import CreateEvent from '../components/CreateEvent';
import { Tooltip } from 'react-tooltip';
import '../styles/Home.css';

const Home = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attending, setAttending] = useState(false);
  const [comment, setComment] = useState('');

  // Auto-cleanup hook

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      // Get events within the next 2 weeks
      const now = new Date();
      const bufferTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour buffer for display
      const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 2 weeks from now
      
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('date', 'asc'));
      const snapshot = await getDocs(q);
      
      const eventsData: Event[] = [];
      const pastEvents: string[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const eventDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        
        // Check if event is past (with buffer)
        if (eventDate < bufferTime) {
          pastEvents.push(doc.id);
        } else if (eventDate <= twoWeeksFromNow) {
          // Only include events within the next 2 weeks
          // Debug: Log event data to check for corruption
          console.log('Event data:', {
            id: doc.id,
            title: data.title,
            description: data.description,
            location: data.location
          });
          
          eventsData.push({
            id: doc.id,
            type: data.type,
            date: eventDate,
            title: data.title,
            description: data.description ? data.description.trim() : '',
            location: data.location ? data.location.trim() : '',
            createdBy: data.createdBy,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            isRecurring: data.isRecurring,
            recurringType: data.recurringType,
            originalEventId: data.originalEventId
          });
        }
      });

      // Archive past events if any
      if (pastEvents.length > 0) {
        await archivePastEvents(pastEvents);
      }

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

  const archivePastEvents = async (eventIds: string[]) => {
    try {
      const batch = writeBatch(db);
      
      // Delete past events from events collection
      eventIds.forEach(eventId => {
        const eventRef = doc(db, 'events', eventId);
        batch.delete(eventRef);
      });
      
      // Also delete related attendances
      const attendancesRef = collection(db, 'attendances');
      const attendanceSnapshot = await getDocs(attendancesRef);
      
      attendanceSnapshot.forEach((attendanceDoc) => {
        const data = attendanceDoc.data();
        if (eventIds.includes(data.eventId)) {
          batch.delete(attendanceDoc.ref);
        }
      });
      
      await batch.commit();
      
      if (eventIds.length > 0) {
        console.log(`Archived ${eventIds.length} past events`);
      }
    } catch (error) {
      console.error('Error archiving past events:', error);
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

  const copyLocation = async (location: string) => {
    try {
      await navigator.clipboard.writeText(location);
      showToast('📍 Ubicación copiada al portapapeles', 'success');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = location;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('📍 Ubicación copiada al portapapeles', 'success');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add styles
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '600',
      fontSize: '14px',
      zIndex: '10000',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease-in-out',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      backgroundColor: type === 'success' ? '#28a745' : '#dc3545'
    });
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
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
                <div className="event-location">
                  <section className="location-container">
                    <p className="location-label">📍</p>
                    <p className="location-text">{event.location || 'Ubicación no especificada'}</p>
                  </section>
                  <section className="location-button-container">
                    <button 
                      onClick={() => copyLocation(event.location || 'Ubicación no especificada')}
                      className="copy-location-btn"
                      data-tooltip-id={`copy-tooltip-${event.id}`}
                      data-tooltip-content="Copiar ubicación"
                      aria-label="Copiar ubicación al portapapeles"
                    >
                      ⧉
                    </button>
                    <Tooltip 
                      id={`copy-tooltip-${event.id}`}
                      place="top"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        color: 'white',
                        fontSize: '12px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: '500',
                        borderRadius: '6px',
                        padding: '6px 10px'
                      }}
                    />
                  </section>
                </div>
                {event.description && event.description.trim() && (
                  <p className="event-description">{event.description}</p>
                )}
                
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

