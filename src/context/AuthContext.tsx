import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User, type PlayerPosition } from '../types';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, displayName: string, role: 'ADMIN' | 'PLAYER' | 'VIEWER') => Promise<void>;
  signOut: () => void;
  updateDisplayName: (newName: string) => void;
  updateBirthday: (birthday: string) => Promise<void>;
  updatePosition: (position: PlayerPosition | '') => Promise<void>;
  isReadOnly: boolean; // Helper to check if user is in read-only mode
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'furiafc_auth_user';
const AUTH_LOGIN_AT_KEY = 'furiafc_auth_login_at';
const AUTH_SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    const loginAt = localStorage.getItem(AUTH_LOGIN_AT_KEY);
    if (storedUser) {
      try {
        const loginTimestamp = loginAt ? Number(loginAt) : 0;
        const isSessionExpired = !loginTimestamp || Date.now() - loginTimestamp > AUTH_SESSION_DURATION_MS;

        if (isSessionExpired) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          localStorage.removeItem(AUTH_LOGIN_AT_KEY);
          setLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error al cargar usuario:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_LOGIN_AT_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      const loginAt = localStorage.getItem(AUTH_LOGIN_AT_KEY);
      const loginTimestamp = loginAt ? Number(loginAt) : 0;
      const isSessionExpired = !loginTimestamp || Date.now() - loginTimestamp > AUTH_SESSION_DURATION_MS;

      if (isSessionExpired) {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_LOGIN_AT_KEY);
      }
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [user]);

  const signIn = async (email: string, displayName: string, role: 'ADMIN' | 'PLAYER' | 'VIEWER') => {
    const newUser: User = {
      id: email,
      email,
      displayName,
      role
    };
    setUser(newUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    localStorage.setItem(AUTH_LOGIN_AT_KEY, String(Date.now()));

    try {
      await addDoc(collection(db, 'login_logs'), {
        userId: email,
        email,
        displayName,
        role,
        loggedInAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error al registrar login:', error);
    }
  };

  // Helper to check if user is in read-only mode
  const isReadOnly = user?.role === 'VIEWER';

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_LOGIN_AT_KEY);
  };

  const updateDisplayName = async (newName: string) => {
    // Prevent updates for read-only users
    if (isReadOnly) {
      console.warn('Cannot update display name in read-only mode');
      return;
    }

    if (user) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            alias: newName.trim()
          });
        }

        const updatedUser = { ...user, displayName: newName.trim() };
        setUser(updatedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      } catch (error) {
        console.error('Error al actualizar el alias:', error);
        const updatedUser = { ...user, displayName: newName.trim() };
        setUser(updatedUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      }
    }
  };

  const updateBirthday = async (birthday: string) => {
    // Prevent updates for read-only users
    if (isReadOnly) {
      console.warn('Cannot update birthday in read-only mode');
      return;
    }

    if (!user) {
      throw new Error('No hay usuario autenticado');
    }

    try {
      // 1. Actualizar el cumpleaños en la colección users
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', user.email));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        throw new Error('Usuario no encontrado en la base de datos');
      }

      const userDoc = userSnapshot.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        birthday: birthday
      });

      // 2. Buscar eventos de cumpleaños existentes para este usuario
      const eventsRef = collection(db, 'events');
      const birthdayQuery = query(
        eventsRef,
        where('type', '==', 'BIRTHDAY'),
        where('createdBy', '==', user.email)
      );
      const birthdayEventsSnapshot = await getDocs(birthdayQuery);

      // Crear la fecha del cumpleaños para este año o el próximo
      const parts = birthday.split('-').map(Number);
      // Formato MM-DD (sin año)
      const month = parts.length === 2 ? parts[0] : parts[1];
      const day = parts.length === 2 ? parts[1] : parts[2];
      const today = new Date();
      const currentYear = today.getFullYear();
      
      // Crear fecha de cumpleaños para este año
      let birthdayDate = new Date(currentYear, month - 1, day, 0, 0, 0);
      
      // Si el cumpleaños ya pasó este año, programarlo para el próximo año
      if (birthdayDate < today) {
        birthdayDate = new Date(currentYear + 1, month - 1, day, 0, 0, 0);
      }

      const eventTitle = `Cumpleaños de ${user.displayName}`;
      const eventDescription = `¡Feliz cumpleaños a ${user.displayName}! 🎉`;

      if (!birthdayEventsSnapshot.empty) {
        // 3a. Si existe un evento de cumpleaños, actualizarlo
        const birthdayEventDoc = birthdayEventsSnapshot.docs[0];
        await updateDoc(doc(db, 'events', birthdayEventDoc.id), {
          date: Timestamp.fromDate(birthdayDate),
          title: eventTitle,
          description: eventDescription,
          location: '',
        });

        console.log('✅ Evento de cumpleaños actualizado');
      } else {
        // 3b. Si no existe, crear uno nuevo
        await addDoc(collection(db, 'events'), {
          type: 'BIRTHDAY',
          date: Timestamp.fromDate(birthdayDate),
          title: eventTitle,
          description: eventDescription,
          location: '',
          createdBy: user.email,
          createdAt: Timestamp.now(),
          isRecurring: true,
          recurringType: 'yearly',
          originalEventId: null
        });

        console.log('✅ Evento de cumpleaños creado');
      }

      // 4. Actualizar el usuario en el estado local
      const updatedUser = { ...user, birthday };
      setUser(updatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

    } catch (error) {
      console.error('Error al actualizar el cumpleaños:', error);
      throw error;
    }
  };

  const updatePosition = async (position: PlayerPosition | '') => {
    // Prevent updates for read-only users
    if (isReadOnly) {
      console.warn('Cannot update position in read-only mode');
      return;
    }

    if (!user) {
      throw new Error('No hay usuario autenticado');
    }

    if (user.role !== 'PLAYER') {
      throw new Error('Solo los jugadores pueden tener una posición');
    }

    try{
      // Actualizar la posición en la colección users
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', user.email));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        throw new Error('Usuario no encontrado en la base de datos');
      }

      const userDoc = userSnapshot.docs[0];
      
      // Si position está vacío, guardar como undefined
      const positionValue = position === '' ? undefined : position;
      
      await updateDoc(doc(db, 'users', userDoc.id), {
        position: positionValue || null
      });

      // Actualizar el usuario en el estado local
      const updatedUser = { ...user, position: positionValue };
      setUser(updatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

      console.log('✅ Posición actualizada correctamente');
    } catch (error) {
      console.error('Error al actualizar la posición:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateDisplayName, updateBirthday, updatePosition, isReadOnly }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
