import { useState, useEffect, useMemo, memo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { type PlayerStats } from '../types';
import '../styles/Statistics.css';

const Statistics = memo(() => {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGoalsOpen, setIsGoalsOpen] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      // Get all users from users collection
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const usersMap = new Map<string, any>();
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        // Map by document ID (not email) to match how stats are saved
        usersMap.set(userDoc.id, userData);
      });

      // Get stats from stats collection
      const statsRef = collection(db, 'stats');
      const statsSnapshot = await getDocs(statsRef);
      
      const statsMap = new Map<string, any>();
      statsSnapshot.forEach((doc) => {
        const data = doc.data();
        statsMap.set(doc.id, data);
      });

      // Build stats array - use email as the key (matching how stats are saved)
      const statsArray: PlayerStats[] = [];
      
      usersMap.forEach((userData, userId) => {
        // Skip ADMIN and VIEWER users from statistics (stats are only for players)
        if (userData.role === 'ADMIN' || userData.role === 'VIEWER') {
          return;
        }
        
        const userEmail = userData.email;
        const userStats = statsMap.get(userEmail); // Use email to lookup stats
        
        if (userStats) {
          statsArray.push({
            userId: userId,
            displayName: userData.alias || userData.email,
            position: userData.position,
            matchesAttended: userStats.matchesAttended || 0,
            trainingsAttended: userStats.trainingsAttended || 0,
            totalAttended: userStats.totalAttended || 0,
            goals: userStats.goals || 0,
            assists: userStats.assists || 0,
            yellowCards: userStats.yellowCards || 0,
            redCards: userStats.redCards || 0,
            figureOfTheMatch: userStats.figureOfTheMatch || 0,
            lastUpdated: userStats.lastUpdated?.toDate() || new Date()
          });
        } else {
          // No stats yet for this user, initialize with zeros
          statsArray.push({
            userId: userId,
            displayName: userData.alias || userData.email,
            position: userData.position,
            matchesAttended: 0,
            trainingsAttended: 0,
            totalAttended: 0,
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            figureOfTheMatch: 0,
            lastUpdated: new Date()
          });
        }
      });

      setStats(statsArray);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Memoize sorted stats to avoid recalculating on every render
  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      const totalA = (a.goals || 0) + (a.assists || 0) + (a.figureOfTheMatch || 0);
      const totalB = (b.goals || 0) + (b.assists || 0) + (b.figureOfTheMatch || 0);
      if (totalB !== totalA) return totalB - totalA;
      if ((b.goals || 0) !== (a.goals || 0)) return (b.goals || 0) - (a.goals || 0);
      if ((b.assists || 0) !== (a.assists || 0)) return (b.assists || 0) - (a.assists || 0);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [stats]);

  if (loading) {
    return <div className="loading">Cargando estadísticas...</div>;
  }

  return (
    <div className="statistics-container">
      <h1>Estadísticas</h1>

      {/* Goals and Assists Section */}
      <div className="goals-section">
            <div className="section-header" onClick={() => setIsGoalsOpen(!isGoalsOpen)}>
              <h2>⚽ Goles, Asistencias y Tarjetas</h2>
              <button className="chevron-button" aria-label="Toggle section">
                <svg 
                  className={`chevron-icon ${isGoalsOpen ? 'open' : ''}`}
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
            {isGoalsOpen && (
              <div className="goals-table-container">
                {/* Desktop Table */}
                <div className="goals-grid-wrapper">
                  {/* Header */}
                  <div className="goals-grid-header">
                    <div className="grid-cell header-player">Jugadora</div>
                    <div className="grid-cell header-goals">⚽ Goles</div>
                    <div className="grid-cell header-assists">🎯 Asistencias</div>
                    <div className="grid-cell header-figure">⭐ Figura</div>
                    <div className="grid-cell header-yellow-cards">🟨 Amarillas</div>
                    <div className="grid-cell header-red-cards">🟥 Rojas</div>
                  </div>
                  
                  {/* Body */}
                  <div className="goals-grid-body">
                    {sortedStats
                      .map((stat, index) => {
                        const positionEmoji = stat.position === 'Arquera' ? '🧤' :
                                            stat.position === 'Defensora' ? '🛡️' :
                                            stat.position === 'Mediocampista' ? '⚙️' :
                                            stat.position === 'Delantera' ? '⚡' : '⚽';
                        return (
                          <div 
                            key={stat.userId} 
                            className={`goals-grid-row ${index < 3 ? `top-${index + 1}` : ''}`}
                          >
                            <div className="grid-cell cell-player">
                              <div className="player-info">
                                <span className="player-name">{stat.displayName}</span>
                                {stat.position && (
                                  <span className="player-position">{positionEmoji} {stat.position}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid-cell cell-goals">
                              <span className="stat-value-large">{stat.goals || 0}</span>
                            </div>
                            
                            <div className="grid-cell cell-assists">
                              <span className="stat-value-large">{stat.assists || 0}</span>
                            </div>
                            
                            <div className="grid-cell cell-figure">
                              <span className="stat-value-large">{stat.figureOfTheMatch || 0}</span>
                            </div>
                            
                            <div className="grid-cell cell-yellow-cards">
                              <span className="stat-value-large">{stat.yellowCards || 0}</span>
                            </div>
                            
                            <div className="grid-cell cell-red-cards">
                              <span className="stat-value-large">{stat.redCards || 0}</span>
                            </div>
                          </div>
                        );
                      })}
                    {stats.length === 0 && (
                      <div className="no-data-goals">
                        <p>No hay jugadoras registradas en el sistema.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Compact Table */}
                <div className="mobile-table-wrapper">
                  <div className="mobile-table-scroll-hint">
                    👉 Desliza horizontalmente para ver todas las columnas
                  </div>
                  <table className="mobile-compact-table">
                    <thead>
                      <tr>
                        <th>Jugadora</th>
                        <th title="Goles">⚽<br/>Goles</th>
                        <th title="Asistencias">🎯<br/>Asis.</th>
                        <th title="Figura del Partido">⭐<br/>Fig.</th>
                        <th title="Tarjetas Amarillas">🟨<br/>Am.</th>
                        <th title="Tarjetas Rojas">🟥<br/>Rojas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStats.map((stat, index) => {
                        const positionEmoji = stat.position === 'Arquera' ? '🧤' :
                                            stat.position === 'Defensora' ? '🛡️' :
                                            stat.position === 'Mediocampista' ? '⚙️' :
                                            stat.position === 'Delantera' ? '⚡' : '⚽';
                        return (
                          <tr 
                            key={stat.userId} 
                            className={index < 3 ? `top-${index + 1}` : ''}
                          >
                            <td>
                              <div className="mobile-player-cell">
                                <span className="mobile-player-name-compact">{stat.displayName}</span>
                                {stat.position && (
                                  <span className="mobile-player-position-compact">
                                    {positionEmoji} {stat.position}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="mobile-stat-value-compact">{stat.goals || 0}</span>
                            </td>
                            <td>
                              <span className="mobile-stat-value-compact">{stat.assists || 0}</span>
                            </td>
                            <td>
                              <span className="mobile-stat-value-compact">{stat.figureOfTheMatch || 0}</span>
                            </td>
                            <td>
                              <span className="mobile-stat-value-compact">{stat.yellowCards || 0}</span>
                            </td>
                            <td>
                              <span className="mobile-stat-value-compact">{stat.redCards || 0}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {stats.length === 0 && (
                    <div className="no-data-goals">
                      <p>No hay jugadoras registradas en el sistema.</p>
                    </div>
                  )}
                </div>

                {/* Mobile Card Layout - Removed (keeping for potential future use) */}
                <div className="mobile-stats-cards" style={{ display: 'none' }}>
                  {sortedStats.map((stat, index) => {
                      const positionEmoji = stat.position === 'Arquera' ? '🧤' :
                                          stat.position === 'Defensora' ? '🛡️' :
                                          stat.position === 'Mediocampista' ? '⚙️' :
                                          stat.position === 'Delantera' ? '⚡' : '⚽';
                      
                      const rankBadge = index === 0 ? '🥇' :
                                       index === 1 ? '🥈' :
                                       index === 2 ? '🥉' : '';
                      
                      return (
                        <div 
                          key={stat.userId} 
                          className={`mobile-stat-card ${index < 3 ? `top-${index + 1}` : ''}`}
                        >
                          <div className="mobile-stat-header">
                            <div className="mobile-player-info">
                              <div className="mobile-player-name">{stat.displayName}</div>
                              {stat.position && (
                                <div className="mobile-player-position">
                                  {positionEmoji} {stat.position}
                                </div>
                              )}
                            </div>
                            {rankBadge && (
                              <div className="mobile-rank-badge">{rankBadge}</div>
                            )}
                          </div>
                          
                          <div className="mobile-stats-grid">
                            <div className="mobile-stat-item">
                              <div className="mobile-stat-label">⚽ Goles</div>
                              <div className="mobile-stat-value">{stat.goals || 0}</div>
                            </div>
                            
                            <div className="mobile-stat-item">
                              <div className="mobile-stat-label">🎯 Asistencias</div>
                              <div className="mobile-stat-value">{stat.assists || 0}</div>
                            </div>
                            
                            <div className="mobile-stat-item">
                              <div className="mobile-stat-label">⭐ Figura</div>
                              <div className="mobile-stat-value">{stat.figureOfTheMatch || 0}</div>
                            </div>
                            
                            <div className="mobile-stat-item">
                              <div className="mobile-stat-label">🟨 Amarillas</div>
                              <div className="mobile-stat-value">{stat.yellowCards || 0}</div>
                            </div>
                            
                            <div className="mobile-stat-item">
                              <div className="mobile-stat-label">🟥 Rojas</div>
                              <div className="mobile-stat-value">{stat.redCards || 0}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {stats.length === 0 && (
                    <div className="no-data-goals">
                      <p>No hay jugadoras registradas en el sistema.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
    </div>
  );
});

Statistics.displayName = 'Statistics';

export default Statistics;

