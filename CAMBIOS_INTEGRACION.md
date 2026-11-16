# Integración Sign-lang — noviembre 2026

Este proyecto une tres versiones:

| Origen | Qué se tomó |
|---|---|
| **Base** (`Sign-lang-main (2).zip`) | Ya estaba contenida completa en la versión mejorada. |
| **Mejorada** (`Sign-lang-main.zip`) | Frontend rediseñado, modelo personal de Práctica, preferencias sincronizadas, imágenes LSP. |
| **Backend nuevo** (`backend (2).zip`) | Registro facial, plantillas por paquetes, muestras de gestos, soporte GPU, corrección por REST y su base de datos. |

## Modelos

- **Letras estáticas (`gesture_model.onnx`)**: se exportó el modelo reentrenado del 12/11
  (`ai-training/models/gesture_model.pt`), que nunca se había exportado. Con el mismo
  pipeline del backend (normalizar → scaler → modelo) acierta **99,7 %** en datos no
  vistos; el modelo anterior (octubre) acertaba **8,7 %**. Se usa su scaler
  (`ai-training/processed/scaler.pkl` → `scaler_static.pkl`).
- El modelo anterior quedó en `ai-training/models/respaldo_oct2026/`.
- LSTM (J, Ñ, Z), modelo de palabras y `hand_landmarker.task`: sin cambios (eran idénticos
  en todas las versiones).
- **Qwen3-0.6B no se incluye** en este zip (1,5 GB). El backend lo descarga solo en
  `backend/data/models/qwen3-0.6b` la primera vez, o con `python scripts/download_qwen_model.py`.

## Reconocimiento con ambas manos

El dataset se capturó con la imagen volteada (modo selfie, `cv2.flip`) y el navegador no la
voltea, por eso el modelo solo reconocía una mano (16 % de acierto con la otra).
Sin reentrenar: el backend (`HybridRecognitionSession`) evalúa cada cuadro con los landmarks
originales y espejados (x → −x) y decide la orientación por **votación de los últimos 24
cuadros** (cambia con ≥ 6 votos y 75 % de mayoría). Resultado con el dataset: ~100 % con
ambas manos. Se puede desactivar con `HAND_MIRROR_AUTO=false` en `backend/.env`.
El LSTM (J, Ñ, Z) usa la misma orientación decidida.

## Base de datos

- `backend/data/app.db`: la del backend nuevo (cuenta `franx`, rostro, aprendizaje del
  corrector, predicciones). Las tablas nuevas se crean solas al arrancar.
- `backend/data/app_respaldo_integrado.db`: la base anterior (cuenta `leviii`).
- El rostro está cifrado con `SECRET_KEY`. La base incluida se cifró con la clave **por
  defecto del código**: no definas `SECRET_KEY` en `.env` (o habrá que registrar los rostros
  de nuevo e iniciar sesión otra vez).
- Tablas biométricas: `face_enrollments` es la que se usa. `face_embeddings` es un resto de
  una versión anterior: ningún código la usa y se puede borrar. `gesture_samples` la usa
  `/api/gestures` (aún sin pantalla en el frontend).

## Traductor

- Layout en una sola pantalla y responsivo: cámara al centro (4:3, se ajusta al alto),
  resultado superpuesto sobre el video; a la derecha la conversación y la respuesta del personal.
- **Conversación como chat**: mensajes finales de la persona y respuestas del personal
  (se agregan al detener el micrófono).
- **"Lo que quieres decir"**: el mensaje final en grande. Usa la corrección con IA si
  corresponde al texto actual; si no, la frase de plantilla o lo señado ordenado
  automáticamente ("HOLA COMO ESTAS" → "Hola, ¿cómo estás?"). Botón **Enviar** lo pasa al chat.
- **Plantilla activa** y frases sugeridas mientras se seña; `{nombre}` se completa con el
  nombre del rostro reconocido (o el de la cuenta). Al tocar una frase reemplaza o completa
  lo señado.
- **Presentarme / reconocimiento automático del rostro** al encender la cámara (4 intentos).
- "EN VIVO" solo con la cámara funcionando; aviso si la IA tarda más de 25 s.

## Plantillas

- Paquetes de frases con disparadores, CRUD persistente en la base (`/api/templates`).
- Se comparten con las demás cuentas por defecto (se puede marcar como privada) y muestran el autor.
- Botón **Usar en el Traductor**; la plantilla activa se guarda en las preferencias de la cuenta.
- Paquetes del sistema reescritos desde el punto de vista de la persona sorda, con `{nombre}`.

## Configuración

- Sección **Reconocimiento facial**: registrar (con consentimiento), ver, actualizar y eliminar,
  con **selector de cámara** (se recuerda la elegida).

## Correcciones

- Errores de validación legibles en español (antes `[object Object]`).
- Textos: "Sing-lang", "Camara", "Microfono".
- Ya no se guardan sesiones vacías (abrir el Traductor sin reconocer nada).
- CORS acepta también `127.0.0.1:5173` y `127.0.0.1:3000`.
- Imagen `Ñ.png` con nombre corregido.
- Registro facial: selector de cámara y vista previa que podía quedar en blanco.

## Backend: endpoints nuevos o cambiados

| Método | Ruta | Uso |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/templates` | Paquetes de frases (`?scope=all\|mine\|shared`) |
| GET/PUT/DELETE | `/api/users/me/face` | Registro facial (`PUT ?consent=true`, multipart `image`) |
| GET | `/api/users/me/face/photo` | Foto registrada |
| POST | `/api/users/me/face/verify` | Verifica el rostro y devuelve `display_name` |
| GET/POST/DELETE | `/api/gestures`, `GET /api/gestures/dataset/export` | Muestras de gestos (imágenes) |
| GET | `/api/recognition/device` | Proveedores ONNX (CUDA/CPU) |
| POST | `/api/language/correct-sentence` | Corrección de oración por REST |
| WS | `mode: "insert_text"` | Inserta texto literal (`keep_case`, `replace`) |

Se mantienen `/api/training/*` (modelo personal de Práctica y exportación al dataset)
y `/api/users/me/preferences`.

## Instalación

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt     # incluye insightface y opencv para el rostro
copy .env.example .env              # y pon tu SECRET_KEY
uvicorn app.main:app --reload
```

```bash
cd frontend
npm ci
npm run dev
```

La primera vez que se registra un rostro, InsightFace descarga su modelo `buffalo_l` (~280 MB).
