# 🔧 Guía de Troubleshooting - Problemas de Guardado

## Problema: Los cambios no se guardan en la base de datos

### Paso 1: Verificar la configuración de Firebase

Abre la consola del navegador (F12) y ejecuta:

```javascript
window.firebaseDebug.checkConfig()
```

Esto verificará que todas las variables de entorno estén configuradas correctamente.

### Paso 2: Probar permisos de escritura

En la consola del navegador, ejecuta:

```javascript
await window.firebaseDebug.testWrite()
```

Esto probará si puedes leer datos de Firebase. Si falla, verás un error específico.

### Paso 3: Verificar las reglas de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** > **Rules**
4. Las reglas deben verse así:

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

⚠️ **IMPORTANTE**: Estas reglas permiten acceso completo y solo deben usarse en desarrollo. Para producción, necesitas reglas más estrictas.

### Paso 4: Verificar índices de Firestore

Algunos queries requieren índices. Si ves un error sobre "missing index", sigue el enlace en el error para crear el índice automáticamente.

### Paso 5: Revisar errores en la consola

Con las mejoras implementadas, ahora verás mensajes de error más detallados:

- 🔒 **Error de permisos**: Las reglas de Firebase están bloqueando la operación
- 🌐 **No disponible**: Problema de conexión a internet
- 📄 **No encontrado**: El documento que intentas actualizar no existe
- 🔑 **API Key inválida**: Verifica tu archivo .env

## Errores Comunes y Soluciones

### Error: "permission-denied"

**Causa**: Las reglas de Firestore no permiten la operación.

**Solución**:
1. Ve a Firebase Console > Firestore > Rules
2. Cambia las reglas al modo de desarrollo (ver arriba)
3. Publica las reglas

### Error: "unavailable"

**Causa**: No se puede conectar a Firebase.

**Solución**:
1. Verifica tu conexión a internet
2. Verifica que Firebase no esté en mantenimiento
3. Comprueba que el `projectId` en tu `.env` sea correcto

### Error: Los datos no se actualizan en la interfaz

**Causa**: La función `loadMatches()` o similar no se está ejecutando después de guardar.

**Solución**: Este problema ya fue corregido en las últimas mejoras. Si persiste, recarga la página (F5).

## Mejoras Implementadas

### 1. Corrección de la lógica de estadísticas
- **Antes**: Las estadísticas solo se incrementaban al crear un nuevo resultado, no al editarlo
- **Ahora**: Al editar, se calcula la diferencia entre los goles/asistencias antiguos y nuevos

### 2. Mejor manejo de errores
- **Antes**: Errores genéricos sin detalles
- **Ahora**: Mensajes específicos según el tipo de error de Firebase

### 3. Herramientas de debugging
- **Nuevo**: `window.firebaseDebug.testWrite()` - Prueba la conexión
- **Nuevo**: `window.firebaseDebug.checkConfig()` - Verifica configuración

## Cómo usar las herramientas de debugging

1. Abre la aplicación en el navegador
2. Abre la consola (F12 > Console)
3. Ejecuta los comandos de debugging:

```javascript
// Verificar configuración
window.firebaseDebug.checkConfig()

// Probar conexión y permisos
await window.firebaseDebug.testWrite()
```

## Reporte de errores mejorado

Ahora cuando algo falle al guardar:
1. Verás una alerta con un mensaje específico
2. En la consola verás detalles completos del error
3. Si es un error de permisos, verás una sugerencia de solución

## Próximos pasos

Si después de seguir estos pasos el problema persiste:

1. Abre la consola del navegador (F12)
2. Intenta hacer la operación que falla
3. Copia el error completo que aparece en la consola
4. Comparte el error para obtener ayuda más específica

