import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp, writeBatch, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type Event, type Attendance, type AttendanceStatus, type EventType } from '../types';
import Modal from '../components/Modal';
import CreateEvent from '../components/CreateEvent';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/Home.css';

// Configuración consistente para todos los tooltips
const tooltipStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  color: 'white',
  fontSize: '12px',
  fontFamily: 'var(--font-body)',
  fontWeight: '500',
  borderRadius: '6px',
  padding: '8px 12px',
  maxWidth: '250px',
  wordWrap: 'break-word' as const,
  zIndex: 9999
};

const tooltipProps = {
  place: 'top' as const,
  positionStrategy: 'fixed' as const,
  style: tooltipStyle,
  delayShow: 100,
  noArrow: false,
  offset: 10,
  float: false,
  clickable: false
};

const Home = () => {
  const { user, isReadOnly } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('pending');
  const [comment, setComment] = useState('');
  const [withCar, setWithCar] = useState(false);
  const [canGiveRide, setCanGiveRide] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [eventParticipants, setEventParticipants] = useState<{
    attending: Attendance[];
    pending: Attendance[];
    notAttending: Attendance[];
    notVoted: Attendance[];
  }>({ attending: [], pending: [], notAttending: [], notVoted: [] });
  const [totalUsers, setTotalUsers] = useState(0);
  const [eventParticipantsCount, setEventParticipantsCount] = useState<Record<string, number>>({});
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Auto-cleanup hook

  useEffect(() => {
    loadEvents();
    loadTotalUsers();
  }, []);

  const loadTotalUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      // Count PLAYER and ADMIN users (exclude only VIEWER)
      let userCount = 0;
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.role === 'PLAYER' || userData.role === 'ADMIN') {
          userCount++;
        }
      });
      
      setTotalUsers(userCount);
    } catch (error) {
      console.error('Error loading total users:', error);
    }
  };


  const loadEventParticipantsCount = async (eventIds: string[]) => {
    try {
      const attendancesRef = collection(db, 'attendances');
      const participantsSnapshot = await getDocs(attendancesRef);
      
      const countMap: Record<string, number> = {};
      
      // Initialize all events with 0
      eventIds.forEach(eventId => {
        countMap[eventId] = 0;
      });
      
      // Count participants for each event (excluding VIEWER demo users)
      participantsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Skip demo/viewer users from counts
        if (data.userId === 'testfuria@demo.com') {
          return;
        }
        if (eventIds.includes(data.eventId)) {
          countMap[data.eventId] = (countMap[data.eventId] || 0) + 1;
        }
      });
      
      setEventParticipantsCount(countMap);
    } catch (error) {
      console.error('Error loading event participants count:', error);
    }
  };

  const loadEvents = async () => {
    try {
      // Get events from today to 10 days ahead
      const now = new Date();
      const tenDaysFromNow = new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000)); // 10 days from now
      
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('date', 'asc'));
      const snapshot = await getDocs(q);
      
      const eventsData: Event[] = [];
      const pastEvents: string[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const eventDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        
        // Calculate when this event should be archived (1 hour after event time)
        const eventEndTime = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour after event
        
        // Check if event is past (more than 1 hour after event time)
        if (now > eventEndTime) {
          console.log(`Event "${data.title}" is past:`, {
            eventTime: eventDate.toLocaleString(),
            endTime: eventEndTime.toLocaleString(),
            currentTime: now.toLocaleString(),
            isPast: true
          });
          pastEvents.push(doc.id);
        } else if (eventDate <= tenDaysFromNow) {
          // Only include events within the next 10 days
          console.log(`Event "${data.title}" is active:`, {
            eventTime: eventDate.toLocaleString(),
            endTime: eventEndTime.toLocaleString(),
            currentTime: now.toLocaleString(),
            isPast: false
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
            recurringEndDate: data.recurringEndDate instanceof Timestamp ? data.recurringEndDate.toDate() : (data.recurringEndDate ? new Date(data.recurringEndDate) : undefined),
            originalEventId: data.originalEventId,
            rivalId: data.rivalId || undefined,
            rivalName: data.rivalName || undefined,
            suspended: data.suspended || false,
            suspendedBy: data.suspendedBy,
            suspendedAt: data.suspendedAt instanceof Timestamp ? data.suspendedAt.toDate() : (data.suspendedAt ? new Date(data.suspendedAt) : undefined)
          });
        }
      });

      // Archive past events if any
      if (pastEvents.length > 0) {
        await archivePastEvents(pastEvents);
      }

      setEvents(eventsData);

      // Load participants count for all events
      await loadEventParticipantsCount(eventsData.map(event => event.id));

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
            status: data.status,
            comment: data.comment,
            withCar: data.withCar || false,
            canGiveRide: data.canGiveRide || false,
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
      if (eventIds.length === 0) return;

      // First, get all events to archive them
      const eventsRef = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      const eventsToArchive: any[] = [];
      
      eventsSnapshot.forEach((doc) => {
        if (eventIds.includes(doc.id)) {
          eventsToArchive.push({
            id: doc.id,
            data: doc.data()
          });
        }
      });

      // Get all attendances for these events
      const attendancesRef = collection(db, 'attendances');
      const attendanceSnapshot = await getDocs(attendancesRef);
      const attendancesToArchive: any[] = [];
      
      // Group attendances by userId and eventId for stats update
      const userAttendances = new Map<string, { eventId: string; attended: boolean; eventType: EventType }[]>();
      
      attendanceSnapshot.forEach((attendanceDoc) => {
        const data = attendanceDoc.data();
        if (eventIds.includes(data.eventId)) {
          // Store for archiving
          attendancesToArchive.push({
            id: attendanceDoc.id,
            data: data
          });
          
          // Store for stats calculation
          const userId = data.userId;
          const event = eventsToArchive.find(e => e.id === data.eventId);
          const eventType = event?.data.type;
          
          if (!userAttendances.has(userId)) {
            userAttendances.set(userId, []);
          }
          
          if (eventType) {
            userAttendances.get(userId)!.push({
              eventId: data.eventId,
              attended: data.attending === true || data.status === 'attending',
              eventType: eventType
            });
          }
        }
      });

      // Update stats for each user
      for (const [userId, attendances] of userAttendances) {
        await updatePlayerStats(userId, attendances);
      }

      // Archive events and attendances, then delete originals
      const batch = writeBatch(db);
      
      // 1. Copy events to events_archive
      eventsToArchive.forEach(event => {
        const archiveRef = doc(db, 'events_archive', event.id);
        batch.set(archiveRef, {
          ...event.data,
          archivedAt: serverTimestamp()
        });
      });
      
      // 2. Copy attendances to attendances_archive
      attendancesToArchive.forEach(attendance => {
        const archiveRef = doc(db, 'attendances_archive', attendance.id);
        batch.set(archiveRef, {
          ...attendance.data,
          archivedAt: serverTimestamp()
        });
      });
      
      // 3. Delete original events
      eventIds.forEach(eventId => {
        const eventRef = doc(db, 'events', eventId);
        batch.delete(eventRef);
      });
      
      // 4. Delete original attendances
      attendancesToArchive.forEach(attendance => {
        const attendanceRef = doc(db, 'attendances', attendance.id);
        batch.delete(attendanceRef);
      });
      
      await batch.commit();
      
      console.log(`✅ Archived ${eventIds.length} events and ${attendancesToArchive.length} attendances`);
    } catch (error) {
      console.error('Error archiving past events:', error);
    }
  };

  const updatePlayerStats = async (
    userId: string, 
    attendances: { eventId: string; attended: boolean; eventType: EventType }[]
  ) => {
    try {
      const statsRef = doc(db, 'stats', userId);
      const statsDoc = await getDoc(statsRef);
      
      let matchesAttended = 0;
      let trainingsAttended = 0;
      
      // Count new attendances (solo MATCH y TRAINING, excluye BIRTHDAY y CUSTOM)
      attendances.forEach(att => {
        if (att.attended) {
          if (att.eventType === 'MATCH') {
            matchesAttended++;
          } else if (att.eventType === 'TRAINING') {
            trainingsAttended++;
          }
          // BIRTHDAY y CUSTOM no cuentan para estadísticas
        }
      });
      
      if (statsDoc.exists()) {
        // Update existing stats
        const currentData = statsDoc.data();
        const newMatchesAttended = (currentData.matchesAttended || 0) + matchesAttended;
        const newTrainingsAttended = (currentData.trainingsAttended || 0) + trainingsAttended;
        
        await setDoc(statsRef, {
          matchesAttended: newMatchesAttended,
          trainingsAttended: newTrainingsAttended,
          totalAttended: newMatchesAttended + newTrainingsAttended,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      } else {
        // Create new stats document
        // Get user display name from users collection to ensure consistency
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', userId));
        const userSnapshot = await getDocs(userQuery);
        
        let displayName = 'Unknown';
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          displayName = userData.alias || userData.email || 'Unknown';
        }
        
        await setDoc(statsRef, {
          userId,
          displayName,
          matchesAttended,
          trainingsAttended,
          totalAttended: matchesAttended + trainingsAttended,
          goals: 0,
          assists: 0,
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  };


  const loadEventParticipants = async (eventId: string) => {
    try {
      // Fetch all users
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      // Fetch participants who have voted for this event
      const attendancesRef = collection(db, 'attendances');
      const participantsQuery = query(attendancesRef, where('eventId', '==', eventId));
      const participantsSnapshot = await getDocs(participantsQuery);
      
      const participants: Attendance[] = [];
      const votedUserEmails = new Set<string>();
      
      participantsSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Skip VIEWER users (demo accounts) from participant lists
        if (data.userId === 'testfuria@demo.com') {
          return;
        }
        
        // Use email as the common identifier
        const userEmail = data.userEmail || data.userId; // Fallback to userId if email not available
        votedUserEmails.add(userEmail);
        participants.push({
          id: doc.id,
          eventId: data.eventId,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          attending: data.attending,
          status: data.status || (data.attending ? 'attending' : 'not-attending'),
          comment: data.comment,
          withCar: data.withCar || false,
          canGiveRide: data.canGiveRide || false,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
        });
      });
      
      // Find users who haven't voted yet (excluding only VIEWER roles)
      const usersWhoHaventVoted: Attendance[] = [];
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const userEmail = userData.email;
        const userRole = userData.role;
        
        // Skip only VIEWER users from participant lists (keep ADMIN and PLAYER)
        if (userRole === 'VIEWER') {
          return;
        }
        
        if (!votedUserEmails.has(userEmail)) {
          usersWhoHaventVoted.push({
            id: `pending_${userDoc.id}_${eventId}`,
            eventId: eventId,
            userId: userDoc.id,
            userDisplayName: userData.alias || 'Usuario sin nombre',
            attending: false,
            status: 'not-voted' as AttendanceStatus,
            comment: '',
            withCar: false,
            canGiveRide: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      });
      
      // Group participants by status
      const groupedParticipants = {
        attending: participants.filter(p => {
          const status = p.status || (p.attending ? 'attending' : 'not-attending');
          return status === 'attending';
        }).sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName)),
        
        pending: participants.filter(p => {
          const status = p.status || (p.attending ? 'attending' : 'not-attending');
          return status === 'pending';
        }).sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName)),
        
        notAttending: participants.filter(p => {
          const status = p.status || (p.attending ? 'attending' : 'not-attending');
          return status === 'not-attending';
        }).sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName)),
        
        notVoted: usersWhoHaventVoted.sort((a, b) => a.userDisplayName.localeCompare(b.userDisplayName))
      };
      
      console.log('👥 Participantes cargados con iconos:', {
        attending: groupedParticipants.attending.map(p => ({
          name: p.userDisplayName,
          withCar: p.withCar,
          canGiveRide: p.canGiveRide
        }))
      });
      
      setEventParticipants(groupedParticipants);
    } catch (error) {
      console.error('Error loading event participants:', error);
    }
  };

  const handleViewParticipants = async (event: Event) => {
    await loadEventParticipants(event.id);
    setShowParticipantsModal(true);
  };

  const handleEventClick = async (event: Event) => {
    // Block for read-only users
    if (isReadOnly) {
      alert('⚠️ Cuenta de demostración - No podés modificar tu participación');
      return;
    }

    setLoadingModal(true);
    setSelectedEvent(event);
    
    try {
      const existingAttendance = attendances[event.id];
      
      // Load participants for this event to show vote count
      await loadEventParticipants(event.id);
      
      if (existingAttendance) {
        // Use new status field if available, otherwise fallback to old attending field
        if (existingAttendance.status) {
          setAttendanceStatus(existingAttendance.status);
        } else {
          setAttendanceStatus(existingAttendance.attending ? 'attending' : 'not-attending');
        }
        // Load car info
        setWithCar(existingAttendance.withCar || false);
        setCanGiveRide(existingAttendance.canGiveRide || false);
        
        console.log('📥 Cargando asistencia existente:', {
          withCar: existingAttendance.withCar,
          canGiveRide: existingAttendance.canGiveRide,
          status: existingAttendance.status
        });
      } else {
        // No previous vote - default to pending
        setAttendanceStatus('pending');
        setWithCar(false);
        setCanGiveRide(false);
      }
      
      setComment(existingAttendance?.comment || '');
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedEvent || !user) return;

    // Block save for read-only users
    if (isReadOnly) {
      alert('⚠️ Cuenta de demostración - No podés guardar cambios');
      return;
    }

    setSavingAttendance(true);
    try {
      const { doc: firestoreDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      // Get user's alias from users collection to ensure consistency
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', user.id));
      const userSnapshot = await getDocs(userQuery);
      
      let displayName = user.displayName;
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        displayName = userData.alias || user.displayName;
      }

      const attendanceData = {
        eventId: selectedEvent.id,
        userId: user.id,
        userDisplayName: displayName,
        attending: attendanceStatus === 'attending',
        status: attendanceStatus, // Save the actual status including 'pending'
        comment: comment.trim(),
        withCar: attendanceStatus === 'attending' ? withCar : false,
        canGiveRide: attendanceStatus === 'attending' && withCar ? canGiveRide : false,
        updatedAt: serverTimestamp()
      };

      console.log('💾 Guardando asistencia:', {
        withCar,
        canGiveRide,
        attendanceStatus,
        finalData: attendanceData
      });

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

      // Reload events and participants count
      await loadEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error al guardar la asistencia');
    } finally {
      setSavingAttendance(false);
    }
  };

  const formatDate = (date: Date, eventType?: string) => {
    // Los cumpleaños son eventos de todo el día, no muestran hora
    if (eventType === 'BIRTHDAY') {
      return date.toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilEvent = (eventDate: Date): number => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diffTime = eventDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDaysUntil = (days: number): string => {
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    if (days < 0) return 'Pasado';
    return `En ${days} días`;
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

  const handleEditEvent = (event: Event) => {
    // Las jugadoras solo pueden editar eventos CUSTOM
    if (user?.role === 'PLAYER' && event.type !== 'CUSTOM') {
      alert('⚠️ Las jugadoras solo pueden editar eventos personalizados');
      return;
    }
    setEditingEvent(event);
    setShowCreateEventModal(true);
  };

  const handleDeleteEvent = async (eventId: string, eventType?: EventType) => {
    // Las jugadoras solo pueden eliminar eventos CUSTOM
    if (user?.role === 'PLAYER' && eventType !== 'CUSTOM') {
      alert('⚠️ Las jugadoras solo pueden eliminar eventos personalizados');
      return;
    }

    if (!window.confirm('¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
      
      // Delete the event
      await deleteDoc(firestoreDoc(db, 'events', eventId));
      
      // Delete all attendances related to this event
      const attendancesRef = collection(db, 'attendances');
      const attendancesQuery = query(attendancesRef, where('eventId', '==', eventId));
      const attendancesSnapshot = await getDocs(attendancesQuery);
      
      const batch = writeBatch(db);
      attendancesSnapshot.forEach((attendanceDoc) => {
        batch.delete(firestoreDoc(db, 'attendances', attendanceDoc.id));
      });
      await batch.commit();
      
      showToast('✓ Evento eliminado exitosamente', 'success');
      await loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('✗ Error al eliminar el evento', 'error');
    }
  };

  if (loading) {
    return <div className="loading">Cargando eventos...</div>;
  }

  return (
    <div className="home-container">
      <h1>Próximos Eventos</h1>
      
      <CreateEvent 
        onEventCreated={() => {
          loadEvents();
          setShowCreateEventModal(false);
          setEditingEvent(null);
        }} 
        editingEvent={editingEvent}
        isOpen={showCreateEventModal}
        onClose={() => {
          setShowCreateEventModal(false);
          setEditingEvent(null);
        }}
      />

      {events.length === 0 ? (
        <p className="no-events">No hay eventos próximos</p>
      ) : (
        <div className="events-list">
          {events.map((event) => {
            const userAttendance = attendances[event.id];
            const isRegistered = !!userAttendance;
            const isAttending = userAttendance?.attending;
            const daysUntil = getDaysUntilEvent(event.date);

            return (
              <div key={event.id} className="event-card">
                <div className="event-header">
                  <div className="event-type">
                    {event.type === 'MATCH' ? '⚽ Partido' 
                      : event.type === 'TRAINING' ? '🏃 Entrenamiento'
                      : event.type === 'BIRTHDAY' ? '🎂 Cumpleaños'
                      : '⭐ Personalizado'}
                  </div>
                  <div className="event-countdown">
                    {formatDaysUntil(daysUntil)}
                  </div>
                </div>
                <h3>
                  {event.type === 'MATCH' && event.rivalName ? (
                    <>
                      <span className="match-title-furia">FURIA</span>
                      <span className="match-vs"> VS </span>
                      <span className="match-title-rival">{event.rivalName}</span>
                    </>
                  ) : (
                    event.title
                  )}
                </h3>
                <p className="event-date">{formatDate(event.date, event.type)}</p>
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
                      {...tooltipProps}
                    />
                  </section>
                </div>
                {event.description && event.description.trim() && (
                  <p className="event-description">{event.description}</p>
                )}
                
                {/* Banner de evento suspendido */}
                {event.suspended && (
                  <div className="event-suspended-banner">
                    <span className="suspended-icon">🚫</span>
                    <span className="suspended-text">Este evento ha sido suspendido</span>
                  </div>
                )}
                
                {event.type === 'BIRTHDAY' ? (
                  // Birthday events: Solo informativo, sin participación
                  <>
                    <div className="event-info-banner">
                      <span className="info-icon">📅</span>
                      <span className="info-text">Evento de recordatorio - No requiere confirmación</span>
                    </div>
                    
                    {user?.role === 'ADMIN' && (
                      <>
                        <div className="admin-event-actions-mobile admin-birthday-mobile">
                          <button 
                            onClick={() => handleEditEvent(event)}
                            className="btn-admin-edit-mobile"
                            title="Editar evento"
                          >
                            ✏️ Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(event.id, event.type)}
                            className="btn-admin-delete-mobile"
                            title="Eliminar evento"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                        
                        <div className="admin-event-actions-desktop">
                          <button 
                            onClick={() => handleEditEvent(event)}
                            className="btn-admin-edit"
                            title="Editar evento"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(event.id, event.type)}
                            className="btn-admin-delete"
                            title="Eliminar evento"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // Other events: Con participación normal
                  <>
                    {!event.suspended && (
                      <div className="event-status-row">
                        <div className="event-status">
                          {isRegistered ? (
                            <span className={`status-badge ${isAttending ? 'attending' : 'not-attending'}`}>
                              {isAttending ? '✓ Confirmado' : '✗ No asisto'}
                            </span>
                          ) : (
                            <span className="status-badge pending">
                              ⏳ Pendiente
                            </span>
                          )}
                        </div>
                        <div className="event-votes-counter">
                          <span className="votes-text">
                            {eventParticipantsCount[event.id] || 0} / {totalUsers} personas votaron
                            {(eventParticipantsCount[event.id] || 0) === totalUsers && totalUsers > 0 && ' 🎉'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="event-actions">
                      {!event.suspended && (
                        <button 
                          onClick={() => handleEventClick(event)}
                          className="btn-primary"
                          disabled={isReadOnly}
                          title={isReadOnly ? 'Cuenta de demostración - Solo lectura' : ''}
                        >
                          {isRegistered ? 'Editar Participación' : 'Anotarse'}
                        </button>
                      )}
                      <button 
                        onClick={() => handleViewParticipants(event)}
                        className="btn-secondary"
                      >
                        Ver Participantes
                      </button>
                      
                      {(user?.role === 'ADMIN' || (user?.role === 'PLAYER' && event.type === 'CUSTOM')) && (
                        <div className="admin-event-actions-mobile">
                          <button 
                            onClick={() => handleEditEvent(event)}
                            className="btn-admin-edit-mobile"
                            title="Editar evento"
                          >
                            ✏️ Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(event.id, event.type)}
                            className="btn-admin-delete-mobile"
                            title="Eliminar evento"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {(user?.role === 'ADMIN' || (user?.role === 'PLAYER' && event.type === 'CUSTOM')) && (
                      <div className="admin-event-actions-desktop">
                        <button 
                          onClick={() => handleEditEvent(event)}
                          className="btn-admin-edit"
                          title="Editar evento"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteEvent(event.id, event.type)}
                          className="btn-admin-delete"
                          title="Eliminar evento"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedEvent && (
        <Modal 
          onClose={() => {
            setSelectedEvent(null);
            setLoadingModal(false);
          }} 
          title={`${selectedEvent.title}`}
          onSubmit={handleSaveAttendance}
        >
          {loadingModal ? (
            <div className="modal-loader">
              <div className="loader-spinner"></div>
              <p>Cargando datos del evento...</p>
            </div>
          ) : (
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
                  className={`toggle-btn ${attendanceStatus === 'not-attending' ? 'active' : ''}`}
                  onClick={() => setAttendanceStatus('not-attending')}
                  disabled={savingAttendance}
                >
                  No asisto
                </button>
                <button
                  className={`toggle-btn ${attendanceStatus === 'pending' ? 'active' : ''}`}
                  onClick={() => setAttendanceStatus('pending')}
                  disabled={savingAttendance}
                  data-status="pending"
                >
                  Pendiente
                </button>
                <button
                  className={`toggle-btn ${attendanceStatus === 'attending' ? 'active' : ''}`}
                  onClick={() => setAttendanceStatus('attending')}
                  disabled={savingAttendance}
                >
                  Sí asisto
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
                disabled={savingAttendance}
              />
              <span className="char-count">{comment.length}/50</span>
            </div>

            {attendanceStatus === 'attending' && (
              <div className="form-group car-options-row">
                <div className="toggle-label">
                  <span className="toggle-text">🚗 Voy con auto</span>
                  <input
                    type="checkbox"
                    checked={withCar}
                    onChange={(e) => {
                      setWithCar(e.target.checked);
                      // Si desmarco "voy con auto", también desmarcar "puedo llevar a alguien"
                      if (!e.target.checked) {
                        setCanGiveRide(false);
                      }
                    }}
                    disabled={savingAttendance}
                  />
                </div>

                <div className="toggle-label">
                  <span className="toggle-text">👥 Puedo llevar a alguien</span>
                  <input
                    type="checkbox"
                    checked={canGiveRide}
                    onChange={(e) => setCanGiveRide(e.target.checked)}
                    disabled={savingAttendance || !withCar}
                  />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="btn-secondary"
                disabled={savingAttendance}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveAttendance} 
                className="btn-primary"
                disabled={savingAttendance}
              >
                {savingAttendance ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
          )}
        </Modal>
      )}

      {showParticipantsModal && (
        <Modal 
          onClose={() => setShowParticipantsModal(false)} 
          title="Participantes del Evento"
        >
          <div className="participants-container">
            {eventParticipants.attending.length === 0 && eventParticipants.pending.length === 0 && eventParticipants.notAttending.length === 0 && eventParticipants.notVoted.length === 0 ? (
              <p className="no-participants">No hay participantes registrados aún</p>
            ) : (
              <div className="participants-list">
                {/* Grupo: Asisten */}
                {eventParticipants.attending.length > 0 && (
                  <div className="participant-group">
                    <h3 className="group-title attending">✓ Asisten ({eventParticipants.attending.length})</h3>
                    {eventParticipants.attending.map((participant) => (
                      <div key={participant.id} className="participant-item">
                        <div className="participant-info">
                          <div className="participant-name">
                            {participant.userDisplayName}
                          </div>
                        </div>
                        <div className="participant-icons">
                          {participant.withCar && (
                            <span 
                              className="car-icon"
                              data-tooltip-id={`car-tooltip-${participant.id}`}
                              data-tooltip-content="Va con auto"
                            >
                              🚗
                            </span>
                          )}
                          {participant.canGiveRide && (
                            <span 
                              className="ride-icon"
                              data-tooltip-id={`ride-tooltip-${participant.id}`}
                              data-tooltip-content="Puede llevar a alguien"
                            >
                              👥
                            </span>
                          )}
                          <span 
                            className={`comment-icon ${participant.comment ? 'has-comment' : 'no-comment'}`}
                            data-tooltip-id={`comment-tooltip-${participant.id}`}
                            data-tooltip-content={participant.comment || 'Sin comentario'}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </span>
                          <Tooltip 
                            id={`comment-tooltip-${participant.id}`}
                            {...tooltipProps}
                          />
                          {participant.withCar && (
                            <Tooltip 
                              id={`car-tooltip-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                          {participant.canGiveRide && (
                            <Tooltip 
                              id={`ride-tooltip-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grupo: Pendientes */}
                {eventParticipants.pending.length > 0 && (
                  <div className="participant-group">
                    <h3 className="group-title pending">⏳ Pendientes ({eventParticipants.pending.length})</h3>
                    {eventParticipants.pending.map((participant) => (
                      <div key={participant.id} className="participant-item">
                        <div className="participant-info">
                          <div className="participant-name">
                            {participant.userDisplayName}
                          </div>
                        </div>
                        <div className="participant-icons">
                          {participant.withCar && (
                            <span 
                              className="car-icon"
                              data-tooltip-id={`car-tooltip-pending-${participant.id}`}
                              data-tooltip-content="Va con auto"
                            >
                              🚗
                            </span>
                          )}
                          {participant.canGiveRide && (
                            <span 
                              className="ride-icon"
                              data-tooltip-id={`ride-tooltip-pending-${participant.id}`}
                              data-tooltip-content="Puede llevar a alguien"
                            >
                              👥
                            </span>
                          )}
                          <span 
                            className={`comment-icon ${participant.comment ? 'has-comment' : 'no-comment'}`}
                            data-tooltip-id={`comment-tooltip-pending-${participant.id}`}
                            data-tooltip-content={participant.comment || 'Sin comentario'}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </span>
                          <Tooltip 
                            id={`comment-tooltip-pending-${participant.id}`}
                            {...tooltipProps}
                          />
                          {participant.withCar && (
                            <Tooltip 
                              id={`car-tooltip-pending-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                          {participant.canGiveRide && (
                            <Tooltip 
                              id={`ride-tooltip-pending-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grupo: No asisten */}
                {eventParticipants.notAttending.length > 0 && (
                  <div className="participant-group">
                    <h3 className="group-title not-attending">✗ No asisten ({eventParticipants.notAttending.length})</h3>
                    {eventParticipants.notAttending.map((participant) => (
                      <div key={participant.id} className="participant-item">
                        <div className="participant-info">
                          <div className="participant-name">
                            {participant.userDisplayName}
                          </div>
                        </div>
                        <div className="participant-icons">
                          {participant.withCar && (
                            <span 
                              className="car-icon"
                              data-tooltip-id={`car-tooltip-not-${participant.id}`}
                              data-tooltip-content="Va con auto"
                            >
                              🚗
                            </span>
                          )}
                          {participant.canGiveRide && (
                            <span 
                              className="ride-icon"
                              data-tooltip-id={`ride-tooltip-not-${participant.id}`}
                              data-tooltip-content="Puede llevar a alguien"
                            >
                              👥
                            </span>
                          )}
                          <span 
                            className={`comment-icon ${participant.comment ? 'has-comment' : 'no-comment'}`}
                            data-tooltip-id={`comment-tooltip-not-${participant.id}`}
                            data-tooltip-content={participant.comment || 'Sin comentario'}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </span>
                          <Tooltip 
                            id={`comment-tooltip-not-${participant.id}`}
                            {...tooltipProps}
                          />
                          {participant.withCar && (
                            <Tooltip 
                              id={`car-tooltip-not-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                          {participant.canGiveRide && (
                            <Tooltip 
                              id={`ride-tooltip-not-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grupo: No han votado */}
                {eventParticipants.notVoted.length > 0 && (
                  <div className="participant-group">
                    <h3 className="group-title not-voted">⚠️ No han votado ({eventParticipants.notVoted.length})</h3>
                    {eventParticipants.notVoted.map((participant) => (
                      <div key={participant.id} className="participant-item">
                        <div className="participant-info">
                          <div className="participant-name">
                            {participant.userDisplayName}
                          </div>
                        </div>
                        <div className="participant-icons">
                          {participant.withCar && (
                            <span 
                              className="car-icon"
                              data-tooltip-id={`car-tooltip-notvoted-${participant.id}`}
                              data-tooltip-content="Va con auto"
                            >
                              🚗
                            </span>
                          )}
                          {participant.canGiveRide && (
                            <span 
                              className="ride-icon"
                              data-tooltip-id={`ride-tooltip-notvoted-${participant.id}`}
                              data-tooltip-content="Puede llevar a alguien"
                            >
                              👥
                            </span>
                          )}
                          <span 
                            className="comment-icon no-comment"
                            data-tooltip-id={`comment-tooltip-notvoted-${participant.id}`}
                            data-tooltip-content="Aún no ha votado"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </span>
                          <Tooltip 
                            id={`comment-tooltip-notvoted-${participant.id}`}
                            {...tooltipProps}
                          />
                          {participant.withCar && (
                            <Tooltip 
                              id={`car-tooltip-notvoted-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                          {participant.canGiveRide && (
                            <Tooltip 
                              id={`ride-tooltip-notvoted-${participant.id}`}
                              {...tooltipProps}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Home;

