# Reporte de limpieza del proyecto

Auditoría realizada sobre `back limpio.zip`.

## Eliminado del paquete limpio

### Residuos generados

```text
frontend/node_modules/
**/__pycache__/
*.pyc
backend/app/ml/language_ranker.joblib
```

Motivo:

- se regeneran,
- no deben versionarse,
- `language_ranker.joblib` contiene estado de aprendizaje local.

### Código/recursos sin uso

```text
backend/app/models/word.py
backend/app/data/word_frequency.json
backend/app/ai/models/hand_landmarker.task
frontend/public/icons.svg
frontend/src/assets/hero.png
frontend/src/assets/react.svg
frontend/src/assets/vite.svg
frontend/src/styles/responsive.css
requirements.txt                    (raíz)
```

Motivo:

- `Word` solo se importaba para crear `words`; ningún servicio lo consultaba.
- `word_frequency.json` no tenía ninguna referencia.
- el backend recibe landmarks; no usa `hand_landmarker.task`.
- el frontend usa `frontend/public/hand_landmarker.task`.
- los assets y `responsive.css` indicados no tenían referencias en React/HTML.
- el `requirements.txt` raíz era una lista antigua; la instalación real se
  hace desde `backend/requirements.txt` y requisitos de `ai-training`.

### Prototipos reemplazados por `word_mode`

```text
ai-training/capture_words.py
ai-training/capture_two_hands.py
ai-training/training/train_two_hand.py
```

El pipeline activo para palabras es:

```text
ai-training/word_mode/
```

que ya usa dos manos + pose, cámara/video, 30x192 y exportación ONNX.

---

## Se conserva aunque no sea runtime

Los siguientes archivos son herramientas válidas de entrenamiento/diagnóstico:

```text
ai-training/augment.py
ai-training/comparar_landmarks.py
ai-training/listar_camaras.py
ai-training/normalizar_dataset.py
ai-training/verificar_dataset.py
ai-training/training/*
ai-training/export/export_onnx.py
```

No los usa FastAPI al arrancar, pero sí forman parte del mantenimiento de
modelos.

---

## Datos locales preservados

El paquete limpio conserva las muestras existentes bajo:

```text
ai-training/word_mode/dataset/
```

porque son datos de entrenamiento valiosos del usuario.

El `.gitignore` se actualizó para que nuevas muestras no se suban por accidente.

También se conserva `word_model.pt` en el ZIP de trabajo porque permite
re-exportar el modelo actual, aunque ahora queda ignorado por Git.

---

## Duplicados de MediaPipe

Se conservan:

```text
frontend/public/hand_landmarker.task
ai-training/hand_landmarker.task
ai-training/word_mode/models/*
```

porque pertenecen a superficies distintas:

- frontend runtime,
- entrenamiento estático/dinámico,
- entrenamiento word_mode.

Se eliminó únicamente:

```text
backend/app/ai/models/hand_landmarker.task
```

porque el backend no lo abre.

---

## Rutas REST duplicadas

Existen endpoints de aprendizaje bajo:

```text
/api/learning/*
/api/language/learning/*
```

Son funcionalmente redundantes. Se mantuvieron temporalmente para no romper
clientes existentes. La ruta recomendada es:

```text
/api/learning/*
```

En una versión mayor puede retirarse el alias de `/api/language/learning/*`.
