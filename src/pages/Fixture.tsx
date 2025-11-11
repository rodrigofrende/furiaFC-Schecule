import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { type Rival } from '../types';
import '../styles/Fixture.css';

interface FixtureMatch {
  id: string;
  fecha: number; // Fecha 1, Fecha 2, etc.
  rivalId: string;
  rivalName: string;
  date?: Date; // Fecha real del partido (opcional)
  location?: string;
  played?: boolean; // Si ya se jugó este partido
  furiaGoals?: number; // Goles de Furia
  rivalGoals?: number; // Goles del rival
  matchResultId?: string; // ID del resultado en match_results
  createdAt: Date;
  updatedAt: Date;
}

interface AvailableMatch {
  id: string;
  rivalName: string;
  date: Date;
  location?: string;
  furiaGoals: number;
  rivalGoals: number;
}

const Fixture = () => {
  const { user } = useAuth();
  const [fixtures, setFixtures] = useState<FixtureMatch[]>([]);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [availableMatches, setAvailableMatches] = useState<AvailableMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFixtureModal, setShowFixtureModal] = useState(false);
  const [showRivalModal, setShowRivalModal] = useState(false);
  const [editingFixture, setEditingFixture] = useState<FixtureMatch | null>(null);
  const [editingRival, setEditingRival] = useState<Rival | null>(null);
  
  // Fixture form state
  const [fecha, setFecha] = useState<number>(1);
  const [rivalId, setRivalId] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [location, setLocation] = useState('');
  const [linkedMatchId, setLinkedMatchId] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Rival form state
  const [rivalName, setRivalName] = useState('');

  useEffect(() => {
    loadFixtures();
    loadRivals();
    loadAvailableMatches();
  }, []);

  const loadFixtures = async () => {
    try {
      const fixturesRef = collection(db, 'fixtures');
      const q = query(fixturesRef, orderBy('fecha', 'asc'));
      const snapshot = await getDocs(q);
      
      const fixturesData: FixtureMatch[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fixturesData.push({
          id: doc.id,
          fecha: data.fecha,
          rivalId: data.rivalId,
          rivalName: data.rivalName,
          date: data.date ? (data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date)) : undefined,
          location: data.location,
          played: data.played || false,
          furiaGoals: data.furiaGoals,
          rivalGoals: data.rivalGoals,
          matchResultId: data.matchResultId,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
        });
      });
      
      setFixtures(fixturesData);
    } catch (error) {
      console.error('Error loading fixtures:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRivals = async () => {
    try {
      const rivalsRef = collection(db, 'rivals');
      const q = query(rivalsRef, orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      
      const rivalsData: Rival[] = [];
      snapshot.forEach((doc) => {
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

  const loadAvailableMatches = async () => {
    try {
      // Load all match results
      const resultsRef = collection(db, 'match_results');
      const snapshot = await getDocs(resultsRef);
      
      const matchesData: AvailableMatch[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include matches with results
        if (data.furiaGoals !== undefined && data.rivalGoals !== undefined && data.rivalName) {
          matchesData.push({
            id: doc.id,
            rivalName: data.rivalName,
            date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
            location: data.location,
            furiaGoals: data.furiaGoals,
            rivalGoals: data.rivalGoals
          });
        }
      });
      
      // Sort by date descending (most recent first)
      matchesData.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setAvailableMatches(matchesData);
    } catch (error) {
      console.error('Error loading available matches:', error);
    }
  };

  const openAddFixtureModal = () => {
    setEditingFixture(null);
    setFecha(getNextFecha());
    setRivalId('');
    setMatchDate('');
    setLocation('');
    setLinkedMatchId('');
    setShowFixtureModal(true);
  };

  const openEditFixtureModal = (fixture: FixtureMatch) => {
    setEditingFixture(fixture);
    setFecha(fixture.fecha);
    setRivalId(fixture.rivalId);
    setMatchDate(fixture.date ? fixture.date.toISOString().split('T')[0] : '');
    setLocation(fixture.location || '');
    setLinkedMatchId(fixture.matchResultId || '');
    setShowFixtureModal(true);
  };

  const getNextFecha = () => {
    if (fixtures.length === 0) return 1;
    const maxFecha = Math.max(...fixtures.map(f => f.fecha));
    return maxFecha + 1;
  };

  const handleSaveFixture = async () => {
    if (!rivalId) {
      alert('⚠️ Por favor seleccioná un rival');
      return;
    }

    setSaving(true);
    try {
      const rival = rivals.find(r => r.id === rivalId);
      if (!rival) {
        alert('⚠️ Rival no encontrado');
        return;
      }

      // Convert date string to Date object in local timezone
      let dateValue = null;
      if (matchDate) {
        const [year, month, day] = matchDate.split('-').map(Number);
        // Create date at noon local time to avoid timezone issues
        const localDate = new Date(year, month - 1, day, 12, 0, 0);
        dateValue = Timestamp.fromDate(localDate);
      }

      const fixtureData: any = {
        fecha,
        rivalId,
        rivalName: rival.name,
        date: dateValue,
        location: location.trim() || null,
        updatedAt: Timestamp.now()
      };

      // If a match is linked, get the result data and mark as played
      if (linkedMatchId) {
        const linkedMatch = availableMatches.find(m => m.id === linkedMatchId);
        if (linkedMatch) {
          fixtureData.played = true;
          fixtureData.furiaGoals = linkedMatch.furiaGoals;
          fixtureData.rivalGoals = linkedMatch.rivalGoals;
          fixtureData.matchResultId = linkedMatchId;
        }
      } else {
        // If no match is linked (or unlinked), reset played status
        fixtureData.played = false;
        fixtureData.furiaGoals = null;
        fixtureData.rivalGoals = null;
        fixtureData.matchResultId = null;
      }

      if (editingFixture) {
        await updateDoc(doc(db, 'fixtures', editingFixture.id), fixtureData);
        alert('✅ Fecha actualizada correctamente');
      } else {
        await addDoc(collection(db, 'fixtures'), {
          ...fixtureData,
          createdAt: Timestamp.now()
        });
        alert('✅ Fecha agregada correctamente');
      }

      setShowFixtureModal(false);
      await loadFixtures();
    } catch (error) {
      console.error('Error saving fixture:', error);
      alert('❌ Error al guardar la fecha');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFixture = async (fixtureId: string) => {
    if (!window.confirm('¿Estás seguro de que querés eliminar esta fecha?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'fixtures', fixtureId));
      alert('✅ Fecha eliminada correctamente');
      await loadFixtures();
    } catch (error) {
      console.error('Error deleting fixture:', error);
      alert('❌ Error al eliminar la fecha');
    }
  };

  // Rival management
  const openAddRivalModal = () => {
    setEditingRival(null);
    setRivalName('');
    setShowRivalModal(true);
  };

  const openEditRivalModal = (rival: Rival) => {
    setEditingRival(rival);
    setRivalName(rival.name);
    setShowRivalModal(true);
  };

  const handleSaveRival = async () => {
    if (!rivalName.trim()) {
      alert('⚠️ Por favor ingresá el nombre del rival');
      return;
    }

    // Validar que no exista un rival con el mismo nombre (case-insensitive)
    const normalizedName = rivalName.trim().toLowerCase();
    const duplicateRival = rivals.find(r => {
      // Si estamos editando, excluir el rival actual de la búsqueda
      if (editingRival && r.id === editingRival.id) {
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
      if (editingRival) {
        await updateDoc(doc(db, 'rivals', editingRival.id), {
          name: rivalName.trim()
        });
        alert('✅ Rival actualizado correctamente');
      } else {
        await addDoc(collection(db, 'rivals'), {
          name: rivalName.trim(),
          logoUrl: '',
          createdAt: Timestamp.now(),
          createdBy: user?.email || 'unknown'
        });
        alert('✅ Rival agregado correctamente');
      }

      setShowRivalModal(false);
      await loadRivals();
      await loadFixtures(); // Reload to update rival names if changed
    } catch (error) {
      console.error('Error saving rival:', error);
      alert('❌ Error al guardar el rival');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRival = async (rivalId: string) => {
    // Check if rival is used in any fixture
    const isUsed = fixtures.some(f => f.rivalId === rivalId);
    if (isUsed) {
      alert('⚠️ No se puede eliminar este rival porque está siendo usado en el fixture');
      return;
    }

    if (!window.confirm('¿Estás seguro de que querés eliminar este rival?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'rivals', rivalId));
      alert('✅ Rival eliminado correctamente');
      await loadRivals();
    } catch (error) {
      console.error('Error deleting rival:', error);
      alert('❌ Error al eliminar el rival');
    }
  };

  // Group fixtures by fecha
  const fixturesByFecha = fixtures.reduce((acc, fixture) => {
    if (!acc[fixture.fecha]) {
      acc[fixture.fecha] = [];
    }
    acc[fixture.fecha].push(fixture);
    return acc;
  }, {} as Record<number, FixtureMatch[]>);

  const fechas = Object.keys(fixturesByFecha).map(Number).sort((a, b) => a - b);

  if (loading) {
    return <div className="loading">Cargando fixture...</div>;
  }

  // Solo admins pueden editar
  const canEdit = user?.role === 'ADMIN';

  return (
    <div className="fixture-container">
      <h1>Fixture</h1>

      {canEdit && (
        <div className="fixture-actions">
          <button onClick={openAddFixtureModal} className="btn-primary">
            + Agregar Fecha
          </button>
          <button onClick={openAddRivalModal} className="btn-secondary">
            + Gestionar Rivales
          </button>
        </div>
      )}

      {fixtures.length === 0 ? (
        <div className="no-fixtures">
          <p>No hay fechas cargadas en el fixture.</p>
          {canEdit && <p>Usá el botón "Agregar Fecha" para comenzar.</p>}
        </div>
      ) : (
        <div className="fixtures-list">
          {fechas.map((fechaNum) => (
            <div key={fechaNum} className="fecha-card">
              <div className="fecha-header">
                {(() => {
                  const referenceFixture = fixturesByFecha[fechaNum][0];
                  const hasScore =
                    referenceFixture?.played &&
                    referenceFixture.furiaGoals !== undefined &&
                    referenceFixture.rivalGoals !== undefined;

                  let statusLabel = 'Pendiente';
                  let statusClass = 'pending';
                  let statusIcon = '⏳';

                  if (hasScore) {
                    if (referenceFixture.furiaGoals! > referenceFixture.rivalGoals!) {
                      statusLabel = 'Victoria';
                      statusClass = 'victory';
                      statusIcon = '🏆';
                    } else if (
                      referenceFixture.furiaGoals! < referenceFixture.rivalGoals!
                    ) {
                      statusLabel = 'Derrota';
                      statusClass = 'defeat';
                      statusIcon = '⚠️';
                    } else {
                      statusLabel = 'Empate';
                      statusClass = 'draw';
                      statusIcon = '🤝';
                    }
                  }

                  return (
                    <div className="fecha-header-left">
                      <h2 className="fecha-title">Fecha {fechaNum}</h2>
                      <span className={`fecha-status ${statusClass}`}>
                        <span className="fecha-status-icon" aria-hidden="true">
                          {statusIcon}
                        </span>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })()}
                {canEdit && (
                  <div className="fecha-actions">
                    <button
                      onClick={() => openEditFixtureModal(fixturesByFecha[fechaNum][0])}
                      className="btn-icon btn-edit"
                      title="Editar fecha"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteFixture(fixturesByFecha[fechaNum][0].id)}
                      className="btn-icon btn-delete"
                      title="Eliminar fecha"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
              {fixturesByFecha[fechaNum].map((fixture) => (
                <div key={fixture.id} className={`fixture-match ${fixture.played ? 'played' : ''}`}>
                  <div className="match-teams">
                    <div className="team team-furia">
                      <span className="team-name">FURIA FC</span>
                      {fixture.played && fixture.furiaGoals !== undefined && (
                        <span className="team-score">{fixture.furiaGoals}</span>
                      )}
                    </div>
                    <div className="match-vs">VS</div>
                    <div className="team team-rival">
                      {fixture.played && fixture.rivalGoals !== undefined && (
                        <span className="team-score">{fixture.rivalGoals}</span>
                      )}
                      <span className="team-name">{fixture.rivalName}</span>
                    </div>
                  </div>
                  
                  {(fixture.date || fixture.location) && (
                    <div className="match-details">
                      {fixture.date && (
                        <span className="match-date">
                          📅 {fixture.date.toLocaleDateString('es-AR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      )}
                      {fixture.location && (
                        <span className="match-location">
                          📍 {fixture.location}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Fixture Modal */}
      {showFixtureModal && (
        <Modal
          onClose={() => setShowFixtureModal(false)}
          title={editingFixture ? 'Editar Fecha' : 'Agregar Fecha'}
        >
          <div className="fixture-form">
            <div className="form-group">
              <label htmlFor="fecha">Fecha N°:</label>
              <input
                id="fecha"
                type="number"
                min="1"
                value={fecha}
                onChange={(e) => setFecha(parseInt(e.target.value) || 1)}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="rival">Rival:</label>
              <div className="rival-select-group">
                <select
                  id="rival"
                  value={rivalId}
                  onChange={(e) => setRivalId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Seleccioná un rival</option>
                  {rivals.map((rival) => (
                    <option key={rival.id} value={rival.id}>
                      {rival.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={openAddRivalModal}
                  className="btn-add-rival"
                  type="button"
                  disabled={saving}
                  title="Agregar nuevo rival"
                >
                  +
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="match-date">Fecha del partido (opcional):</label>
              <input
                id="match-date"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Lugar (opcional):</label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Cancha Municipal"
                maxLength={100}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="linked-match">Vincular con Partido (opcional):</label>
              <select
                id="linked-match"
                value={linkedMatchId}
                onChange={(e) => setLinkedMatchId(e.target.value)}
                disabled={saving}
              >
                <option value="">Sin vincular (partido pendiente)</option>
                {availableMatches.map((match) => {
                  const result = match.furiaGoals > match.rivalGoals ? '✓ Victoria' : 
                                 match.furiaGoals < match.rivalGoals ? '✗ Derrota' : '= Empate';
                  const score = `${match.furiaGoals}-${match.rivalGoals}`;
                  const dateStr = match.date.toLocaleDateString('es-AR');
                  return (
                    <option key={match.id} value={match.id}>
                      {match.rivalName} ({score}) - {dateStr} - {result}
                    </option>
                  );
                })}
              </select>
              {linkedMatchId && (
                <p className="form-help-text">
                  💡 Al vincular un partido, se copiarán automáticamente los goles y el resultado.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowFixtureModal(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFixture}
                className="btn-primary"
                disabled={saving || !rivalId}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rival Management Modal */}
      {showRivalModal && (
        <Modal
          onClose={() => setShowRivalModal(false)}
          title="Gestionar Rivales"
        >
          <div className="rival-management">
            <div className="rival-form">
              <div className="form-group">
                <label htmlFor="rival-name">
                  {editingRival ? 'Editar Rival:' : 'Nuevo Rival:'}
                </label>
                <input
                  id="rival-name"
                  type="text"
                  value={rivalName}
                  onChange={(e) => setRivalName(e.target.value)}
                  placeholder="Nombre del rival"
                  maxLength={50}
                  disabled={saving}
                />
              </div>
              <div className="rival-form-actions">
                {editingRival && (
                  <button
                    onClick={() => {
                      setEditingRival(null);
                      setRivalName('');
                    }}
                    className="btn-secondary"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleSaveRival}
                  className="btn-primary"
                  disabled={saving || !rivalName.trim()}
                >
                  {saving ? 'Guardando...' : editingRival ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </div>

            <div className="rivals-list">
              <h3>Rivales Existentes:</h3>
              {rivals.length === 0 ? (
                <p className="no-rivals">No hay rivales cargados</p>
              ) : (
                <div className="rivals-grid">
                  {rivals.map((rival) => (
                    <div key={rival.id} className="rival-item">
                      <span className="rival-item-name">{rival.name}</span>
                      <div className="rival-item-actions">
                        <button
                          onClick={() => openEditRivalModal(rival)}
                          className="btn-icon btn-edit-small"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteRival(rival.id)}
                          className="btn-icon btn-delete-small"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Fixture;

