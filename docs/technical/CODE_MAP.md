# Mapa de código de SignLang

## Backend

### Inicio

```text
app/main.py
```

Registra routers y ejecuta `init_db()`.

### Base de datos

```text
app/database.py
app/models/
```

### Autenticación

```text
app/api/auth.py
app/core/security.py
app/core/dependencies.py
app/services/auth_service.py
```

### Reconocimiento de letras

```text
app/services/recognition_service.py
app/services/hybrid_recognition_service.py
```

### Reconocimiento de palabras

```text
app/services/word_recognition_service.py
```

Entrada:

```text
1 x 30 x 192
```

### WebSocket

```text
app/websocket/recognition.py
```

Une cámara/reconocimiento con lenguaje y persistencia.

### Corrección léxica

```text
app/services/dictionary_service.py
app/services/language_service.py
app/services/language_composer.py
```

### Aprendizaje

```text
app/services/learning_context.py
app/services/learning_service.py
app/services/candidate_ranker.py
app/models/learning.py
```

### Qwen

```text
app/services/sentence_corrector_service.py
```

### Práctica

```text
app/api/practice.py
app/services/practice_service.py
app/models/practice.py
```

---

## Frontend

### Entrada

```text
src/main.tsx
src/App.tsx
```

### Traductor

```text
src/pages/Translator.tsx
```

### Práctica

```text
src/pages/Practice.tsx
```

### Estadísticas

```text
src/pages/Statistics.tsx
src/services/statistics.ts
```

### Voz

```text
src/hooks/useSpeechRecognition.ts
src/hooks/useTextToSpeech.ts
src/services/preferences.ts
```

### Features de palabras

```text
src/services/wordVision.ts
```

Debe permanecer alineado con:

```text
ai-training/word_mode/feature_extractor.py
```

---

## Entrenamiento

### Letras estáticas/dinámicas

```text
ai-training/capture_dataset.py
ai-training/capture_dynamic.py
ai-training/training/
ai-training/export/
```

### Palabras completas

```text
ai-training/word_mode/
```

Flujo:

```text
cámara/video
  ↓
feature_extractor.py
  ↓
dataset/*.npz
  ↓
train_word_model.py
  ↓
word_model.onnx
scaler_word.pkl
word_labels.json
```
