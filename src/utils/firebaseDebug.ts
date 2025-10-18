import { db } from '../config/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

/**
 * Utility to test Firebase connection and permissions
 */
export const testFirebaseWrite = async () => {
  try {
    console.log('🔥 Testing Firebase write permissions...');
    
    // Try to read from a collection (should work even with read-only)
    const testQuery = query(collection(db, 'users'), limit(1));
    await getDocs(testQuery);
    
    console.log('✅ Firebase READ working correctly');
    
    return {
      success: true,
      canRead: true,
      message: 'Firebase connection OK'
    };
  } catch (error: any) {
    console.error('❌ Firebase test failed:', error);
    
    let errorDetails = {
      success: false,
      canRead: false,
      code: error.code,
      message: error.message,
      suggestion: ''
    };
    
    if (error.code === 'permission-denied') {
      errorDetails.suggestion = 'Verifica las reglas de seguridad en Firebase Console. Deben permitir lectura/escritura.';
      console.error('🔒 PERMISSION DENIED - Check Firestore Rules');
    } else if (error.code === 'unavailable') {
      errorDetails.suggestion = 'No se puede conectar a Firebase. Verifica tu conexión a internet.';
      console.error('🌐 UNAVAILABLE - Check internet connection');
    } else if (error.message?.includes('API key')) {
      errorDetails.suggestion = 'La API key de Firebase es inválida. Verifica el archivo .env';
      console.error('🔑 INVALID API KEY - Check .env file');
    }
    
    return errorDetails;
  }
};

/**
 * Log detailed information about a Firestore error
 */
export const logFirestoreError = (operation: string, error: any) => {
  console.group(`❌ Firestore Error: ${operation}`);
  console.error('Error Code:', error.code);
  console.error('Error Message:', error.message);
  console.error('Full Error:', error);
  
  if (error.code === 'permission-denied') {
    console.warn('💡 Solución: Verifica las reglas de seguridad en Firebase Console');
    console.warn('Las reglas deben ser algo como:');
    console.warn(`
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if true;
        }
      }
    }
    `);
  }
  
  console.groupEnd();
};

/**
 * Check if Firebase is properly configured
 */
export const checkFirebaseConfig = () => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  
  const missingKeys = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missingKeys.length > 0) {
    console.error('❌ Missing Firebase configuration keys:', missingKeys);
    console.error('💡 Make sure your .env file has all required VITE_FIREBASE_* variables');
    return false;
  }
  
  console.log('✅ Firebase configuration looks good');
  return true;
};

// Make these functions available in the browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).firebaseDebug = {
    testWrite: testFirebaseWrite,
    checkConfig: checkFirebaseConfig
  };
  
  console.log('💡 Debug tools available: window.firebaseDebug.testWrite() and window.firebaseDebug.checkConfig()');
}

