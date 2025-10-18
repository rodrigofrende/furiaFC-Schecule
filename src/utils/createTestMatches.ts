import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const createTestMatches = async (userId: string) => {
  try {
    const eventsRef = collection(db, 'events');
    
    // Crear 3 partidos de ejemplo que ya pasaron (para que se archiven automáticamente)
    const now = new Date();
    
    // Partido 1: Hace 2 horas (ya debería estar archivado)
    const match1Date = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    await addDoc(eventsRef, {
      type: 'MATCH',
      title: 'FURIA vs Las Leonas',
      description: 'Partido amistoso',
      location: 'Cancha Municipal, Av. Libertador 1234',
      date: Timestamp.fromDate(match1Date),
      createdBy: userId,
      createdAt: Timestamp.now(),
      isRecurring: false
    });

    // Partido 2: Hace 3 días
    const match2Date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    await addDoc(eventsRef, {
      type: 'MATCH',
      title: 'FURIA vs Las Tigres',
      description: 'Partido de liga',
      location: 'Estadio Central, Calle 50 N° 789',
      date: Timestamp.fromDate(match2Date),
      createdBy: userId,
      createdAt: Timestamp.now(),
      isRecurring: false
    });

    // Partido 3: Hace 1 semana
    const match3Date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await addDoc(eventsRef, {
      type: 'MATCH',
      title: 'FURIA vs Independientes FC',
      description: 'Copa de verano',
      location: 'Liverpool, Francisco Vazquez 4.601',
      date: Timestamp.fromDate(match3Date),
      createdBy: userId,
      createdAt: Timestamp.now(),
      isRecurring: false
    });

    console.log('✅ 3 partidos de prueba creados exitosamente');
    return { success: true, message: '3 partidos de prueba creados' };
  } catch (error) {
    console.error('Error creating test matches:', error);
    return { success: false, message: 'Error al crear partidos de prueba' };
  }
};

