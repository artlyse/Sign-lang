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

## Rediseño visual (UI refresh)

- Iconos `lucide-react` en Sidebar, Header, Dashboard, Estadísticas, Plantillas y Login/Registro.
- Login y Registro con panel ilustrado: mano con los 21 landmarks de MediaPipe animada, chips de "seña detectada", mostrar/ocultar contraseña.
- Dashboard: banner de bienvenida con saludo, tarjetas de colores, accesos rápidos y ranking con barras.
- Plantillas: buscador, filtros por categoría, más plantillas, botones Escuchar (TTS) y Copiar.
- Estilos nuevos en `src/styles/ui-refresh.css` (con modo oscuro y responsive).
- Nuevos componentes: `HandIllustration.tsx`, `AuthShowcase.tsx`.

## Funcionalidad conectada al backend (v2)

- Login/Registro con diseño sobrio (ilustración plana, sin efectos).
- Práctica: guarda landmarks como datos de entrenamiento, botón "Mi seña era correcta",
  panel "Tu modelo personal" (letras aprendidas, exportar al dataset, borrar muestras).
- Traductor y Práctica muestran cuando el modelo personal ajustó la predicción.
- Plantillas: CRUD real en `/api/templates` (crear, editar, favoritas, eliminar, contador de uso).
- Dashboard: nivel de práctica, modelo personal y aprendizaje del corrector desde el backend.
- Configuración: preferencias sincronizadas con `/api/users/me/preferences`.
- Ver `docs/technical/PRACTICA_ENTRENAMIENTO.md`.
