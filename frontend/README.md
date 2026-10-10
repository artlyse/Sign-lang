# Sign-lang Frontend

Frontend React + TypeScript + Vite para el sistema Sign-lang.

## Flujo principal

1. `App.tsx` controla autenticación y navegación entre páginas.
2. `services/auth.ts` administra login, registro, refresh token, perfil y conexión con FastAPI.
3. `Translator.tsx` abre cámara, ejecuta MediaPipe HandLandmarker y envía landmarks al WebSocket del backend.
4. El backend devuelve reconocimiento, corrección de palabras, aprendizaje y corrección contextual.
5. `Statistics.tsx` y `Dashboard.tsx` consultan `/api/sessions` y `/api/sessions/{id}/predictions` para mostrar datos reales del usuario.
6. `Settings.tsx` guarda perfil en el backend y preferencias visuales en `localStorage`.

## Variables de entorno

Copia `.env.example` a `.env` si necesitas cambiar las URLs:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws/recognition
```

## Instalar

```bash
npm ci
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```
