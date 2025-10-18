import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type PlayerStats } from '../types';
import Modal from '../components/Modal';
import { Tooltip } from 'react-tooltip';
import '../styles/Statistics.css';

const Statistics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [editingPlayer, setEditingPlayer] = useState<PlayerStats | null>(null);
  const [editFormData, setEditFormData] = useState({
    matchesAttended: 0,
    trainingsAttended: 0
  });
  const [saving, setSaving] = useState(false);
  const [positionStats, setPositionStats] = useState<{
    position: string;
    count: number;
    percentage: number;
  }[]>([]);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      // STEP 1: Get all users from users collection
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const usersMap = new Map<string, any>();
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userData.email) {
          usersMap.set(userData.email, userData);
        }
      });

      // STEP 2: Get total events count from archive
      const archivedEventsRef = collection(db, 'events_archive');
      const archivedEventsSnapshot = await getDocs(archivedEventsRef);
      setTotalEvents(archivedEventsSnapshot.size);

      // STEP 3: Get stats from stats collection (manual edits have priority)
      const statsRef = collection(db, 'stats');
      const statsSnapshot = await getDocs(statsRef);
      
      const statsMap = new Map<string, any>();
      statsSnapshot.forEach((doc) => {
        const data = doc.data();
        statsMap.set(doc.id, data); // doc.id should be the user email
      });

      // STEP 4: Build stats array - use stats collection as source of truth
      const statsArray: PlayerStats[] = [];
      
      usersMap.forEach((userData, userEmail) => {
        // Check if we have stats data for this user
        const userStats = statsMap.get(userEmail);
        
        if (userStats) {
          // Use existing stats from stats collection
          statsArray.push({
            userId: userEmail,
            displayName: userData.alias || userEmail,
            matchesAttended: userStats.matchesAttended || 0,
            trainingsAttended: userStats.trainingsAttended || 0,
            totalAttended: userStats.totalAttended || 0,
            goals: userStats.goals || 0,
            assists: userStats.assists || 0,
            lastUpdated: userStats.lastUpdated?.toDate() || new Date()
          });
        } else {
          // No stats yet for this user, initialize with zeros
          statsArray.push({
            userId: userEmail,
            displayName: userData.alias || userEmail,
            matchesAttended: 0,
            trainingsAttended: 0,
            totalAttended: 0,
            goals: 0,
            assists: 0,
            lastUpdated: new Date()
          });
        }
      });

      // Sort by total attended (descending)
      statsArray.sort((a, b) => b.totalAttended - a.totalAttended);

      console.log(`✅ Loaded statistics for ${statsArray.length} users from stats collection`);
      setStats(statsArray);

      // STEP 5: Calculate position statistics
      const positionCounts: { [key: string]: number } = {
        'Arquera': 0,
        'Defensora': 0,
        'Mediocampista': 0,
        'Delantera': 0
      };

      let totalWithPosition = 0;

      usersMap.forEach((userData) => {
        if (userData.position && positionCounts.hasOwnProperty(userData.position)) {
          positionCounts[userData.position]++;
          totalWithPosition++;
        }
      });

      const positionStatsArray = Object.entries(positionCounts).map(([position, count]) => ({
        position,
        count,
        percentage: totalWithPosition > 0 ? (count / totalWithPosition) * 100 : 0
      }));

      setPositionStats(positionStatsArray);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlayer = (playerStat: PlayerStats) => {
    setEditingPlayer(playerStat);
    setEditFormData({
      matchesAttended: playerStat.matchesAttended,
      trainingsAttended: playerStat.trainingsAttended
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPlayer) return;

    setSaving(true);
    try {
      const statsRef = doc(db, 'stats', editingPlayer.userId);
      const totalAttended = editFormData.matchesAttended + editFormData.trainingsAttended;
      
      await setDoc(statsRef, {
        userId: editingPlayer.userId,
        displayName: editingPlayer.displayName,
        matchesAttended: editFormData.matchesAttended,
        trainingsAttended: editFormData.trainingsAttended,
        totalAttended,
        goals: editingPlayer.goals || 0,
        assists: editingPlayer.assists || 0,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      alert('✅ Estadísticas actualizadas correctamente');
      setEditingPlayer(null);
      await loadStatistics(); // Reload stats
    } catch (error) {
      console.error('Error updating stats:', error);
      alert('❌ Error al actualizar las estadísticas');
    } finally {
      setSaving(false);
    }
  };

  const handleIncrement = (field: 'matchesAttended' | 'trainingsAttended') => {
    setEditFormData(prev => ({
      ...prev,
      [field]: prev[field] + 1
    }));
  };

  const handleDecrement = (field: 'matchesAttended' | 'trainingsAttended') => {
    setEditFormData(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] - 1) // No permitir negativos
    }));
  };

  if (loading) {
    return <div className="loading">Cargando estadísticas...</div>;
  }

  return (
    <div className="statistics-container">
      <h1>Estadísticas de Asistencia</h1>

      {stats.length === 0 ? (
        <div className="no-data">
          <p>Aún no hay estadísticas registradas. Las estadísticas se calculan automáticamente a partir de los eventos archivados.</p>
        </div>
      ) : (
        <>
          {/* Position Statistics */}
          <div className="positions-section">
            <h2>Distribución de Posiciones</h2>
            <div className="positions-grid">
              {positionStats.map((stat) => (
                <div key={stat.position} className="position-card">
                  <div className="position-icon">
                    {stat.position === 'Arquera' && '🧤'}
                    {stat.position === 'Defensora' && '🛡️'}
                    {stat.position === 'Mediocampista' && '⚡'}
                    {stat.position === 'Delantera' && '⚽'}
                  </div>
                  <h3 className="position-name">{stat.position}</h3>
                  <div className="position-stats">
                    <div className="position-count">{stat.count} jugadora{stat.count !== 1 ? 's' : ''}</div>
                    <div className="position-percentage">{stat.percentage.toFixed(1)}%</div>
                  </div>
                  <div className="position-bar-container">
                    <div 
                      className="position-bar" 
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-summary">
            <div className="stat-card">
              <h3>Jugadoras Registradas</h3>
              <p className="stat-number">{stats.length}</p>
            </div>
            <div className="stat-card">
              <h3>Total Asistencias</h3>
              <p className="stat-number">{stats.reduce((sum, s) => sum + s.totalAttended, 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Total de Eventos</h3>
              <p className="stat-number">{totalEvents}</p>
            </div>
          </div>

          <div className="stats-table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Jugadora</th>
                  <th>Estadísticas</th>
                  <th>Total</th>
                  {user?.role === 'ADMIN' && <th>Acciones</th>}
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
                    <td className="stats-cell">
                      <div className="stat-row">
                        <span className="stat-icon">⚽</span>
                        <span className="stat-label">Partidos</span>
                        <span className="stat-number">{stat.matchesAttended}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-icon">🏃</span>
                        <span className="stat-label">Entrenamientos</span>
                        <span className="stat-number">{stat.trainingsAttended}</span>
                      </div>
                    </td>
                    <td className="stat-total">
                      <strong>{stat.totalAttended}</strong>
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="actions-cell">
                        <button
                          onClick={() => handleEditPlayer(stat)}
                          className="btn-icon-edit"
                          data-tooltip-id="edit-stats-tooltip"
                          data-tooltip-content="Editar estadísticas"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tooltip for edit button */}
      {user?.role === 'ADMIN' && (
        <Tooltip 
          id="edit-stats-tooltip" 
          place="left"
          className="stats-tooltip"
          style={{ zIndex: 'var(--z-tooltip)' }}
        />
      )}

      {/* Modal de edición para admins */}
      {editingPlayer && (
        <Modal 
          onClose={() => setEditingPlayer(null)} 
          title={`Editar Estadísticas - ${editingPlayer.displayName}`}
        >
          <div className="edit-stats-form">
            <p className="info-text">
              💡 Ajusta manualmente las estadísticas si hay discrepancias entre lo registrado y la realidad.
            </p>

            <div className="stat-edit-group">
              <label>⚽ Partidos Asistidos:</label>
              <div className="stat-input-group">
                <button 
                  onClick={() => handleDecrement('matchesAttended')}
                  className="btn-counter"
                  disabled={saving}
                >
                  -
                </button>
                <input
                  type="number"
                  value={editFormData.matchesAttended}
                  onChange={(e) => setEditFormData(prev => ({
                    ...prev,
                    matchesAttended: Math.max(0, parseInt(e.target.value) || 0)
                  }))}
                  min="0"
                  disabled={saving}
                />
                <button 
                  onClick={() => handleIncrement('matchesAttended')}
                  className="btn-counter"
                  disabled={saving}
                >
                  +
                </button>
              </div>
            </div>

            <div className="stat-edit-group">
              <label>🏃 Entrenamientos Asistidos:</label>
              <div className="stat-input-group">
                <button 
                  onClick={() => handleDecrement('trainingsAttended')}
                  className="btn-counter"
                  disabled={saving}
                >
                  -
                </button>
                <input
                  type="number"
                  value={editFormData.trainingsAttended}
                  onChange={(e) => setEditFormData(prev => ({
                    ...prev,
                    trainingsAttended: Math.max(0, parseInt(e.target.value) || 0)
                  }))}
                  min="0"
                  disabled={saving}
                />
                <button 
                  onClick={() => handleIncrement('trainingsAttended')}
                  className="btn-counter"
                  disabled={saving}
                >
                  +
                </button>
              </div>
            </div>

            <div className="total-preview">
              <strong>Total:</strong> {editFormData.matchesAttended + editFormData.trainingsAttended}
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setEditingPlayer(null)} 
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Statistics;

