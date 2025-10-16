import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Probando conexión a Firebase...');
    
    const testCollection = collection(db, 'test');
    await getDocs(testCollection);
    
    console.log('✅ Firebase conectado correctamente!');
    
    return {
      success: true,
      message: 'Firebase conectado correctamente'
    };
  } catch (error: any) {
    console.error('❌ Error al conectar con Firebase:', error);
    
    if (error.code === 'permission-denied') {
      console.error('🔒 Error de permisos. Configurá las reglas de Firestore.');
    } else if (error.code === 'unavailable') {
      console.error('🌐 No se puede conectar a Firebase.');
    } else if (error.message?.includes('API key')) {
      console.error('🔑 API Key inválida.');
    }
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

if (typeof window !== 'undefined') {
  (window as any).testFirebaseConnection = testFirebaseConnection;
}

