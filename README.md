<div align="center">

<img src="https://github.com/user-attachments/assets/a3346609-2afd-4bfd-9302-55afb67b9055" alt="SignLang - Interfaz" width="420"/>

# SignLang

### Traductor Inteligente de Lengua de Señas mediante
### Machine Learning, Visión por Computadora e Inteligencia Artificial


### Equipo

<img width="960" height="480" alt="Equipo SignLang" src="https://github.com/user-attachments/assets/dd25f904-c089-4220-95d4-adadba78929d" />

---

**Visión por Computadora · Machine Learning · NLP · IA Contextual · Accesibilidad**

---

[![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands%20%2B%20Pose-0097A7?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/)
[![ONNX](https://img.shields.io/badge/ONNX-Runtime-005CED?style=for-the-badge&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![Qwen](https://img.shields.io/badge/Qwen3--0.6B-IA%20Contextual-6E4AFF?style=for-the-badge)](https://github.com/QwenLM)
[![SQLite](https://img.shields.io/badge/SQLite-Persistencia-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-En%20Desarrollo-orange?style=for-the-badge)]()

---

*Sistema web de reconocimiento, interpretación, práctica y traducción de lengua de señas en tiempo real mediante visión por computadora, aprendizaje automático, modelos temporales e inteligencia artificial contextual.*

</div>

---

## Contenido

- [Descripción general](#descripción-general)
- [Objetivo del proyecto](#objetivo-del-proyecto)
- [Estado actual](#estado-actual)
- [Características principales](#características-principales)
- [Arquitectura general](#arquitectura-general)
- [Modos de reconocimiento](#modos-de-reconocimiento)
  - [Modo Letras](#modo-letras)
  - [Modo Palabras](#modo-palabras)
- [Reconocimiento de palabras completas](#reconocimiento-de-palabras-completas)
- [Entrenamiento del modelo de palabras](#entrenamiento-del-modelo-de-palabras)
- [Módulo de práctica](#módulo-de-práctica)
- [Corrección léxica y aprendizaje](#corrección-léxica-y-aprendizaje)
- [Corrección contextual con Qwen](#corrección-contextual-con-qwen)
- [Voz y accesibilidad](#voz-y-accesibilidad)
- [Tecnologías y versiones](#tecnologías-y-versiones)
- [Modelos utilizados](#modelos-utilizados)
- [Base de datos](#base-de-datos)
- [API](#api)
- [WebSocket](#websocket)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Organización de ramas Git](#organización-de-ramas-git)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Entrenamiento](#entrenamiento)
- [Ejecución diaria](#ejecución-diaria)
- [Archivos importantes](#archivos-importantes)
- [Git Ignore recomendado](#git-ignore-recomendado)
- [Problemas frecuentes](#problemas-frecuentes)
- [Flujo técnico final](#flujo-técnico-final)
- [Próximas mejoras](#próximas-mejoras)
- [Equipo del proyecto](#equipo-del-proyecto)
- [Historial de diseño](#historial-de-diseño)

---

# Descripción general

**SignLang** es una aplicación web orientada al reconocimiento y traducción de lengua de señas mediante cámara.

El sistema combina:

- visión por computadora;
- landmarks de manos y pose;
- modelos de Machine Learning;
- modelos temporales LSTM;
- inferencia ONNX;
- procesamiento lingüístico;
- aprendizaje personalizado por usuario;
- inteligencia artificial contextual;
- síntesis y reconocimiento de voz;
- práctica gamificada.

La aplicación puede trabajar de dos maneras principales:

<img width="700" height="900" alt="modo_letras_minimalista_animado" src="https://github.com/user-attachments/assets/8a14465f-b211-466b-8371-3bfc47570c0b" />

y:

<img width="760" height="1080" alt="modo_palabras_minimalista_animado" src="https://github.com/user-attachments/assets/9dba5d42-309a-40c8-8b71-9a0ac1e273e9" />

Posteriormente ambos flujos comparten la misma capa lingüística:

<img width="760" height="1180" alt="procesamiento_texto_minimalista_animado" src="https://github.com/user-attachments/assets/dcce422d-b1a0-4ef0-9c8d-344a0a64f335" />

---

# Objetivo del proyecto

El objetivo de SignLang es facilitar la comunicación entre personas que utilizan lengua de señas y personas que no la conocen, utilizando una interfaz accesible capaz de transformar señas detectadas por cámara en texto comprensible.

El proyecto busca:

- reconocer letras estáticas y dinámicas;
- reconocer señas que representan palabras completas;
- utilizar una o dos manos según la seña;
- considerar movimiento de brazos y posición corporal;
- construir palabras y oraciones;
- corregir errores de reconocimiento;
- aprender de las correcciones del usuario;
- mejorar oraciones mediante un modelo contextual local;
- reproducir el texto mediante voz;
- convertir la voz de una persona oyente a texto;
- permitir práctica y medición de precisión.

---

# Estado actual

Actualmente SignLang dispone de:

- reconocimiento de letras estáticas;
- reconocimiento de letras dinámicas;
- reconocimiento híbrido MLP/LSTM;
- reconocimiento de palabras completas mediante LSTM;
- captura simultánea de dos manos;
- detección de pose superior para palabras;
- normalización corporal;
- entrenamiento desde cámara;
- entrenamiento desde videos;
- exportación de modelos a ONNX;
- selector de cámara;
- modo Letras / Palabras en el traductor;
- corrección léxica;
- sugerencias de palabras;
- aprendizaje personalizado;
- memoria de correcciones por usuario;
- bigramas y trigramas;
- ranker ML mediante SGDClassifier;
- corrección contextual mediante Qwen3-0.6B;
- autenticación de usuarios;
- persistencia SQLite;
- sesiones y predicciones;
- módulo de práctica gamificado;
- práctica de letras;
- práctica de palabras;
- práctica de frases generadas por Qwen;
- medición de precisión, confianza y velocidad;
- niveles, XP y rachas;
- Text-to-Speech del navegador;
- Speech-to-Text del navegador;
- lectura automática configurable;
- tema claro, oscuro o del sistema;
- estadísticas derivadas de sesiones reales.

---

# Características principales

## Reconocimiento

- Cámara en tiempo real desde navegador.
- Selector de cámara.
- MediaPipe Hand Landmarker.
- MediaPipe Pose Landmarker para el modo Palabra.
- Detección de hasta dos manos.
- Landmarks tridimensionales `X, Y, Z`.
- Reconocimiento estático mediante MLP.
- Reconocimiento dinámico mediante LSTM.
- Reconocimiento de palabras completas mediante LSTM independiente.
- Estabilización temporal.
- Control de confianza.
- Finalización de gestos.
- Inferencia ONNX en Backend.

## Procesamiento lingüístico

- Hunspell / `spylls` con diccionario `es_PE`.
- `wordfreq`.
- RapidFuzz.
- Damerau-Levenshtein ponderado.
- Matriz de confusiones.
- Bigramas.
- Trigramas.
- Ranking de candidatos.
- `SGDClassifier`.
- Memoria exacta de correcciones por usuario.
- Corrección manual y aprendizaje.
- Reemplazo de palabras ya insertadas.

## Inteligencia artificial

- Qwen3-0.6B.
- Carga mediante Transformers.
- PyTorch.
- `safetensors`.
- CPU o CUDA.
- Corrección contextual de oraciones.
- Generación de frases para práctica.
- No utiliza Ollama.

## Accesibilidad

- Texto reconocido en tiempo real.
- Text-to-Speech.
- Speech-to-Text.
- Configuración de voz.
- Configuración de velocidad.
- Configuración de tono.
- Configuración de volumen.
- Lectura automática.
- Tema claro.
- Tema oscuro.
- Tema del sistema.

---

# Arquitectura general

<img width="1180" height="1420" alt="flujo_completo_reconocimiento_minimalista" src="https://github.com/user-attachments/assets/0c894f13-0f73-4a8c-b668-a00f93f40c0e" />

---

# Modos de reconocimiento

## Modo Letras

El modo Letras mantiene el funcionamiento original del proyecto.

### Letras estáticas

Se procesan con:

```text
21 landmarks
×
X, Y, Z
=
63 características
```

Flujo:

<img width="700" height="1030" alt="reconocimiento_letra_onnx_animado" src="https://github.com/user-attachments/assets/0d1930c6-eb19-4eb2-a186-df583dc57756" />

Para evitar letras accidentales se utilizan:

- confianza mínima;
- estabilidad en varios frames;
- tiempo mínimo de permanencia;
- cooldown;
- bloqueo para letras repetidas hasta retirar la mano.

Configuración principal actual:

```text
LANGUAGE_STATIC_MIN_CONFIDENCE = 0.82
LANGUAGE_STATIC_HOLD_MS = 380
LANGUAGE_STATIC_STABLE_FRAMES = 5
```

### Letras dinámicas

Las letras que necesitan movimiento utilizan un modelo temporal.

Actualmente se emplea principalmente para:

```text
J
Ñ
Z
```

Flujo:

```text
Frames consecutivos
      ↓
StandardScaler
      ↓
lstm_model.onnx
      ↓
Letra dinámica
```

Configuración principal:

```text
HYBRID_DYNAMIC_SAMPLE_FPS = 15
HYBRID_DYNAMIC_CONFIDENCE = 0.80
HYBRID_DYNAMIC_CONFIRMATIONS = 2
LANGUAGE_DYNAMIC_HOLD_MS = 260
```

---

## Modo Palabras

El modo Palabras reconoce una seña completa como una unidad.

Ejemplo:

```text
Seña completa
     ↓
HIJO
```

en lugar de:

```text
H + I + J + O
```

Este modo utiliza:

- mano izquierda;
- mano derecha;
- posición relativa de ambas manos;
- cabeza como referencia parcial;
- hombros;
- codos;
- muñecas;
- torso superior;
- movimiento temporal.

El frontend permite cambiar entre:

```text
[ LETRAS ]   [ PALABRAS ]
```

sin cambiar de aplicación ni de cámara.

---

# Reconocimiento de palabras completas

## Representación de un frame

El vector utilizado por el modelo contiene:

### Mano izquierda

```text
21 landmarks × X,Y,Z = 63
posición global de muñeca = 3
Total = 66
```

### Mano derecha

```text
21 landmarks × X,Y,Z = 63
posición global de muñeca = 3
Total = 66
```

### Pose superior

Se utilizan 15 landmarks seleccionados:

```text
0
11–24
```

Cada punto aporta:

```text
X
Y
Z
visibility
```

Total:

```text
15 × 4 = 60
```

### Vector final

```text
66
+
66
+
60
=
192 características por frame
```

Constantes:

```text
WORD_FEATURE_DIM = 192
WORD_SEQUENCE_FRAMES = 30
```

## Secuencia temporal

Cada palabra se representa mediante:

```text
30 frames
×
192 características
```

Durante captura y reconocimiento se utiliza aproximadamente:

```text
15 FPS
```

por lo que una secuencia completa representa aproximadamente:

```text
2 segundos
```

## Normalización corporal

Para reducir dependencia de la distancia y posición de la persona:

- las manos se normalizan respecto a su muñeca;
- se calcula una escala local de mano;
- la posición global de las muñecas se expresa respecto al cuerpo;
- los hombros se utilizan como referencia de escala corporal;
- la pose se normaliza respecto al centro de los hombros.

Esto permite que el modelo aprenda mejor la geometría del gesto y no solamente coordenadas absolutas de pantalla.

## Finalización del gesto

El sistema no depende únicamente de obtener varias predicciones mientras las manos permanecen visibles.

Cuando termina la seña:

```text
manos visibles
     ↓
secuencia
     ↓
manos desaparecen durante una pausa corta
     ↓
fin de gesto
     ↓
remuestreo a 30 frames
     ↓
inferencia final
```

Esto evita perder una palabra cuando el usuario finaliza el gesto inmediatamente después de completar la secuencia.

## Modelo

El modelo de palabras utiliza:

```text
LSTM
├── input_size = 192
├── hidden_size = 128
├── num_layers = 2
├── dropout = 0.20
└── LayerNorm + Linear
```

Entrenamiento:

```text
PyTorch
```

Inferencia:

```text
ONNX Runtime
```

Salida:

```text
word_model.onnx
scaler_word.pkl
word_labels.json
```

## Etiquetas actuales

El modelo actual contiene:

```text
BIEN
COMO_ESTAS
CON_PERMISO
DE_NADA
GRACIAS
HIJO
HOLA
MAL
NO
PERDON
SI
```

Las etiquetas con `_` se convierten a espacios al mostrarse:

```text
COMO_ESTAS
↓
COMO ESTAS
```

```text
CON_PERMISO
↓
CON PERMISO
```

```text
DE_NADA
↓
DE NADA
```

---

# Entrenamiento del modelo de palabras

La herramienta se encuentra en:

```text
ai-training/word_mode/
```

Estructura principal:

<img width="1223" height="1286" alt="Árbol de proyecto word_mode" src="https://github.com/user-attachments/assets/e459f5b0-8c65-485a-a00c-d8239ce82276" />

## Fuentes de datos

El dataset puede obtenerse de dos maneras.

### Cámara

```text
Usuario
  ↓
realiza seña completa
  ↓
30 frames
  ↓
archivo .npz
```

### Video

```text
.mp4 / .avi / .mov / ...
        ↓
MediaPipe
        ↓
secuencia normalizada
        ↓
archivo .npz
```

Los dos métodos generan el mismo formato de entrenamiento.

## Menú

```text
1. Capturar muestras con CAMARA
2. Importar muestra desde VIDEO
3. Entrenar y exportar modelo ONNX
4. Exportar ultimo word_model.pt a ONNX
5. Salir
```

## Cámara

El capturador:

- detecta cámaras disponibles;
- prueba DirectShow en Windows;
- verifica que la cámara realmente entregue frames;
- permite seleccionar índice;
- muestra preview;
- detecta manos y pose;
- registra una secuencia dinámica completa.

## Entrenamiento

## Estructura visual del módulo de aprendizaje

<div align="center">
<img width="1536" height="1024" alt="Estructura del directorio ai-training" src="https://github.com/user-attachments/assets/8a136193-5578-43ab-9186-59d6006d174f" />
</div>

La estructura anterior corresponde a la organización visual del módulo de entrenamiento. La versión actual amplía este módulo con `word_mode/` para el entrenamiento de señas que representan palabras completas.


```text
dataset
  ↓
train/test split estratificado
  ↓
StandardScaler
  ↓
LSTM PyTorch
  ↓
validación
  ↓
word_model.pt
  ↓
exportación ONNX
  ↓
word_model.onnx
```

El entrenamiento utiliza CUDA automáticamente cuando:

```python
torch.cuda.is_available()
```

es `True`.

La inferencia ONNX del modelo de palabras se ejecuta actualmente con:

```text
CPUExecutionProvider
```

porque el modelo es suficientemente ligero para reconocimiento en tiempo real.

---

# Módulo de práctica

SignLang incluye un módulo gamificado de práctica.

## Tipos de reto

```text
Letra
Palabra
Frase IA
```

## Modos de reconocimiento

```text
Por letras
Por palabras
```

Una palabra puede practicarse:

```text
HOLA
```

por deletreo:

```text
H + O + L + A
```

o mediante su seña completa:

```text
seña HOLA
```

## Dificultad

```text
Inicial
Intermedio
Avanzado
```

## Métricas

Cada intento puede almacenar:

- texto objetivo;
- texto reconocido;
- precisión;
- confianza;
- tiempo;
- XP obtenido;
- éxito;
- fecha.

## Gamificación

Se utilizan:

- XP total;
- nivel;
- racha actual;
- mejor racha;
- precisión;
- velocidad;
- insignias.

## Qwen en práctica

En modo frase:

```text
Qwen3-0.6B
   ↓
genera una frase breve
   ↓
usuario realiza la frase
   ↓
se compara el resultado
```

Si Qwen no está disponible se utilizan frases locales de respaldo.

Endpoints:

```text
GET  /api/practice/challenge
GET  /api/practice/progress
POST /api/practice/attempt
```

---

# Corrección léxica y aprendizaje

Después del reconocimiento, SignLang no muestra siempre la salida cruda directamente.

Ejemplo:

```text
HOL
```

puede convertirse en:

```text
HOLA
```

El sistema combina:

```text
Hunspell
+
wordfreq
+
RapidFuzz
+
Damerau-Levenshtein
+
matriz de confusión
+
bigramas
+
trigramas
+
frecuencia personal
+
memoria de correcciones
+
SGDClassifier
```

## Estado crudo e interpretado

Se mantienen separados:

```text
raw_word
```

y:

```text
resolved_word
```

Ejemplo:

```text
raw_word      = HOL
resolved_word = HOLA
```

Esto permite mostrar una palabra limpia sin perder información necesaria para aprendizaje.

---

## Aprendizaje personalizado

Cuando el usuario corrige:

```text
HOL
↓
HOLA
```

el sistema registra feedback.

El aprendizaje puede influir mediante:

- memoria exacta de corrección;
- confusiones de caracteres;
- frecuencia personal;
- bigramas;
- trigramas;
- ejemplos para el ranker ML.

### Memoria exacta

Se utiliza para errores como:

```text
HOL → HOLA
```

que no necesariamente pueden representarse como una simple sustitución de letra.

Parámetros actuales:

```text
LANGUAGE_EXACT_CORRECTION_BOOST = 0.12
LANGUAGE_EXACT_CORRECTION_AUTO_COUNT = 2
LANGUAGE_PERSONAL_WORD_BOOST = 0.025
```

Comportamiento esperado:

```text
Primera corrección
HOL → HOLA
↓
HOLA obtiene un boost importante
```

```text
Segunda corrección igual
HOL → HOLA
↓
la memoria gana suficiente evidencia
```

y posteriormente puede autocorregirse con mayor seguridad.

### Confusiones

También puede aprender relaciones como:

```text
B → O
X → L
```

para reducir el coste de errores visuales repetitivos.

### Ranker ML

El `SGDClassifier` aprende a ordenar candidatos utilizando características como:

- similitud;
- frecuencia;
- contexto;
- confusiones;
- prefijo;
- sufijo;
- longitud;
- pertenencia al diccionario;
- completado;
- score base.

---

# Corrección contextual con Qwen

SignLang utiliza:

```text
Qwen3-0.6B
```

como capa final de lenguaje.

No se ejecuta por frame.

No se utiliza para reconocer manos.

No reemplaza MLP ni LSTM.

Su función es trabajar cuando ya existe una oración.

Ejemplo:

```text
HOLA COMO ESTAN HOY HACX FÑOI
```

puede convertirse en:

```text
Hola, ¿cómo están? Hoy hace frío.
```

Pipeline:

```text
Reconocimiento
      ↓
Corrector de palabras
      ↓
Oración preliminar
      ↓
Qwen3-0.6B
      ↓
Oración contextual
```

También se utiliza para generar frases del módulo de práctica.

El modelo se carga directamente mediante:

```text
Transformers
PyTorch
safetensors
```

No se utiliza:

```text
Ollama
LM Studio
servidor LLM externo
```

---

# Voz y accesibilidad

## Text-to-Speech

El frontend utiliza:

```text
Web Speech API
speechSynthesis
```

El usuario puede configurar:

- voz;
- velocidad;
- tono;
- volumen.

## Lectura automática

Se puede activar o desactivar.

Cuando está activa existen dos modos.

### Solo palabras nuevas

```text
HOLA
→ lee "HOLA"

COMO
→ lee "COMO"

ESTAS
→ lee "ESTAS"
```

### Lectura corrida

Cada palabra vuelve a leer el mensaje completo.

```text
HOLA
→ "HOLA"

HOLA COMO
→ "HOLA COMO"

HOLA COMO ESTAS
→ "HOLA COMO ESTAS"
```

## Speech-to-Text

La respuesta hablada de una persona puede convertirse a texto mediante la API de reconocimiento de voz disponible en navegadores compatibles.

Esto permite una comunicación en ambos sentidos:

```text
Lengua de señas
→ texto / voz
```

y:

```text
Voz
→ texto
```

---

# Tecnologías y versiones

## Frontend

Versiones definidas actualmente en `frontend/package.json`:

| Tecnología | Versión | Función |
|---|---:|---|
| React | `^19.2.8` | Interfaz |
| React DOM | `^19.2.8` | Renderizado |
| TypeScript | `~6.0.2` | Tipado |
| Vite | `^8.3.0` | Build y desarrollo |
| `@vitejs/plugin-react` | `^6.1.1` | Integración React/Vite |
| `@mediapipe/tasks-vision` | `^1.0.1` | Hands/Pose en navegador |
| oxlint | `^1.81.0` | Lint |

## Backend

El entorno actual del proyecto utiliza Python 3.14.

Dependencias principales declaradas:

| Tecnología | Restricción en proyecto | Función |
|---|---:|---|
| Python | `3.14` entorno utilizado | Backend y entrenamiento |
| FastAPI | sin pin | API |
| Uvicorn | sin pin | Servidor ASGI |
| SQLAlchemy | sin pin | ORM |
| Pydantic | sin pin | Esquemas |
| ONNX Runtime | sin pin | Inferencia |
| NumPy | sin pin | Cálculo |
| scikit-learn | sin pin | Scalers y ranker |
| RapidFuzz | sin pin | Similitud |
| wordfreq | sin pin | Frecuencia léxica |
| spylls | sin pin | Hunspell |
| PyTorch | `>=2.10.0` | LSTM/Qwen |
| Transformers | `>=4.51.0` | Qwen |
| Accelerate | `>=1.0.0` | Ejecución IA |
| safetensors | `>=0.5.0` | Pesos Qwen |
| huggingface-hub | `>=0.34.0` | Descarga/modelos |

> Las librerías marcadas como **sin pin** se instalan desde `backend/requirements.txt`, pero actualmente no tienen una versión exacta fijada.

## Entrenamiento de palabras

`ai-training/word_mode/requirements.txt`:

| Tecnología | Versión mínima |
|---|---:|
| MediaPipe Python | `>=1.1.0` |
| OpenCV contrib | `>=5.0.0.93` |
| ONNX | `>=1.19.0` |

`torch` no se vuelve a declarar en este archivo para evitar reemplazar accidentalmente una instalación CUDA del backend.

---

# Modelos utilizados

## MediaPipe Hand Landmarker

Frontend:

```text
frontend/public/hand_landmarker.task
```

Función:

```text
imagen
  ↓
21 puntos por mano
  ↓
X, Y, Z
```

MediaPipe no decide qué letra o palabra se realizó.

Solo extrae características visuales.

---

## MediaPipe Pose Landmarker

En modo Palabra se utiliza Pose Landmarker para obtener referencias corporales.

Por defecto el frontend puede utilizar:

```text
pose_landmarker_lite.task
```

La URL puede configurarse mediante:

```env
VITE_POSE_MODEL_URL=
```

El frontend utiliza WASM de MediaPipe Tasks Vision.

---

## Modelo estático

Archivos:

```text
backend/app/ai/models/
├── gesture_model.onnx
├── gesture_model.onnx.data
└── scaler_static.pkl
```

Entrada:

```text
[1, 63]
```

Salida:

```text
letra estática
```

---

## Modelo dinámico de letras

Archivos:

```text
backend/app/ai/models/
├── lstm_model.onnx
├── lstm_model.onnx.data
└── scaler_dynamic.pkl
```

Entrada:

```text
secuencia temporal
```

Uso principal:

```text
J / Ñ / Z
```

---

## Modelo de palabras

Archivos:

```text
backend/app/ai/models/
├── word_model.onnx
├── scaler_word.pkl
└── word_labels.json
```

Entrada:

```text
[1, 30, 192]
```

Salida:

```text
palabra / expresión
```

---

## Qwen

Modelo:

```text
Qwen/Qwen3-0.6B
```

Ubicación local:

```text
backend/data/models/qwen3-0.6b/
```

---

# Base de datos

SignLang utiliza:

```text
SQLite
+
SQLAlchemy
```

Archivo local:

```text
backend/data/app.db
```

Al iniciar FastAPI:

```python
Base.metadata.create_all(bind=engine)
```

crea tablas faltantes.

> `create_all()` no sustituye un sistema formal de migraciones. Para cambios estructurales futuros se recomienda Alembic.

## Tablas principales

```text
users
user_profiles
refresh_tokens

sessions
predictions

learning_events
user_corrections
user_confusions
user_bigrams
user_trigrams
user_word_stats
ranker_training_examples

practice_progress
practice_attempts
```

## Relaciones conceptuales

```text
users
 │
 ├── user_profiles
 ├── refresh_tokens
 ├── sessions
 │    └── predictions
 │
 ├── learning_events
 ├── user_corrections
 ├── user_confusions
 ├── user_bigrams
 ├── user_trigrams
 ├── user_word_stats
 ├── ranker_training_examples
 │
 ├── practice_progress
 └── practice_attempts
```

## Comprobación

```powershell
cd backend
venv\Scripts\activate
python scripts\check_database.py
```

Para revisar aprendizaje:

```powershell
python scripts\check_learning.py HOL --user-id 1
```

---

# API

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Autenticación

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

## Usuarios

```text
GET   /api/users/me/profile
PATCH /api/users/me/profile
```

## Reconocimiento

```text
POST /api/recognition/predict-static
POST /api/recognition/predict-dynamic
GET  /api/recognition/models
```

## Lenguaje

```text
GET /api/language/suggest
GET /api/language/lookup
GET /api/language/dictionary-suggest
GET /api/language/learning/stats
GET /api/language/learning/recent
GET /api/language/health
```

## Aprendizaje

```text
GET /api/learning/stats
GET /api/learning/recent
```

## Sesiones

```text
GET /api/sessions
GET /api/sessions/{session_id}/predictions
```

## Práctica

```text
GET  /api/practice/challenge
GET  /api/practice/progress
POST /api/practice/attempt
```

---

# WebSocket

Endpoint:

```text
/ws/recognition
```

Con autenticación opcional:

```text
/ws/recognition?token=ACCESS_TOKEN
```

Modos soportados actualmente:

```text
hybrid
word
word_model_status

static
dynamic

hand_absent
reset

finalize_word
choose_suggestion
replace_sentence_word
correct_last_word
dismiss_learning

backspace_language
clear_language
get_language_state

correct_sentence
ping
```

## Modo Letras

Ejemplo:

```json
{
  "mode": "hybrid",
  "landmarks": []
}
```

## Modo Palabras

Ejemplo conceptual:

```json
{
  "mode": "word",
  "features": [192 valores],
  "timestamp_ms": 123456789
}
```

## Corrección contextual

```json
{
  "mode": "correct_sentence",
  "sentence": "hola como estdn hpy hacx fñoi"
}
```

---

# Estructura del proyecto

<div align="center">
<img width="1312" height="1199" alt="Estructura del proyecto en VS Code" src="https://github.com/user-attachments/assets/078fc453-957f-43c8-9f1f-7d124e1269fd" />
</div>


```text
Sign-lang/
│
├── ai-training/
│   ├── export/
│   ├── training/
│   ├── capture_dataset.py
│   ├── capture_dynamic.py
│   ├── verificar_dataset.py
│   │
│   └── word_mode/
│       ├── collect_camera.py
│       ├── import_video.py
│       ├── feature_extractor.py
│       ├── dataset_utils.py
│       ├── train_word_model.py
│       ├── export_word_model.py
│       ├── menu.py
│       ├── models/
│       └── dataset/
│
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── websocket/
│   │
│   ├── data/
│   ├── scripts/
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── services/
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   └── technical/
│
└── README.md
```

---

# Organización de ramas Git

El repositorio utiliza actualmente:

```text
main
ai-training
backend
frontend
```

## `main`

Contiene la integración completa:

```text
ai-training/
backend/
frontend/
docs/
```

## `ai-training`

Se utiliza para mantener únicamente:

```text
ai-training/
```

## `backend`

Se utiliza para mantener el módulo:

```text
backend/
```

## `frontend`

Se utiliza para mantener:

```text
frontend/
```

La rama `main` funciona como rama de integración del sistema completo.

---

# Instalación

## 1. Clonar repositorio

```powershell
git clone URL_DEL_REPOSITORIO
cd Sign-lang
```

---

## 2. Backend

```powershell
cd backend
```

Crear entorno:

```powershell
python -m venv venv
```

Activar:

```powershell
venv\Scripts\activate
```

Actualizar pip:

```powershell
python -m pip install --upgrade pip
```

Instalar:

```powershell
python -m pip install -r requirements.txt
```

---

## 3. Qwen

Desde `backend/`:

```powershell
python -m scripts.download_qwen_model
```

Se almacena en:

```text
backend/data/models/qwen3-0.6b/
```

---

## 4. Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Abrir:

```text
http://localhost:5173
```

---

# Configuración

Ejemplo `.env`:

```env
APP_NAME=SignLang API
ENVIRONMENT=development
DEBUG=true

SECRET_KEY=CAMBIAR_POR_UNA_CLAVE_SEGURA
ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

WS_REQUIRE_AUTH=false

CORS_ORIGINS=http://localhost:5173

RECOGNITION_INPUT_FPS=30
HYBRID_DYNAMIC_SAMPLE_FPS=15

WORD_SEQUENCE_FRAMES=30
WORD_SAMPLE_FPS=15
WORD_MIN_CONFIDENCE=0.78
WORD_MIN_GESTURE_FRAMES=12
WORD_MAX_GESTURE_FRAMES=90

IMPLICIT_LEARNING_ENABLED=true
IMPLICIT_LEARNING_WEIGHT=0.20

LANGUAGE_EXACT_CORRECTION_BOOST=0.12
LANGUAGE_EXACT_CORRECTION_AUTO_COUNT=2
LANGUAGE_PERSONAL_WORD_BOOST=0.025

SENTENCE_AI_ENABLED=true
SENTENCE_AI_MODEL_ID=Qwen/Qwen3-0.6B
SENTENCE_AI_USE_GPU=true
SENTENCE_AI_MAX_NEW_TOKENS=96
```

Frontend opcional:

```env
VITE_POSE_MODEL_URL=
```

---

# Entrenamiento

## Letras estáticas

Se utilizan los scripts del módulo `ai-training`.

Flujo:

```text
captura
↓
dataset
↓
preprocesamiento
↓
MLP
↓
ONNX
```

## Letras dinámicas

```text
captura secuencial
↓
30 frames
↓
LSTM
↓
ONNX
```

## Palabras completas

Entrar:

```powershell
cd ai-training\word_mode
```

Instalar requerimientos utilizando el mismo entorno del Backend:

```powershell
instalar_requisitos.bat
```

Abrir menú:

```powershell
iniciar_entrenamiento.bat
```

### Capturar

```text
1. Capturar muestras con CAMARA
```

### Importar video

```text
2. Importar muestra desde VIDEO
```

### Entrenar

```text
3. Entrenar y exportar modelo ONNX
```

### Exportar sin reentrenar

```text
4. Exportar ultimo word_model.pt a ONNX
```

Archivos finales:

```text
backend/app/ai/models/
├── word_model.onnx
├── scaler_word.pkl
└── word_labels.json
```

---

# Ejecución con CPU

Qwen:

```env
SENTENCE_AI_USE_GPU=false
```

Verificar:

```powershell
python -c "import torch; print(torch.cuda.is_available())"
```

El reconocimiento ONNX continúa funcionando sin GPU.

---

# Ejecución con GPU NVIDIA

Qwen y entrenamiento PyTorch pueden utilizar CUDA.

Verificar:

```powershell
nvidia-smi
```

y:

```powershell
python -c "import torch; print('Torch:', torch.__version__); print('CUDA runtime:', torch.version.cuda); print('CUDA disponible:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU')"
```

El proyecto no fija una única versión binaria de CUDA para todos los equipos. Debe instalarse una build de PyTorch compatible con la GPU, driver y versión de Python utilizados.

---

# Ejecución diaria

## Backend

```powershell
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Frontend

```powershell
cd frontend
npm run dev
```

Abrir:

```text
http://localhost:5173
```

---

# Archivos importantes

## Modelos

```text
backend/app/ai/models/
├── gesture_model.onnx
├── gesture_model.onnx.data
├── lstm_model.onnx
├── lstm_model.onnx.data
├── word_model.onnx
├── scaler_static.pkl
├── scaler_dynamic.pkl
├── scaler_word.pkl
└── word_labels.json
```

## MediaPipe frontend

```text
frontend/public/hand_landmarker.task
```

## Diccionario

```text
backend/app/data/hunspell/
├── es_PE.aff
└── es_PE.dic
```

## Qwen

```text
backend/data/models/qwen3-0.6b/
```

## Base de datos

```text
backend/data/app.db
```

## Dataset de palabras

```text
ai-training/word_mode/dataset/
```

---

# Git Ignore recomendado

```gitignore
# Python
venv/
__pycache__/
*.pyc
*.pyo

# Node
node_modules/
dist/

# Variables
.env
.env.local

# Base local
backend/data/app.db
backend/data/app.db-wal
backend/data/app.db-shm

# Qwen
backend/data/models/

# Ranker ML local
backend/app/ml/*.joblib

# Modelos/checkpoints temporales de entrenamiento
ai-training/word_mode/word_model.pt

# IDE
.vscode/
.idea/

# Sistema
.DS_Store
Thumbs.db
```

> Los modelos ONNX o datasets grandes pueden gestionarse con Git LFS o mediante almacenamiento externo.

---

# Problemas frecuentes

## `No module named cv2`

```powershell
python -m pip install opencv-contrib-python
```

---

## `Module onnx is not installed`

```powershell
python -m pip install onnx
```

o:

```powershell
ai-training\word_mode\exportar_onnx.bat
```

---

## Cámara no abre en entrenamiento

El capturador del modo Palabra:

- busca cámaras disponibles;
- prueba DirectShow en Windows;
- verifica frames reales.

Si una cámara está ocupada, cerrar:

```text
OBS
NVIDIA Broadcast
Teams
Discord
otros programas de cámara
```

---

## Qwen utiliza CPU

```powershell
python -c "import torch; print(torch.__version__); print(torch.version.cuda); print(torch.cuda.is_available())"
```

---

## Backend desconectado

Comprobar:

```text
http://127.0.0.1:8000/docs
```

---

## Error de scaler

Si aparece:

```text
InconsistentVersionWarning
```

el scaler fue creado con una versión diferente de scikit-learn.

Para reproducibilidad se recomienda entrenar y ejecutar con el mismo entorno.

---

## El modelo de palabras no aparece

Comprobar:

```text
backend/app/ai/models/word_model.onnx
backend/app/ai/models/scaler_word.pkl
backend/app/ai/models/word_labels.json
```

El Backend indicará:

```text
Modelo de palabras aun no entrenado
```

si alguno falta.

---

# Flujo técnico final

<div align="center">
<img width="720" height="1600" alt="Flujo técnico animado de SignLang" src="https://github.com/user-attachments/assets/b4377a11-521c-4201-bd55-1a1dee6ffa4e" />
</div>

> El diagrama visual anterior corresponde al flujo general del proyecto. A continuación se muestra el flujo técnico actualizado, incluyendo el nuevo modo de reconocimiento de palabras completas.


```text
                              CÁMARA
                                │
                     ┌──────────┴──────────┐
                     │                     │
                     ▼                     ▼
                MODO LETRA           MODO PALABRA
                     │                     │
                     ▼                     ▼
              Hand Landmarker       Hands + Pose
                     │                     │
              ┌──────┴──────┐              │
              ▼             ▼              ▼
             MLP           LSTM       30 × 192
          ESTÁTICO       DINÁMICO          │
              │           J/Ñ/Z            ▼
              └──────┬──────┘        LSTM PALABRAS
                     │                     │
                     └──────────┬──────────┘
                                ▼
                         TEXTO RECONOCIDO
                                │
                                ▼
                  ┌──────────────────────────┐
                  │ CORRECTOR LINGÜÍSTICO    │
                  │                          │
                  │ Hunspell                 │
                  │ wordfreq                 │
                  │ RapidFuzz                │
                  │ Levenshtein              │
                  │ matriz de confusión      │
                  │ bigramas / trigramas     │
                  │ memoria del usuario      │
                  │ SGDClassifier            │
                  └────────────┬─────────────┘
                               ▼
                         ORACIÓN BASE
                               │
                               ▼
                          Qwen3-0.6B
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
                  TEXTO                 VOZ
```

---

# Diseño del sistema

<div align="center">
<img width="1898" height="1079" alt="Diseño del sistema SignLang" src="https://github.com/user-attachments/assets/bd5a07b2-6d37-4c59-8c83-a35cde2ee86e" />
</div>

---

# Diseño de EndPoints

<div align="center">
<img width="1013" height="1079" alt="Diseño de EndPoints" src="https://github.com/user-attachments/assets/66228732-7837-4182-9f29-11acd3ee29f5" />
</div>

---

# Próximas mejoras

Las futuras implementaciones definidas actualmente para el proyecto son:

- Ampliación del dataset.
- Mejora del reconocimiento dinámico.
- Entrenamiento con más usuarios.
- Optimización para dispositivos móviles.
- Migración opcional de SQLite a PostgreSQL.
- Implementación de Alembic para migraciones.
- Mejora del panel administrativo.
- Corrección contextual automática por pausas.
- Optimización del modelo contextual mediante cuantización.
- Despliegue del frontend y backend.
- Pruebas multiusuario.
- Evaluación formal de precisión del modelo.

---


# Equipo del proyecto

<div align="center">
<img width="960" height="480" alt="Equipo SignLang" src="https://github.com/user-attachments/assets/dd25f904-c089-4220-95d4-adadba78929d" />
</div>

| Integrante | Participación |
|---|---|
| **Chaco Mayta Frans Rooswvelt** | Integrante del equipo de desarrollo |
| **Mamani Pineda Geremias Levi** | Integrante del equipo de desarrollo |
| **Postigo Chumacero Alvaro Zahid** | Integrante del equipo de desarrollo |

Proyecto desarrollado como propuesta de **Traductor Inteligente de Lengua de Señas mediante Machine Learning, Visión por Computadora e Inteligencia Artificial**.

---


# Historial de diseño

## Diseño del Sistema — Versión inicial

<div align="center">
<img src="https://github.com/user-attachments/assets/22325a3e-60a8-4b85-b603-4451089098ac" alt="Diseño inicial de SignLang" width="820"/>
</div>

---

<div align="center">

**SignLang** · Traductor Inteligente de Lengua de Señas

**Machine Learning · Visión por Computadora · IA Contextual · Accesibilidad**

</div>
