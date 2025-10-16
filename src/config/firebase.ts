import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBjtZq55VVSe27_qPUOtbpJA4x34fdZyRU",
  authDomain: "furiafc-schedule.firebaseapp.com",
  projectId: "furiafc-schedule",
  storageBucket: "furiafc-schedule.firebasestorage.app",
  messagingSenderId: "121355664103",
  appId: "1:121355664103:web:c6a5428a84ff3fb2950042",
  measurementId: "G-N2WDTJQZSQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

