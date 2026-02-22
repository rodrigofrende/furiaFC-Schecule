import { collection, getDocs, query, where, addDoc, updateDoc, doc, Timestamp, type DocumentData } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserRole } from '../types';

export interface FirestoreUserRecord {
  id: string;
  email: string;
  alias: string;
  role: UserRole;
  position?: string;
  createdAt?: Date;
}

export const getUsers = async (): Promise<FirestoreUserRecord[]> => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);

  return snapshot.docs.map((userDoc) => {
    const data = userDoc.data();
    return {
      id: userDoc.id,
      email: data.email || '',
      alias: data.alias || '',
      role: (data.role || 'PLAYER') as UserRole,
      position: data.position || undefined,
      createdAt: data.createdAt?.toDate?.()
    };
  });
};

export const findUserByEmail = async (email: string): Promise<(DocumentData & { id: string }) | null> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email.toLowerCase()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const userDoc = querySnapshot.docs[0];
  return { id: userDoc.id, ...userDoc.data() };
};

export const createUser = async (payload: { email: string; alias: string; role: UserRole }) => {
  await addDoc(collection(db, 'users'), {
    email: payload.email.trim(),
    alias: payload.alias.trim(),
    role: payload.role,
    createdAt: Timestamp.now()
  });
};

export const editUser = async (id: string, payload: { email: string; alias: string; role: UserRole }) => {
  await updateDoc(doc(db, 'users', id), {
    email: payload.email.trim(),
    alias: payload.alias.trim(),
    role: payload.role
  });
};
