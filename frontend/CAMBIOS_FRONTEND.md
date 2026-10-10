# Cambios realizados al frontend

## Cómo funciona

- `App.tsx`: controla autenticación, navegación y estado general del backend.
- `services/auth.ts`: login, registro, refresh token, perfil y URL base de FastAPI.
- `Translator.tsx`: cámara + MediaPipe + WebSocket de reconocimiento.
- `Dashboard.tsx`: resumen real de las últimas sesiones.
- `Statistics.tsx`: estadísticas calculadas desde las sesiones y predicciones del usuario.
- `Settings.tsx`: perfil, aprendizaje y preferencia real de mostrar landmarks.
- `Help.tsx`: instrucciones actualizadas al flujo actual del sistema.

## Mejoras

1. Estadísticas ya no usan valores fijos.
2. Dashboard ya no usa `128`, `24`, `87%` ni rankings demostrativos.
3. Nueva capa `services/statistics.ts` que consulta:
   - `GET /api/sessions`
   - `GET /api/sessions/{id}/predictions`
4. Ranking real de reconocimientos.
5. Confianza promedio real.
6. Conteo de reconocimiento estático/dinámico.
7. Tabla de sesiones recientes.
8. Estado del backend real en el Header mediante `/health`.
9. Si el token deja de ser válido, App vuelve al login en vez de quedar en una sesión rota.
10. `Mostrar landmarks` de Configuración ahora sí afecta el Traductor.
11. Se eliminó el selector local de “Confianza mínima” porque no modificaba el umbral del backend.
12. URLs del backend configurables mediante `.env`.
13. Corregidos imports TypeScript de `FormEvent` en Login y Register.

## Variables de entorno

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws/recognition
```

## Instalación

```bash
npm ci
npm run dev
```

El backend debe estar ejecutándose en el puerto configurado en `VITE_API_URL`.
