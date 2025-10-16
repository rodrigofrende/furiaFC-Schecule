# FURIA FC - Gestión de Entrenamientos

Sistema para gestionar asistencias a entrenamientos y partidos.

## Configuración

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Firebase
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilitar Firestore Database en modo "test"
3. Crear archivo `.env` con las credenciales:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
```
4. Configurar reglas de Firestore:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 3. Agregar usuarios en Firebase
Colección `users` con estructura:
```json
{
  "email": "usuario@furiafc.com",
  "admin": true,
  "alias": "Nombre"
}
```

## Uso

- **Contraseña única**: `Furia2026!`
- **Admin**: Puede crear eventos
- **Player**: Solo puede anotarse a eventos

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```