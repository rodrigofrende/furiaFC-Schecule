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
3. Configurar reglas de Firestore:
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