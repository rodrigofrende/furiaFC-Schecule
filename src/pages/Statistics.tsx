import { useState, useEffect } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type Event, type Attendance, type AttendanceStats } from '../types';
import '../styles/Statistics.css';

const Statistics = () => {
  const [stats, setStats] = useState<AttendanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      // Get all past events
      const eventsRef = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      
      const pastEvents: Event[] = [];
      const now = new Date();
      
      eventsSnapshot.forEach((doc) => {
        const data = doc.data();
        const eventDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        
        // Only count past events for statistics
        if (eventDate < now) {
          pastEvents.push({
            id: doc.id,
            type: data.type,
            date: eventDate,
            title: data.title,
            createdBy: data.createdBy,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
          });
        }
      });

      setTotalEvents(pastEvents.length);

      if (pastEvents.length === 0) {
        setLoading(false);
        return;
      }

      // Get all attendances
      const attendancesRef = collection(db, 'attendances');
      const attendancesSnapshot = await getDocs(attendancesRef);
      
      const attendancesMap = new Map<string, Attendance[]>();
      
      attendancesSnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;
        
        if (!attendancesMap.has(userId)) {
          attendancesMap.set(userId, []);
        }
        
        attendancesMap.get(userId)!.push({
          id: doc.id,
          eventId: data.eventId,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          attending: data.attending,
          comment: data.comment,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
        });
      });

      // Calculate stats for each user
      const statsArray: AttendanceStats[] = [];
      const pastEventIds = new Set(pastEvents.map(e => e.id));

      attendancesMap.forEach((userAttendances, userId) => {
        // Filter attendances for past events only
        const relevantAttendances = userAttendances.filter(a => pastEventIds.has(a.eventId));
        
        if (relevantAttendances.length > 0) {
          const attended = relevantAttendances.filter(a => a.attending).length;
          const displayName = relevantAttendances[0].userDisplayName;
          
          statsArray.push({
            userId,
            displayName,
            totalEvents: pastEvents.length,
            attended,
            percentage: pastEvents.length > 0 ? (attended / pastEvents.length) * 100 : 0
          });
        }
      });

      // Sort by percentage (descending)
      statsArray.sort((a, b) => b.percentage - a.percentage);

      setStats(statsArray);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando estadísticas...</div>;
  }

  return (
    <div className="statistics-container">
      <h1>Estadísticas de Asistencia</h1>

      {totalEvents === 0 ? (
        <p className="no-data">Aún no hay eventos registrados para mostrar estadísticas</p>
      ) : (
        <>
          <div className="stats-summary">
            <div className="stat-card">
              <h3>Total de Eventos</h3>
              <p className="stat-number">{totalEvents}</p>
            </div>
            <div className="stat-card">
              <h3>Jugadoras Registradas</h3>
              <p className="stat-number">{stats.length}</p>
            </div>
          </div>

          {stats.length === 0 ? (
            <p className="no-data">No hay asistencias registradas todavía</p>
          ) : (
            <div className="stats-table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Posición</th>
                    <th>Jugadora</th>
                    <th>Asistencias</th>
                    <th>Porcentaje</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, index) => (
                    <tr key={stat.userId} className={index < 3 ? `top-${index + 1}` : ''}>
                      <td className="position">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `#${index + 1}`}
                      </td>
                      <td className="player-name">{stat.displayName}</td>
                      <td>{stat.attended} / {stat.totalEvents}</td>
                      <td>
                        <div className="percentage-container">
                          <div 
                            className="percentage-bar" 
                            style={{ width: `${stat.percentage}%` }}
                          />
                          <span className="percentage-text">
                            {stat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Statistics;

