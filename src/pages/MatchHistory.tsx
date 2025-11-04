import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { collection, getDocs, query, where, Timestamp, doc, setDoc, getDoc, serverTimestamp, updateDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { type MatchResult, type Goal, type Card, type CardType, type User, type Rival } from '../types';
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
  isFriendly?: boolean; // Para partidos sin resultado, se toma del evento archivado
}

const MatchHistory = memo(() => {
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
  const [cards, setCards] = useState<Array<{
    playerId: string;
    playerName: string;
    cardType: CardType;
  }>>([]);
  const [figureOfTheMatchId, setFigureOfTheMatchId] = useState<string>('');
  const [isFriendly, setIsFriendly] = useState<boolean>(false);
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

  const loadPlayers = useCallback(async () => {
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
  }, []);

  const loadRivals = useCallback(async () => {
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
  }, []);

  const handleCreateNewRival = useCallback(async () => {
    if (!newRivalName.trim()) {
      alert('⚠️ Por favor ingresa el nombre del rival');
      return;
    }

    // Validar que no exista un rival con el mismo nombre (case-insensitive)
    const normalizedName = newRivalName.trim().toLowerCase();
    const duplicateRival = rivals.find(r => r.name.toLowerCase() === normalizedName);

    if (duplicateRival) {
      alert('⚠️ Ya existe un rival con ese nombre. Por favor usá otro nombre.');
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
  }, [user?.email, rivals, rivalId, rivalName, newRivalName, loadRivals]);

  const handleEditRival = useCallback(async () => {
    if (!newRivalName.trim()) {
      alert('⚠️ Por favor ingresa el nombre del rival');
      return;
    }

    if (!rivalId) {
      alert('⚠️ No hay rival seleccionado');
      return;
    }

    // Validar que no exista un rival con el mismo nombre (case-insensitive)
    const normalizedName = newRivalName.trim().toLowerCase();
    const duplicateRival = rivals.find(r => {
      // Excluir el rival actual de la búsqueda
      if (r.id === rivalId) {
        return false;
      }
      return r.name.toLowerCase() === normalizedName;
    });

    if (duplicateRival) {
      alert('⚠️ Ya existe un rival con ese nombre. Por favor usá otro nombre.');
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
  }, [rivalId, rivals, newRivalName, rivalName, loadRivals]);

  const loadMatches = useCallback(async () => {
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
            cards: resultData.cards ? resultData.cards.map((c: any) => ({
              ...c,
              createdAt: c.createdAt instanceof Timestamp ? c.createdAt.toDate() : new Date(c.createdAt)
            })) : [],
            figureOfTheMatchId: resultData.figureOfTheMatchId || undefined,
            figureOfTheMatchName: resultData.figureOfTheMatchName || undefined,
            date: resultData.date instanceof Timestamp ? resultData.date.toDate() : new Date(resultData.date),
            location: resultData.location,
            isFriendly: resultData.isFriendly || false,
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
          result,
          isFriendly: result?.isFriendly ?? (data.isFriendly || false) // Si hay resultado, usar el del resultado; si no, usar el del evento archivado
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
  }, []);

  const handleEditResult = useCallback(async (match: ArchivedMatch) => {
    setEditingMatch(match);
    
    if (match.result) {
      setRivalId(match.rivalId || '');
      setRivalName(match.result.rivalName);
      setFuriaGoals(match.result.furiaGoals);
      setRivalGoals(match.result.rivalGoals);
      setFigureOfTheMatchId(match.result.figureOfTheMatchId || '');
      setIsFriendly(match.result.isFriendly || false);
      setGoals(match.result.goals.map(g => ({
        playerId: g.playerId,
        playerName: g.playerName,
        assistPlayerId: g.assistPlayerId,
        assistPlayerName: g.assistPlayerName
      })));
      setCards(match.result.cards ? match.result.cards.map(c => ({
        playerId: c.playerId,
        playerName: c.playerName,
        cardType: c.cardType
      })) : []);
    } else {
      // Use rivalId and rivalName from match
      setRivalId(match.rivalId || '');
      setRivalName(match.rivalName);
      setFuriaGoals(0);
      setRivalGoals(0);
      setFigureOfTheMatchId('');
      // Check if the archived event has isFriendly set
      const eventArchiveRef = doc(db, 'events_archive', match.id);
      const eventArchiveDoc = await getDoc(eventArchiveRef);
      const eventIsFriendly = eventArchiveDoc.exists() ? (eventArchiveDoc.data().isFriendly || false) : false;
      setIsFriendly(eventIsFriendly);
      setGoals([]);
      setCards([]);
    }
    
    setShowResultModal(true);
  }, [players]);

  const handleAddGoal = useCallback(() => {
    if (players.length === 0) return;
    
    setGoals([...goals, {
      playerId: players[0].id,
      playerName: players[0].displayName
    }]);
  }, [players, goals]);

  const handleRemoveGoal = useCallback((index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  }, [goals]);

  const handleGoalChange = useCallback((index: number, field: 'playerId' | 'assistPlayerId', value: string) => {
    const newGoals = [...goals];
    if (field === 'playerId') {
      // Check if it's an invited player (guest)
      if (value === 'INVITADO') {
        newGoals[index].playerId = 'INVITADO';
        newGoals[index].playerName = 'Invitado';
        // Reset assist if it exists
        delete newGoals[index].assistPlayerId;
        delete newGoals[index].assistPlayerName;
      } else {
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
  }, [players, goals]);

  const handleAddCard = useCallback((cardType: CardType) => {
    if (players.length === 0) return;
    
    setCards([...cards, {
      playerId: players[0].id,
      playerName: players[0].displayName,
      cardType
    }]);
  }, [players, cards]);

  const handleRemoveCard = useCallback((index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  }, [cards]);

  const handleCardChange = useCallback((index: number, field: 'playerId' | 'cardType', value: string) => {
    const newCards = [...cards];
    if (field === 'playerId') {
      const player = players.find(p => p.id === value);
      if (player) {
        newCards[index].playerId = player.id;
        newCards[index].playerName = player.displayName;
      }
    } else if (field === 'cardType') {
      newCards[index].cardType = value as CardType;
    }
    setCards(newCards);
  }, [players, cards]);

  const handleSaveResult = useCallback(async () => {
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

      const cardsWithIds: Card[] = cards.map((c, index) => ({
        id: `card_${editingMatch.id}_${index}`,
        playerId: c.playerId,
        playerName: c.playerName,
        cardType: c.cardType,
        createdAt: new Date()
      }));

      // Prepare result data
      const resultData: any = {
        eventId: editingMatch.id,
        rivalId: rivalId,
        rivalName: selectedRival.name,
        furiaGoals,
        rivalGoals,
        goals: goalsWithIds,
        cards: cardsWithIds,
        date: editingMatch.date,
        location: editingMatch.location,
        figureOfTheMatchId: figureOfTheMatchId || null,
        figureOfTheMatchName: figureOfTheMatchId ? players.find(p => p.id === figureOfTheMatchId)?.displayName || '' : null,
        isFriendly: isFriendly || false,
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

      // IMPORTANT: Also update the archived event with rivalId, rivalName, and isFriendly
      // This ensures the match card displays the correct rival and friendly status
      const eventArchiveRef = doc(db, 'events_archive', editingMatch.id);
      await updateDoc(eventArchiveRef, {
        rivalId: rivalId,
        rivalName: selectedRival.name,
        isFriendly: isFriendly || false
      });

      // Only update stats if this is NOT a friendly match
      if (!isFriendly) {
        // Update goal and assist stats - Calculate difference between new and old goals
        if (editingMatch.result && !editingMatch.result.isFriendly) {
        // When editing, we need to calculate the difference
        const oldGoals = editingMatch.result.goals;
        
        // Count how many goals each player had before (excluding INVITADO)
        const oldGoalCounts = new Map<string, number>();
        const oldAssistCounts = new Map<string, number>();
        
        oldGoals.forEach(g => {
          if (g.playerId !== 'INVITADO') {
            oldGoalCounts.set(g.playerId, (oldGoalCounts.get(g.playerId) || 0) + 1);
          }
          if (g.assistPlayerId) {
            oldAssistCounts.set(g.assistPlayerId, (oldAssistCounts.get(g.assistPlayerId) || 0) + 1);
          }
        });
        
        // Count how many goals each player has now (excluding INVITADO)
        const newGoalCounts = new Map<string, number>();
        const newAssistCounts = new Map<string, number>();
        
        goalsWithIds.forEach(g => {
          if (g.playerId !== 'INVITADO') {
            newGoalCounts.set(g.playerId, (newGoalCounts.get(g.playerId) || 0) + 1);
          }
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
            // Get player email from playerId
            const player = players.find(p => p.id === playerId);
            if (player) {
              const statsRef = doc(db, 'stats', player.email);
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
        }
        
        // Update assist stats
        const allAssistPlayerIds = new Set([...oldAssistCounts.keys(), ...newAssistCounts.keys()]);
        for (const playerId of allAssistPlayerIds) {
          const oldCount = oldAssistCounts.get(playerId) || 0;
          const newCount = newAssistCounts.get(playerId) || 0;
          const diff = newCount - oldCount;
          
          if (diff !== 0) {
            // Get player email from playerId
            const player = players.find(p => p.id === playerId);
            if (player) {
              const statsRef = doc(db, 'stats', player.email);
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
        }
        } else if (!editingMatch.result || editingMatch.result.isFriendly) {
          // Creating new result or editing from friendly to official - just add all goals and assists
          for (const goal of goalsWithIds) {
          // Skip INVITADO goals - they don't count towards stats
          if (goal.playerId === 'INVITADO') {
            continue;
          }
          
          // Get player email from playerId
          const player = players.find(p => p.id === goal.playerId);
          if (player) {
            const statsRef = doc(db, 'stats', player.email);
            const statsDoc = await getDoc(statsRef);
            
            if (statsDoc.exists()) {
              const currentGoals = statsDoc.data().goals || 0;
              await updateDoc(statsRef, {
                goals: currentGoals + 1,
                lastUpdated: serverTimestamp()
              });
            }
          }
          
          // Update assist stats if there's an assist
          if (goal.assistPlayerId) {
            const assistPlayer = players.find(p => p.id === goal.assistPlayerId);
            if (assistPlayer) {
              const assistStatsRef = doc(db, 'stats', assistPlayer.email);
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
        }

        // Update figure of the match stats
        if (figureOfTheMatchId) {
          // Get player email from figureOfTheMatchId
          const figurePlayer = players.find(p => p.id === figureOfTheMatchId);
          if (figurePlayer) {
            const statsRef = doc(db, 'stats', figurePlayer.email);
            const statsDoc = await getDoc(statsRef);
            
            if (statsDoc.exists()) {
              const currentFigures = statsDoc.data().figureOfTheMatch || 0;
              // Check if this is a new figure or a change
              const isNewFigure = !editingMatch.result || 
                editingMatch.result.figureOfTheMatchId !== figureOfTheMatchId ||
                editingMatch.result.isFriendly;
              
              if (isNewFigure) {
                // If there was a previous figure in an official match, decrement their count
                const previousFigureId = editingMatch.result?.figureOfTheMatchId;
                if (previousFigureId && previousFigureId !== figureOfTheMatchId && editingMatch.result && !editingMatch.result.isFriendly) {
                  const oldFigurePlayer = players.find(p => p.id === previousFigureId);
                  if (oldFigurePlayer) {
                    const oldFigureRef = doc(db, 'stats', oldFigurePlayer.email);
                    const oldFigureDoc = await getDoc(oldFigureRef);
                    if (oldFigureDoc.exists()) {
                      const oldFigureCount = oldFigureDoc.data().figureOfTheMatch || 0;
                      await updateDoc(oldFigureRef, {
                        figureOfTheMatch: Math.max(0, oldFigureCount - 1),
                        lastUpdated: serverTimestamp()
                      });
                    }
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
        }

        // Update card stats
        if (editingMatch.result && !editingMatch.result.isFriendly) {
        // When editing, we need to calculate the difference
        const oldCards = editingMatch.result.cards || [];
        
        // Count how many cards each player had before
        const oldYellowCardCounts = new Map<string, number>();
        const oldRedCardCounts = new Map<string, number>();
        
        oldCards.forEach(c => {
          if (c.cardType === 'yellow') {
            oldYellowCardCounts.set(c.playerId, (oldYellowCardCounts.get(c.playerId) || 0) + 1);
          } else if (c.cardType === 'red') {
            oldRedCardCounts.set(c.playerId, (oldRedCardCounts.get(c.playerId) || 0) + 1);
          }
        });
        
        // Count how many cards each player has now
        const newYellowCardCounts = new Map<string, number>();
        const newRedCardCounts = new Map<string, number>();
        
        cardsWithIds.forEach(c => {
          if (c.cardType === 'yellow') {
            newYellowCardCounts.set(c.playerId, (newYellowCardCounts.get(c.playerId) || 0) + 1);
          } else if (c.cardType === 'red') {
            newRedCardCounts.set(c.playerId, (newRedCardCounts.get(c.playerId) || 0) + 1);
          }
        });
        
        // Update yellow card stats based on differences
        const allYellowPlayerIds = new Set([...oldYellowCardCounts.keys(), ...newYellowCardCounts.keys()]);
        for (const playerId of allYellowPlayerIds) {
          const oldCount = oldYellowCardCounts.get(playerId) || 0;
          const newCount = newYellowCardCounts.get(playerId) || 0;
          const diff = newCount - oldCount;
          
          if (diff !== 0) {
            // Get player email from playerId
            const player = players.find(p => p.id === playerId);
            if (player) {
              const statsRef = doc(db, 'stats', player.email);
              const statsDoc = await getDoc(statsRef);
              
              if (statsDoc.exists()) {
                const currentYellowCards = statsDoc.data().yellowCards || 0;
                await updateDoc(statsRef, {
                  yellowCards: Math.max(0, currentYellowCards + diff),
                  lastUpdated: serverTimestamp()
                });
              }
            }
          }
        }
        
        // Update red card stats based on differences
        const allRedPlayerIds = new Set([...oldRedCardCounts.keys(), ...newRedCardCounts.keys()]);
        for (const playerId of allRedPlayerIds) {
          const oldCount = oldRedCardCounts.get(playerId) || 0;
          const newCount = newRedCardCounts.get(playerId) || 0;
          const diff = newCount - oldCount;
          
          if (diff !== 0) {
            // Get player email from playerId
            const player = players.find(p => p.id === playerId);
            if (player) {
              const statsRef = doc(db, 'stats', player.email);
              const statsDoc = await getDoc(statsRef);
              
              if (statsDoc.exists()) {
                const currentRedCards = statsDoc.data().redCards || 0;
                await updateDoc(statsRef, {
                  redCards: Math.max(0, currentRedCards + diff),
                  lastUpdated: serverTimestamp()
                });
              }
            }
          }
        }
        } else if (!editingMatch.result || editingMatch.result.isFriendly) {
          // Creating new result or editing from friendly to official - just add all cards
          for (const card of cardsWithIds) {
          // Get player email from playerId
          const player = players.find(p => p.id === card.playerId);
          if (player) {
            const statsRef = doc(db, 'stats', player.email);
            const statsDoc = await getDoc(statsRef);
            
            if (statsDoc.exists()) {
              if (card.cardType === 'yellow') {
                const currentYellowCards = statsDoc.data().yellowCards || 0;
                await updateDoc(statsRef, {
                  yellowCards: currentYellowCards + 1,
                  lastUpdated: serverTimestamp()
                });
              } else if (card.cardType === 'red') {
                const currentRedCards = statsDoc.data().redCards || 0;
                await updateDoc(statsRef, {
                  redCards: currentRedCards + 1,
                  lastUpdated: serverTimestamp()
                });
              }
            }
          }
        }
        }
      } else {
        // This is a friendly match - need to remove stats if it was previously official
        if (editingMatch.result && !editingMatch.result.isFriendly) {
          // Was official, now is friendly - need to remove all stats
          const oldGoals = editingMatch.result.goals || [];
          const oldCards = editingMatch.result.cards || [];
          const oldFigureId = editingMatch.result.figureOfTheMatchId;

          // Remove goal stats (excluding INVITADO)
          for (const goal of oldGoals) {
            if (goal.playerId === 'INVITADO') {
              continue;
            }
            
            const player = players.find(p => p.id === goal.playerId);
            if (player) {
              const statsRef = doc(db, 'stats', player.email);
              const statsDoc = await getDoc(statsRef);
              if (statsDoc.exists()) {
                const currentGoals = statsDoc.data().goals || 0;
                await updateDoc(statsRef, {
                  goals: Math.max(0, currentGoals - 1),
                  lastUpdated: serverTimestamp()
                });
              }
            }
            if (goal.assistPlayerId) {
              const assistPlayer = players.find(p => p.id === goal.assistPlayerId);
              if (assistPlayer) {
                const assistStatsRef = doc(db, 'stats', assistPlayer.email);
                const assistStatsDoc = await getDoc(assistStatsRef);
                if (assistStatsDoc.exists()) {
                  const currentAssists = assistStatsDoc.data().assists || 0;
                  await updateDoc(assistStatsRef, {
                    assists: Math.max(0, currentAssists - 1),
                    lastUpdated: serverTimestamp()
                  });
                }
              }
            }
          }

          // Remove card stats
          for (const card of oldCards) {
            const player = players.find(p => p.id === card.playerId);
            if (player) {
              const statsRef = doc(db, 'stats', player.email);
              const statsDoc = await getDoc(statsRef);
              if (statsDoc.exists()) {
                if (card.cardType === 'yellow') {
                  const currentYellowCards = statsDoc.data().yellowCards || 0;
                  await updateDoc(statsRef, {
                    yellowCards: Math.max(0, currentYellowCards - 1),
                    lastUpdated: serverTimestamp()
                  });
                } else if (card.cardType === 'red') {
                  const currentRedCards = statsDoc.data().redCards || 0;
                  await updateDoc(statsRef, {
                    redCards: Math.max(0, currentRedCards - 1),
                    lastUpdated: serverTimestamp()
                  });
                }
              }
            }
          }

          // Remove figure of the match stat
          if (oldFigureId) {
            const oldFigurePlayer = players.find(p => p.id === oldFigureId);
            if (oldFigurePlayer) {
              const oldFigureRef = doc(db, 'stats', oldFigurePlayer.email);
              const oldFigureDoc = await getDoc(oldFigureRef);
              if (oldFigureDoc.exists()) {
                const oldFigureCount = oldFigureDoc.data().figureOfTheMatch || 0;
                await updateDoc(oldFigureRef, {
                  figureOfTheMatch: Math.max(0, oldFigureCount - 1),
                  lastUpdated: serverTimestamp()
                });
              }
            }
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
  }, [editingMatch, rivalId, rivals, furiaGoals, rivalGoals, goals, cards, figureOfTheMatchId, isFriendly, players, loadMatches]);

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const handleDeleteMatch = useCallback(async (match: ArchivedMatch) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar este partido?\n\n${formatDate(match.date)}\nFURIA vs ${match.rivalName}\n\nEsta acción no se puede deshacer y eliminará:\n- El evento archivado\n- Las asistencias relacionadas\n- El resultado del partido (si existe)`)) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Delete archived event
      const eventArchiveRef = doc(db, 'events_archive', match.id);
      batch.delete(eventArchiveRef);

      // 2. Delete related archived attendances
      const attendancesArchiveRef = collection(db, 'attendances_archive');
      const attendanceQuery = query(attendancesArchiveRef, where('eventId', '==', match.id));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      attendanceSnapshot.forEach((attendanceDoc) => {
        batch.delete(attendanceDoc.ref);
      });

      // 3. Delete match result if exists
      const resultRef = doc(db, 'match_results', match.id);
      const resultDoc = await getDoc(resultRef);
      if (resultDoc.exists()) {
        batch.delete(resultRef);
      }

      await batch.commit();

      alert('✅ Partido eliminado exitosamente');
      await loadMatches();
    } catch (error: any) {
      console.error('Error deleting match:', error);
      let errorMessage = '❌ Error al eliminar el partido';
      if (error.code === 'permission-denied') {
        errorMessage += '\n🔒 Error de permisos. Verifica las reglas de Firebase.';
      } else if (error.message) {
        errorMessage += '\n' + error.message;
      }
      alert(errorMessage);
    }
  }, [formatDate, loadMatches]);

  // Filter matches based on selected filters - memoized for better performance
  const filteredMatches = useMemo(() => matches.filter((match) => {
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
  }), [matches, filterRivalId, filterResult]);

  if (loading) {
    return <div className="loading-history">Cargando historial de partidos...</div>;
  }

  return (
    <div className="match-history-container">
      <h1>Historial de Partidos</h1>
      
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
                  <div className="match-header-left">
                    <span className="match-date">{formatDate(match.date)}</span>
                    {match.location && (
                      <span className="match-location">📍 {match.location}</span>
                    )}
                  </div>
                  <div className="match-header-right">
                    {match.isFriendly ? (
                      <span className="match-type-badge match-type-friendly">AMISTOSO</span>
                    ) : (
                      <span className="match-type-badge match-type-tournament">TORNEO</span>
                    )}
                  </div>
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

                {hasResult && match.result!.isFriendly && (
                  <div className="friendly-match-badge">
                    🏆 Partido Amistoso (No suma en estadísticas)
                  </div>
                )}

                {!hasResult && (
                  <div className="match-no-result">
                    Resultado no ingresado
                  </div>
                )}

{hasResult && (
                  <div className="match-details">
                    <div className="stats-container">
                      {/* Figure of the Match */}
                      {match.result!.figureOfTheMatchName && (
                        <div className="stat-card-match stat-figure">
                          <div className="stat-header">
                            <span className="stat-icon">⭐</span>
                            <span className="stat-title">Figura</span>
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{match.result!.figureOfTheMatchName}</div>
                          </div>
                        </div>
                      )}

                      {/* Goals Section */}
                      {match.result!.goals.length > 0 ? (
                        <div className="stat-card-match stat-goals">
                          <div className="stat-header">
                            <span className="stat-icon">⚽</span>
                            <span className="stat-title">Goles ({match.result!.goals.length})</span>
                          </div>
                          <div className="stat-content">
                            {(() => {
                              const goalsByPlayer = match.result!.goals.reduce((acc, goal) => {
                                if (!acc[goal.playerId]) {
                                  acc[goal.playerId] = {
                                    playerName: goal.playerName,
                                    count: 0,
                                    assists: []
                                  };
                                }
                                acc[goal.playerId].count++;
                                if (goal.assistPlayerName) {
                                  acc[goal.playerId].assists.push(goal.assistPlayerName);
                                }
                                return acc;
                              }, {} as Record<string, { playerName: string; count: number; assists: string[] }>);

                              return Object.entries(goalsByPlayer).map(([playerId, data]) => (
                                <div key={playerId} className="stat-item">
                                  <div className="stat-main">
                                    <span className="stat-number-match">{data.count}</span>
                                    <span className="stat-player">{data.playerName}</span>
                                  </div>
                                  {data.assists.length > 0 && (
                                    <div className="stat-assists">
                                      {data.assists.map((assist, idx) => (
                                        <span key={idx} className="stat-assist-badge">
                                          {assist}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      ) : match.result!.furiaGoals === 0 ? (
                        <div className="stat-card-match stat-goals">
                          <div className="stat-header">
                            <span className="stat-icon">⚽</span>
                            <span className="stat-title">Goles (0)</span>
                          </div>
                          <div className="stat-content stat-empty">
                            Sin goles
                          </div>
                        </div>
                      ) : null}

                      {/* Cards Section */}
                      {match.result!.cards && match.result!.cards.length > 0 && (
                        <div className="stat-card-match stat-cards">
                          <div className="stat-header">
                            <span className="stat-icon">📋</span>
                            <span className="stat-title">Tarjetas ({match.result!.cards.length})</span>
                          </div>
                          <div className="stat-content">
                            {(() => {
                              const cardsByPlayer = match.result!.cards.reduce((acc, card) => {
                                if (!acc[card.playerId]) {
                                  acc[card.playerId] = {
                                    playerName: card.playerName,
                                    yellow: 0,
                                    red: 0
                                  };
                                }
                                if (card.cardType === 'yellow') {
                                  acc[card.playerId].yellow++;
                                } else {
                                  acc[card.playerId].red++;
                                }
                                return acc;
                              }, {} as Record<string, { playerName: string; yellow: number; red: number }>);

                              return Object.entries(cardsByPlayer).map(([playerId, data]) => (
                                <div key={playerId} className="stat-item">
                                  <div className="stat-main">
                                    <div className="stat-card-icons">
                                      {Array.from({ length: data.yellow }, (_, i) => (
                                        <span key={`yellow-${i}`} className="card-emoji">🟨</span>
                                      ))}
                                      {Array.from({ length: data.red }, (_, i) => (
                                        <span key={`red-${i}`} className="card-emoji">🟥</span>
                                      ))}
                                    </div>
                                    <span className="stat-player">{data.playerName}</span>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
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
                    <button 
                      onClick={() => handleDeleteMatch(match)}
                      className="btn-delete-match"
                      title="Eliminar partido"
                    >
                      🗑️ Eliminar Evento
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
                <p className="figure-info">
                  💡 La figura del partido suma 1 punto en estadísticas{isFriendly ? ' (no aplica en partidos amistosos)' : ''}
                </p>
              </div>
            </div>

            <div className="result-editor-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <input
                  type="checkbox"
                  id="isFriendly"
                  checked={isFriendly}
                  onChange={(e) => setIsFriendly(e.target.checked)}
                  disabled={saving}
                  style={{ width: '20px', height: '20px', cursor: saving ? 'not-allowed' : 'pointer' }}
                />
                <label htmlFor="isFriendly" style={{ cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '14px', flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Partido Amistoso</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                    Si está marcado, este partido aparecerá en el historial pero NO sumará en las estadísticas (goles, asistencias, tarjetas, figura del partido)
                  </span>
                </label>
              </div>
            </div>

            <div className="result-editor-section">
              <h3>⚽ Goles de FURIA ({goals.length}/{furiaGoals})</h3>
              {goals.length !== furiaGoals && furiaGoals > 0 && (
                <div className="goals-validation-warning">
                  ⚠️ Debes completar todos los goles antes de guardar. Faltan {furiaGoals - goals.length} gol(es).
                </div>
              )}
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
                            {isFriendly && (
                              <option value="INVITADO">Invitado</option>
                            )}
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
                            disabled={saving || goal.playerId === 'INVITADO'}
                            title={goal.playerId === 'INVITADO' ? 'Los invitados no pueden tener asistencias' : ''}
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

            <div className="result-editor-section">
              <h3>🟨🟥 Tarjetas ({cards.length})</h3>
              <div className="cards-editor">
                {cards.length > 0 && (
                  <>
                    {cards.map((card, index) => (
                      <div key={index} className="card-editor-item">
                        <div className="card-editor-field">
                          <label>Jugadora</label>
                          <select
                            value={card.playerId}
                            onChange={(e) => handleCardChange(index, 'playerId', e.target.value)}
                            disabled={saving}
                          >
                            {players.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.displayName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="card-editor-field">
                          <label>Tipo de Tarjeta</label>
                          <select
                            value={card.cardType}
                            onChange={(e) => handleCardChange(index, 'cardType', e.target.value)}
                            disabled={saving}
                          >
                            <option value="yellow">🟨 Amarilla</option>
                            <option value="red">🟥 Roja</option>
                          </select>
                        </div>

                        <button
                          onClick={() => handleRemoveCard(index)}
                          className="btn-remove-goal"
                          disabled={saving}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </>
                )}
                
                <div className="card-add-buttons">
                  <button
                    onClick={() => handleAddCard('yellow')}
                    className="btn-add-card yellow"
                    disabled={saving}
                  >
                    🟨 Agregar Tarjeta Amarilla
                  </button>
                  <button
                    onClick={() => handleAddCard('red')}
                    className="btn-add-card red"
                    disabled={saving}
                  >
                    🟥 Agregar Tarjeta Roja
                  </button>
                </div>
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
});

MatchHistory.displayName = 'MatchHistory';

export default MatchHistory;

