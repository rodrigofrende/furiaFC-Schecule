import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp, doc, setDoc, getDoc, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type MatchResult, type Goal, type User, type Rival } from '../types';
import Modal from '../components/Modal';
import '../styles/MatchHistory.css';

interface ArchivedMatch {
  id: string;
  title: string;
  rivalId?: string;
  rivalName: string;
  date: Date;
  location?: string;
  attendance: number;
  result?: MatchResult;
}

const MatchHistory = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<ArchivedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMatch, setEditingMatch] = useState<ArchivedMatch | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  
  // Filter state
  const [filterRivalId, setFilterRivalId] = useState<string>('');
  const [filterResult, setFilterResult] = useState<'all' | 'win' | 'lose' | 'draw'>('all');
  
  // Result editor state
  const [rivalId, setRivalId] = useState('');
  const [rivalName, setRivalName] = useState('');
  const [furiaGoals, setFuriaGoals] = useState(0);
  const [rivalGoals, setRivalGoals] = useState(0);
  const [goals, setGoals] = useState<Array<{
    playerId: string;
    playerName: string;
    assistPlayerId?: string;
    assistPlayerName?: string;
  }>>([]);
  const [figureOfTheMatchId, setFigureOfTheMatchId] = useState<string>('');
  const [players, setPlayers] = useState<User[]>([]);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingNewRival, setCreatingNewRival] = useState(false);
  const [editingRival, setEditingRival] = useState(false);
  const [newRivalName, setNewRivalName] = useState('');

  useEffect(() => {
    loadMatches();
    loadPlayers();
    loadRivals();
  }, []);

  const loadPlayers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('role', '==', 'PLAYER'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const playersData: User[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        playersData.push({
          id: doc.id,
          email: data.email,
          displayName: data.alias || data.email,
          role: data.role,
          birthday: data.birthday,
          position: data.position
        });
      });
      
      setPlayers(playersData.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

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

  const handleCreateNewRival = async () => {
    if (!newRivalName.trim()) {
      alert('⚠️ Por favor ingresa el nombre del rival');
      return;
    }

    setSaving(true);
    try {
      // Create a new rival in Firestore
      const rivalsRef = collection(db, 'rivals');
      const newRivalRef = doc(rivalsRef);
      
      await setDoc(newRivalRef, {
        name: newRivalName.trim(),
        logoUrl: '',
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'unknown'
      });

      // Reload rivals and select the newly created one
      await loadRivals();
      setRivalId(newRivalRef.id);
      setRivalName(newRivalName.trim());
      setNewRivalName('');
      setCreatingNewRival(false);
      
      alert('✅ Rival creado exitosamente');
    } catch (error: any) {
      console.error('Error creating rival:', error);
      let errorMessage = '❌ Error al crear el rival';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleEditRival = async () => {
    if (!newRivalName.trim()) {
      alert('⚠️ Por favor ingresa el nombre del rival');
      return;
    }

    if (!rivalId) {
      alert('⚠️ No hay rival seleccionado');
      return;
    }

    setSaving(true);
    try {
      // Update the rival in Firestore
      const rivalRef = doc(db, 'rivals', rivalId);
      await updateDoc(rivalRef, {
        name: newRivalName.trim()
      });

      // Reload rivals and keep the same one selected
      await loadRivals();
      setRivalName(newRivalName.trim());
      setNewRivalName('');
      setEditingRival(false);
      
      alert('✅ Rival actualizado exitosamente');
    } catch (error: any) {
      console.error('Error updating rival:', error);
      let errorMessage = '❌ Error al actualizar el rival';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const loadMatches = async () => {
    try {
      // Get archived events of type MATCH
      const eventsRef = collection(db, 'events_archive');
      const eventsQuery = query(
        eventsRef, 
        where('type', '==', 'MATCH')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      
      const matchesData: ArchivedMatch[] = [];
      
      for (const eventDoc of eventsSnapshot.docs) {
        const data = eventDoc.data();
        const eventDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
        
        // Count attendance
        const attendancesRef = collection(db, 'attendances_archive');
        const attendanceQuery = query(
          attendancesRef, 
          where('eventId', '==', eventDoc.id),
          where('attending', '==', true)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        // Check if there's a result for this match
        const resultRef = doc(db, 'match_results', eventDoc.id);
        const resultDoc = await getDoc(resultRef);
        
        let result: MatchResult | undefined;
        if (resultDoc.exists()) {
          const resultData = resultDoc.data();
          result = {
            id: resultDoc.id,
            eventId: eventDoc.id,
            rivalName: resultData.rivalName,
            furiaGoals: resultData.furiaGoals,
            rivalGoals: resultData.rivalGoals,
            goals: resultData.goals.map((g: any) => ({
              ...g,
              createdAt: g.createdAt instanceof Timestamp ? g.createdAt.toDate() : new Date(g.createdAt)
            })),
            figureOfTheMatchId: resultData.figureOfTheMatchId || undefined,
            figureOfTheMatchName: resultData.figureOfTheMatchName || undefined,
            date: resultData.date instanceof Timestamp ? resultData.date.toDate() : new Date(resultData.date),
            location: resultData.location,
            createdAt: resultData.createdAt instanceof Timestamp ? resultData.createdAt.toDate() : new Date(resultData.createdAt),
            updatedAt: resultData.updatedAt instanceof Timestamp ? resultData.updatedAt.toDate() : new Date(resultData.updatedAt)
          };
        }
        
        matchesData.push({
          id: eventDoc.id,
          title: data.title,
          rivalId: data.rivalId,
          rivalName: data.rivalName || 'Rival no especificado',
          date: eventDate,
          location: data.location,
          attendance: attendanceSnapshot.size,
          result
        });
      }
      
      // Sort by date descending (most recent first) on the client side
      matchesData.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setMatches(matchesData);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditResult = (match: ArchivedMatch) => {
    setEditingMatch(match);
    
    if (match.result) {
      setRivalId(match.rivalId || '');
      setRivalName(match.result.rivalName);
      setFuriaGoals(match.result.furiaGoals);
      setRivalGoals(match.result.rivalGoals);
      setFigureOfTheMatchId(match.result.figureOfTheMatchId || '');
      setGoals(match.result.goals.map(g => ({
        playerId: g.playerId,
        playerName: g.playerName,
        assistPlayerId: g.assistPlayerId,
        assistPlayerName: g.assistPlayerName
      })));
    } else {
      // Use rivalId and rivalName from match
      setRivalId(match.rivalId || '');
      setRivalName(match.rivalName);
      setFuriaGoals(0);
      setRivalGoals(0);
      setFigureOfTheMatchId('');
      setGoals([]);
    }
    
    setShowResultModal(true);
  };

  const handleAddGoal = () => {
    if (players.length === 0) return;
    
    setGoals([...goals, {
      playerId: players[0].id,
      playerName: players[0].displayName
    }]);
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index: number, field: 'playerId' | 'assistPlayerId', value: string) => {
    const newGoals = [...goals];
    if (field === 'playerId') {
      const player = players.find(p => p.id === value);
      if (player) {
        newGoals[index].playerId = player.id;
        newGoals[index].playerName = player.displayName;
        // Reset assist if it's the same player
        if (newGoals[index].assistPlayerId === player.id) {
          delete newGoals[index].assistPlayerId;
          delete newGoals[index].assistPlayerName;
        }
      }
    } else if (field === 'assistPlayerId') {
      if (value === '') {
        // Clear assist
        delete newGoals[index].assistPlayerId;
        delete newGoals[index].assistPlayerName;
      } else {
        const player = players.find(p => p.id === value);
        if (player) {
          newGoals[index].assistPlayerId = player.id;
          newGoals[index].assistPlayerName = player.displayName;
        }
      }
    }
    setGoals(newGoals);
  };

  const handleSaveResult = async () => {
    if (!editingMatch || !rivalId) {
      alert('⚠️ Por favor selecciona un rival');
      return;
    }
    
    // Get rival name from selected rival
    const selectedRival = rivals.find(r => r.id === rivalId);
    if (!selectedRival) {
      alert('⚠️ Rival no encontrado');
      return;
    }

    // Validate that the number of goals matches the Furia goals count
    if (goals.length !== furiaGoals) {
      alert(`⚠️ Debes agregar exactamente ${furiaGoals} gol(es) para FURIA`);
      return;
    }

    setSaving(true);
    try {
      const resultRef = doc(db, 'match_results', editingMatch.id);
      
      const goalsWithIds: Goal[] = goals.map((g, index) => {
        const goal: Goal = {
          id: `goal_${editingMatch.id}_${index}`,
          playerId: g.playerId,
          playerName: g.playerName,
          createdAt: new Date()
        };
        
        // Only add assist fields if they exist
        if (g.assistPlayerId && g.assistPlayerName) {
          goal.assistPlayerId = g.assistPlayerId;
          goal.assistPlayerName = g.assistPlayerName;
        }
        
        return goal;
      });

      // Prepare result data
      const resultData: any = {
        eventId: editingMatch.id,
        rivalId: rivalId,
        rivalName: selectedRival.name,
        furiaGoals,
        rivalGoals,
        goals: goalsWithIds,
        date: editingMatch.date,
        location: editingMatch.location,
        figureOfTheMatchId: figureOfTheMatchId || null,
        figureOfTheMatchName: figureOfTheMatchId ? players.find(p => p.id === figureOfTheMatchId)?.displayName || '' : null,
        updatedAt: serverTimestamp()
      };

      const existingDoc = await getDoc(resultRef);
      if (existingDoc.exists()) {
        await updateDoc(resultRef, resultData);
      } else {
        await setDoc(resultRef, {
          ...resultData,
          createdAt: serverTimestamp()
        });
      }

      // IMPORTANT: Also update the archived event with rivalId and rivalName
      // This ensures the match card displays the correct rival
      const eventArchiveRef = doc(db, 'events_archive', editingMatch.id);
      await updateDoc(eventArchiveRef, {
        rivalId: rivalId,
        rivalName: selectedRival.name
      });

      // Update goal and assist stats - Calculate difference between new and old goals
      if (editingMatch.result) {
        // When editing, we need to calculate the difference
        const oldGoals = editingMatch.result.goals;
        
        // Count how many goals each player had before
        const oldGoalCounts = new Map<string, number>();
        const oldAssistCounts = new Map<string, number>();
        
        oldGoals.forEach(g => {
          oldGoalCounts.set(g.playerId, (oldGoalCounts.get(g.playerId) || 0) + 1);
          if (g.assistPlayerId) {
            oldAssistCounts.set(g.assistPlayerId, (oldAssistCounts.get(g.assistPlayerId) || 0) + 1);
          }
        });
        
        // Count how many goals each player has now
        const newGoalCounts = new Map<string, number>();
        const newAssistCounts = new Map<string, number>();
        
        goalsWithIds.forEach(g => {
          newGoalCounts.set(g.playerId, (newGoalCounts.get(g.playerId) || 0) + 1);
          if (g.assistPlayerId) {
            newAssistCounts.set(g.assistPlayerId, (newAssistCounts.get(g.assistPlayerId) || 0) + 1);
          }
        });
        
        // Update stats based on differences
        const allPlayerIds = new Set([...oldGoalCounts.keys(), ...newGoalCounts.keys()]);
        for (const playerId of allPlayerIds) {
          const oldCount = oldGoalCounts.get(playerId) || 0;
          const newCount = newGoalCounts.get(playerId) || 0;
          const diff = newCount - oldCount;
          
          if (diff !== 0) {
            const statsRef = doc(db, 'stats', playerId);
            const statsDoc = await getDoc(statsRef);
            
            if (statsDoc.exists()) {
              const currentGoals = statsDoc.data().goals || 0;
              await updateDoc(statsRef, {
                goals: Math.max(0, currentGoals + diff),
                lastUpdated: serverTimestamp()
              });
            }
          }
        }
        
        // Update assist stats
        const allAssistPlayerIds = new Set([...oldAssistCounts.keys(), ...newAssistCounts.keys()]);
        for (const playerId of allAssistPlayerIds) {
          const oldCount = oldAssistCounts.get(playerId) || 0;
          const newCount = newAssistCounts.get(playerId) || 0;
          const diff = newCount - oldCount;
          
          if (diff !== 0) {
            const statsRef = doc(db, 'stats', playerId);
            const statsDoc = await getDoc(statsRef);
            
            if (statsDoc.exists()) {
              const currentAssists = statsDoc.data().assists || 0;
              await updateDoc(statsRef, {
                assists: Math.max(0, currentAssists + diff),
                lastUpdated: serverTimestamp()
              });
            }
          }
        }
      } else {
        // Creating new result - just add all goals and assists
        for (const goal of goalsWithIds) {
          const statsRef = doc(db, 'stats', goal.playerId);
          const statsDoc = await getDoc(statsRef);
          
          if (statsDoc.exists()) {
            const currentGoals = statsDoc.data().goals || 0;
            await updateDoc(statsRef, {
              goals: currentGoals + 1,
              lastUpdated: serverTimestamp()
            });
          }
          
          // Update assist stats if there's an assist
          if (goal.assistPlayerId) {
            const assistStatsRef = doc(db, 'stats', goal.assistPlayerId);
            const assistStatsDoc = await getDoc(assistStatsRef);
            
            if (assistStatsDoc.exists()) {
              const currentAssists = assistStatsDoc.data().assists || 0;
              await updateDoc(assistStatsRef, {
                assists: currentAssists + 1,
                lastUpdated: serverTimestamp()
              });
            }
          }
        }
      }

      // Update figure of the match stats
      if (figureOfTheMatchId) {
        const statsRef = doc(db, 'stats', figureOfTheMatchId);
        const statsDoc = await getDoc(statsRef);
        
        if (statsDoc.exists()) {
          const currentFigures = statsDoc.data().figureOfTheMatch || 0;
          // Check if this is a new figure or a change
          const isNewFigure = !editingMatch.result || 
            editingMatch.result.figureOfTheMatchId !== figureOfTheMatchId;
          
          if (isNewFigure) {
            // If there was a previous figure, decrement their count
            if (editingMatch.result?.figureOfTheMatchId && 
                editingMatch.result.figureOfTheMatchId !== figureOfTheMatchId) {
              const oldFigureRef = doc(db, 'stats', editingMatch.result.figureOfTheMatchId);
              const oldFigureDoc = await getDoc(oldFigureRef);
              if (oldFigureDoc.exists()) {
                const oldFigureCount = oldFigureDoc.data().figureOfTheMatch || 0;
                await updateDoc(oldFigureRef, {
                  figureOfTheMatch: Math.max(0, oldFigureCount - 1),
                  lastUpdated: serverTimestamp()
                });
              }
            }
            
            // Increment new figure count
            await updateDoc(statsRef, {
              figureOfTheMatch: currentFigures + 1,
              lastUpdated: serverTimestamp()
            });
          }
        }
      }

      alert('✅ Resultado guardado correctamente');
      setShowResultModal(false);
      setEditingMatch(null);
      await loadMatches();
    } catch (error: any) {
      console.error('Error saving result:', error);
      
      // Mostrar error específico
      let errorMessage = '❌ Error al guardar el resultado';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.code === 'not-found') {
        errorMessage += '\n📄 Documento no encontrado.';
      } else if (error.code === 'unavailable') {
        errorMessage += '\n🌐 No se puede conectar a Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      
      alert(errorMessage);
      
      // Re-throw para que se pueda debuggear
      console.error('Full error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Filter matches based on selected filters
  const filteredMatches = matches.filter((match) => {
    // Filter by rival
    if (filterRivalId && match.rivalId !== filterRivalId) {
      return false;
    }
    
    // Filter by result (only if match has result)
    if (filterResult !== 'all' && match.result) {
      const furiaGoals = match.result.furiaGoals;
      const rivalGoals = match.result.rivalGoals;
      
      if (filterResult === 'win' && furiaGoals <= rivalGoals) return false;
      if (filterResult === 'lose' && furiaGoals >= rivalGoals) return false;
      if (filterResult === 'draw' && furiaGoals !== rivalGoals) return false;
    }
    
    // If filtering by result but match has no result, exclude it
    if (filterResult !== 'all' && !match.result) {
      return false;
    }
    
    return true;
  });

  if (loading) {
    return <div className="loading-history">Cargando historial de partidos...</div>;
  }

  return (
    <div className="match-history-container">
      <h1>🏆 Historial de Partidos</h1>
      
      {/* Filters Section */}
      <div className="match-filters">
        <div className="filter-group">
          <label htmlFor="filter-rival">Filtrar por Rival:</label>
          <select
            id="filter-rival"
            value={filterRivalId}
            onChange={(e) => setFilterRivalId(e.target.value)}
            className="filter-select"
          >
            <option value="">Todos los rivales</option>
            {rivals.map((rival) => (
              <option key={rival.id} value={rival.id}>
                {rival.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-result">Filtrar por Resultado:</label>
          <select
            id="filter-result"
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as 'all' | 'win' | 'lose' | 'draw')}
            className="filter-select"
          >
            <option value="all">Todos los resultados</option>
            <option value="win">✅ Victorias</option>
            <option value="draw">🟰 Empates</option>
            <option value="lose">❌ Derrotas</option>
          </select>
        </div>

        {(filterRivalId || filterResult !== 'all') && (
          <button
            onClick={() => {
              setFilterRivalId('');
              setFilterResult('all');
            }}
            className="btn-clear-filters"
          >
            🔄 Limpiar Filtros
          </button>
        )}
      </div>

      {/* Results Summary */}
      {(filterRivalId || filterResult !== 'all') && (
        <div className="filter-summary">
          Mostrando {filteredMatches.length} de {matches.length} partidos
        </div>
      )}
      
      {matches.length === 0 ? (
        <p className="no-matches">No hay partidos en el historial aún</p>
      ) : filteredMatches.length === 0 ? (
        <p className="no-matches">No se encontraron partidos con los filtros seleccionados</p>
      ) : (
        <div className="match-history-list">
          {filteredMatches.map((match) => {
            const hasResult = !!match.result;
            const furiaWon = hasResult && match.result!.furiaGoals > match.result!.rivalGoals;
            const rivalWon = hasResult && match.result!.furiaGoals < match.result!.rivalGoals;

            return (
              <div key={match.id} className="match-card">
                <div className="match-card-header">
                  <span className="match-date">{formatDate(match.date)}</span>
                  {match.location && (
                    <span className="match-location">📍 {match.location}</span>
                  )}
                </div>

                <div className="match-score-section">
                  <div className="team-section furia">
                    <div className="team-name">FURIA</div>
                    <div className={`score-box ${furiaWon ? 'winner' : ''}`}>
                      {hasResult ? match.result!.furiaGoals : '-'}
                    </div>
                  </div>

                  <div className="score-vs">VS</div>

                  <div className="team-section rival">
                    <div className="team-name">
                      {hasResult ? match.result!.rivalName : match.rivalName}
                    </div>
                    <div className={`score-box ${rivalWon ? 'winner' : ''}`}>
                      {hasResult ? match.result!.rivalGoals : '-'}
                    </div>
                  </div>
                </div>

                {!hasResult && (
                  <div className="match-no-result">
                    Resultado no ingresado
                  </div>
                )}

                {hasResult && (
                  <div className="match-details">
                    <div className="details-grid">
                      {/* Figure of the Match - Compact Badge */}
                      {match.result!.figureOfTheMatchName && (
                        <div className="match-figure-compact">
                          <span className="figure-icon">⭐</span>
                          <div className="figure-content">
                            <span className="figure-label">Figura</span>
                            <span className="figure-name">{match.result!.figureOfTheMatchName}</span>
                          </div>
                        </div>
                      )}

                      {/* Goals Section - Compact Grid */}
                      {match.result!.goals.length > 0 ? (
                        <div className="match-goals-compact">
                          <div className="goals-header-compact">
                            <span className="goals-icon">⚽</span>
                            <span className="goals-title-compact">Goles ({match.result!.goals.length})</span>
                          </div>
                          <div className="goals-grid">
                            {match.result!.goals.map((goal, index) => (
                              <div key={goal.id} className="goal-item-compact">
                                <span className="goal-badge">{index + 1}</span>
                                <div className="goal-detail">
                                  <span className="goal-player-name">{goal.playerName}</span>
                                  {goal.assistPlayerName && (
                                    <span className="goal-assist-compact">
                                      <span className="assist-label">Asistencia:</span>
                                      <span className="assist-name">{goal.assistPlayerName}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : match.result!.furiaGoals === 0 ? (
                        <div className="no-goals-compact">
                          <span className="no-goals-icon">⚪</span>
                          <span className="no-goals-text">Sin goles</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {user?.role === 'ADMIN' && (
                  <div className="match-admin-actions">
                    <button 
                      onClick={() => handleEditResult(match)}
                      className="btn-edit-result"
                    >
                      {hasResult ? '✏️ Editar Resultado' : '➕ Ingresar Resultado'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showResultModal && editingMatch && (
        <Modal
          onClose={() => {
            setShowResultModal(false);
            setEditingMatch(null);
          }}
          title={`Resultado: ${editingMatch.title}`}
        >
          <div className="result-editor">
            <div className="result-editor-section">
              <div className="result-rival-input">
                <label>Rival:</label>
                {!creatingNewRival && !editingRival ? (
                  <div className="rival-input-wrapper">
                    <select
                      value={rivalId}
                      onChange={(e) => {
                        const selectedRival = rivals.find(r => r.id === e.target.value);
                        setRivalId(e.target.value);
                        setRivalName(selectedRival?.name || '');
                      }}
                      disabled={saving}
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
                      onClick={() => {
                        if (rivalId) {
                          setNewRivalName(rivalName);
                          setEditingRival(true);
                        }
                      }}
                      className="btn-icon-rival"
                      disabled={saving || !rivalId}
                      title="Editar rival"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatingNewRival(true)}
                      className="btn-icon-rival"
                      disabled={saving}
                      title="Agregar nuevo rival"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="new-rival-form">
                    <input
                      type="text"
                      placeholder="Nombre del rival"
                      value={newRivalName}
                      onChange={(e) => setNewRivalName(e.target.value)}
                      disabled={saving}
                      className="new-rival-input"
                      autoFocus
                    />
                    <div className="new-rival-actions">
                      <button
                        type="button"
                        onClick={editingRival ? handleEditRival : handleCreateNewRival}
                        className="btn-save-rival"
                        disabled={saving || !newRivalName.trim()}
                      >
                        ✓ Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingNewRival(false);
                          setEditingRival(false);
                          setNewRivalName('');
                        }}
                        className="btn-cancel-rival"
                        disabled={saving}
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="result-editor-section">
              <h3>Resultado Final</h3>
              <div className="result-scores">
                <div className="result-score-input furia">
                  <label>FURIA</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={furiaGoals}
                    onChange={(e) => setFuriaGoals(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={saving}
                  />
                </div>

                <div className="score-vs">VS</div>

                <div className="result-score-input">
                  <label>{rivalName || 'RIVAL'}</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={rivalGoals}
                    onChange={(e) => setRivalGoals(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="result-editor-section">
              <h3>⭐ Figura del Partido (Opcional)</h3>
              <div className="figure-selector">
                <select
                  value={figureOfTheMatchId}
                  onChange={(e) => setFigureOfTheMatchId(e.target.value)}
                  disabled={saving}
                  className="figure-select"
                >
                  <option value="">Seleccionar figura del partido</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.displayName}
                    </option>
                  ))}
                </select>
                <p className="figure-info">💡 La figura del partido suma 1 punto en estadísticas</p>
              </div>
            </div>

            <div className="result-editor-section">
              <h3>⚽ Goles de FURIA ({goals.length}/{furiaGoals})</h3>
              <div className="goals-editor" style={{ minHeight: furiaGoals > 0 ? `${furiaGoals * 80}px` : '60px' }}>
                {furiaGoals > 0 ? (
                  <>
                    {goals.map((goal, index) => (
                      <div key={index} className="goal-editor-item">
                        <div className="goal-editor-field">
                          <label>Jugadora (Gol)</label>
                          <select
                            value={goal.playerId}
                            onChange={(e) => handleGoalChange(index, 'playerId', e.target.value)}
                            disabled={saving}
                          >
                            {players.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.displayName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="goal-editor-field">
                          <label>Asistencia (Opcional)</label>
                          <select
                            value={goal.assistPlayerId || ''}
                            onChange={(e) => handleGoalChange(index, 'assistPlayerId', e.target.value)}
                            disabled={saving}
                          >
                            <option value="">Sin asistencia</option>
                            {players
                              .filter(player => player.id !== goal.playerId)
                              .map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.displayName}
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          onClick={() => handleRemoveGoal(index)}
                          className="btn-remove-goal"
                          disabled={saving}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={handleAddGoal}
                      className="btn-add-goal"
                      disabled={saving || goals.length >= furiaGoals}
                    >
                      ➕ Agregar Gol
                    </button>
                  </>
                ) : (
                  <div className="no-goals-message">
                    Sin goles para registrar
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  setEditingMatch(null);
                }}
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveResult}
                className="btn-primary"
                disabled={saving || !rivalName.trim() || goals.length !== furiaGoals}
              >
                {saving ? 'Guardando...' : 'Guardar Resultado'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MatchHistory;

