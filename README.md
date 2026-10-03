<div align="center">

<img src="https://github.com/user-attachments/assets/a3346609-2afd-4bfd-9302-55afb67b9055" alt="SignLang - Interfaz v0.1" width="420"/>

# SignLang

### Traductor Inteligente de Lengua de Señas mediante
Machine Learning y Visión por Computadora

**Visión por Computadora · Machine Learning · NLP · IA Contextual**

---

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand%20Tracking-0097A7?style=for-the-badge&logo=google&logoColor=white)](https://mediapipe.dev/)
[![ONNX](https://img.shields.io/badge/ONNX-Runtime-005CED?style=for-the-badge&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![Qwen](https://img.shields.io/badge/Qwen-LLM%20Contextual-6E4AFF?style=for-the-badge)](https://github.com/QwenLM)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/WebSockets_API)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-En%20Desarrollo-orange?style=for-the-badge)]()

---

*Sistema web de reconocimiento y traducción de lengua de señas en tiempo real mediante visión por computadora, aprendizaje automático y procesamiento de lenguaje natural.*

</div>

---

## Diseño del Sistema

<div align="center">
<img src="https://github.com/user-attachments/assets/22325a3e-60a8-4b85-b603-4451089098ac" alt="Diseño inicial de SignLang" width="820"/>
</div>

---

## Descripción General

**SignLang** es una aplicación web capaz de **capturar, interpretar y traducir** lengua de señas en tiempo real. Utiliza la cámara del navegador para detectar las manos del usuario, extrae *landmarks* con **MediaPipe**, clasifica señas estáticas y dinámicas mediante modelos **ONNX** y construye palabras y oraciones aplicando un sistema de **corrección léxica y contextual** potenciado por un **LLM (Qwen)**.

>  **Objetivo:** derribar barreras de comunicación entre personas sordas y oyentes mediante una interfaz accesible, precisa y en tiempo real.

---

## Contenido

- [Descripción](#-descripción-general)
- [Características principales](#-características-principales)
- [Arquitectura](#-arquitectura)
- [Tecnologías](#-tecnologías)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Modelos utilizados](#-modelos-utilizados)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración del Backend](#-configuración-del-backend)
- [Configuración del Frontend](#-configuración-del-frontend)
- [Modelo contextual Qwen](#-modelo-contextual-qwen)
- [Ejecución con CPU](#-ejecución-con-cpu)
- [Ejecución con GPU NVIDIA](#-ejecución-con-gpu-nvidia)
- [Base de datos](#-base-de-datos)
- [Sistema de aprendizaje](#-sistema-de-aprendizaje)
- [Reconocimiento de señas](#-reconocimiento-de-señas)
- [Corrección de palabras](#-corrección-de-palabras)
- [Corrección contextual](#-corrección-contextual)
- [Uso de la aplicación](#-uso-de-la-aplicación)
- [API](#-api)
- [WebSocket](#-websocket)
- [Problemas frecuentes](#-problemas-frecuentes)
- [Estado del proyecto](#-estado-del-proyecto)

---

# Descripción

**SignLang** es una aplicación orientada a facilitar la comunicación mediante reconocimiento automático de lengua de señas.

El sistema utiliza la cámara del usuario para detectar la posición y movimiento de la mano. Los landmarks obtenidos mediante MediaPipe son enviados al sistema de reconocimiento, donde diferentes modelos procesan señas estáticas y dinámicas.

Posteriormente, las letras detectadas se convierten en palabras y las palabras son procesadas mediante herramientas lingüísticas para reducir errores producidos por el reconocimiento.

Finalmente, un modelo contextual ligero puede mejorar la estructura completa de la oración.

Ejemplo:

```text
Reconocimiento inicial:

HOLA COMO ESTDN HPY HACX FÑOI
```

Corrección léxica:

```text
HOLA COMO ESTAN HOY HACE FRIO
```

Corrección contextual:

```text
Hola, ¿cómo están? Hoy hace frío.
```

---

# Características principales

- Reconocimiento de señas mediante cámara.
- Detección de manos con MediaPipe.
- Reconocimiento de letras estáticas mediante modelo MLP.
- Reconocimiento de letras dinámicas mediante modelo LSTM.
- Modelos exportados a ONNX.
- Reconocimiento híbrido estático/dinámico.
- Corrección automática de palabras.
- Diccionario español `es_PE`.
- Generación de sugerencias mediante Hunspell.
- Frecuencia léxica mediante `wordfreq`.
- Comparación mediante distancia de Levenshtein.
- Matriz de errores de reconocimiento.
- Aprendizaje personalizado por usuario.
- Corrección contextual mediante Qwen3-0.6B.
- Compatibilidad con CPU.
- Aceleración mediante GPU NVIDIA/CUDA.
- Backend FastAPI.
- Frontend React + TypeScript.
- Comunicación en tiempo real mediante WebSocket.
- Persistencia mediante SQLite y SQLAlchemy.
- Sistema de autenticación de usuarios.
- Access Token y Refresh Token.
- Registro de sesiones y predicciones.

---

# Arquitectura

```text
                         ┌──────────────────┐
                         │      USUARIO     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │      CÁMARA      │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │    MediaPipe     │
                         │ Hand Landmarker  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         21 LANDMARKS X/Y/Z
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
                   ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │ Modelo estático │           │ Modelo dinámico │
          │      MLP        │           │      LSTM       │
          │ gesture_model   │           │   lstm_model    │
          └────────┬────────┘           └────────┬────────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                       RECONOCIMIENTO HÍBRIDO
                                  │
                                  ▼
                           LETRAS ESTABLES
                                  │
                                  ▼
                         CONSTRUCCIÓN PALABRA
                                  │
                                  ▼
              ┌─────────────────────────────────┐
              │       CORRECTOR LÉXICO          │
              │                                 │
              │ Hunspell                        │
              │ wordfreq                        │
              │ Levenshtein                     │
              │ Matriz de confusión             │
              │ Contexto                        │
              │ Aprendizaje personalizado       │
              └────────────────┬────────────────┘
                               │
                               ▼
                       PALABRAS CORREGIDAS
                               │
                               ▼
                    (Instalacion Opcional)
                    ┌─────────────────────┐
                    │     Qwen3-0.6B      │
                    │ Corrección contexto │
                    └──────────┬──────────┘
                               │
                               ▼
                       ORACIÓN CORREGIDA
```

---

# Tecnologías

## Frontend

- React
- TypeScript
- Vite
- MediaPipe Tasks Vision
- WebSocket
- Web Speech API

## Backend

- Python
- FastAPI
- Uvicorn
- SQLAlchemy
- Pydantic
- WebSockets
- ONNX Runtime

## Machine Learning

- scikit-learn
- NumPy
- ONNX
- MLP
- LSTM
- SGDClassifier

## Procesamiento de lenguaje

- Hunspell / spylls
- wordfreq
- RapidFuzz
- Levenshtein
- Bigramas
- Trigramas
- Matriz de confusión

## Inteligencia Artificial contextual

- Qwen3-0.6B
- Transformers
- PyTorch
- Hugging Face Hub
- safetensors

## Persistencia

- SQLite
- SQLAlchemy

---

# Estructura del proyecto

```text
Sign-lang/
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── ai/
│   │   │   └── models/
│   │   │
│   │   ├── api/
│   │   ├── core/
│   │   ├── data/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── websocket/
│   │   │
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   │
│   ├── data/
│   │   ├── app.db
│   │   └── models/
│   │
│   ├── scripts/
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   │
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.ts
│
└── README.md
```

---

# Modelos utilizados

## MediaPipe Hand Landmarker

Ubicación:

```text
frontend/public/hand_landmarker.task
```

Función:

```text
Imagen de cámara
        ↓
MediaPipe
        ↓
21 puntos de la mano
        ↓
X, Y, Z
```

MediaPipe no clasifica las letras del proyecto. Su función es obtener los landmarks utilizados por los modelos entrenados.

---

## Modelo estático

Archivos:

```text
backend/app/ai/models/gesture_model.onnx
backend/app/ai/models/gesture_model.onnx.data
backend/app/ai/models/scaler_static.pkl
```

Modelo utilizado para reconocer señas cuya información principal se encuentra en una postura estática.

Flujo:

```text
63 valores
21 landmarks × X,Y,Z
        ↓
scaler_static.pkl
        ↓
gesture_model.onnx
        ↓
letra
```

---

## Modelo dinámico

Archivos:

```text
backend/app/ai/models/lstm_model.onnx
backend/app/ai/models/lstm_model.onnx.data
backend/app/ai/models/scaler_dynamic.pkl
```

Modelo utilizado para reconocer señas que requieren movimiento.

Actualmente se utiliza especialmente para:

```text
J
Ñ
Z
```

Flujo:

```text
Secuencia temporal
        ↓
scaler_dynamic.pkl
        ↓
lstm_model.onnx
        ↓
J / Ñ / Z
```

---

# Requisitos

## Hardware mínimo

| Componente | Requisito |
|---|---|
| CPU | 4 núcleos |
| RAM | 8 GB |
| Cámara | Webcam 720p |
| Almacenamiento | 5 GB libres |
| Internet | Requerido para instalación inicial |

## Hardware recomendado

| Componente | Recomendación |
|---|---|
| CPU | 6–8 núcleos |
| RAM | 16 GB |
| Cámara | 1080p |
| Almacenamiento | SSD |
| GPU | NVIDIA RTX |
| VRAM | 6 GB o superior |

El uso de GPU es opcional para el reconocimiento principal.

La GPU se utiliza principalmente para acelerar:

```text
Qwen3-0.6B
```

---

# Instalación

## 1. Clonar repositorio

```bash
git clone URL_DEL_REPOSITORIO
```

Ingresar:

```bash
cd Sign-lang
```

---

# Configuración del Backend

Entrar al Backend:

```powershell
cd backend
```

Crear entorno virtual:

```powershell
python -m venv venv
```

Activar:

```powershell
venv\Scripts\activate
```

Debe aparecer:

```text
(venv) ...\Sign-lang\backend>
```

Actualizar pip:

```powershell
python -m pip install --upgrade pip
```

Instalar dependencias:

```powershell
python -m pip install -r requirements.txt
```

---

## Iniciar Backend

```powershell
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

Health:

```text
http://127.0.0.1:8000/health
```

---

# Configuración del Frontend

Abrir otra terminal:

```powershell
cd frontend
```

Instalar dependencias:

```powershell
npm install
```

Si existe `package-lock.json` se recomienda:

```powershell
npm ci
```

Ejecutar:

```powershell
npm run dev
```

Abrir:

```text
http://localhost:5173
```

---

# Modelo contextual Qwen

SignLang incorpora:

```text
Qwen3-0.6B
```

como capa de corrección contextual.

No se utiliza:

```text
Ollama
LM Studio
Servidor LLM externo
```

Qwen se ejecuta directamente dentro del Backend mediante:

```text
Transformers
PyTorch
safetensors
```

---

## Descargar Qwen

Desde:

```text
backend/
```

activar:

```powershell
venv\Scripts\activate
```

Ejecutar:

```powershell
python -m scripts.download_qwen_model
```

El modelo se almacena en:

```text
backend/data/models/qwen3-0.6b/
```

Estructura:

```text
qwen3-0.6b/
│
├── config.json
├── generation_config.json
├── tokenizer_config.json
├── tokenizer.json
└── model.safetensors
```

El archivo:

```text
model.safetensors
```

contiene los pesos principales de Qwen.

---

# Ejecución con CPU

Para utilizar Qwen mediante CPU:

```env
SENTENCE_AI_USE_GPU=false
```

Comprobar:

```powershell
python -c "import torch; print(torch.cuda.is_available())"
```

Salida:

```text
False
```

Ejemplo de instalación CPU:

```powershell
python -m pip install torch
```

Funcionamiento:

```text
Qwen
 ↓
CPU
 ↓
Corrección contextual
```

La ejecución mediante CPU funciona, aunque la generación puede ser considerablemente más lenta.

---

# Ejecución con GPU NVIDIA

Para utilizar CUDA:

```env
SENTENCE_AI_USE_GPU=true
```

Primero verificar GPU:

```powershell
nvidia-smi
```

---

## PyTorch CUDA

Si existe PyTorch CPU:

```powershell
python -m pip uninstall torch torchvision torchaudio -y
```

Para una instalación CUDA compatible con el entorno utilizado actualmente:

```powershell
python -m pip install torch --index-url https://download.pytorch.org/whl/cu132
```

Para este proyecto no es obligatorio instalar:

```text
torchvision
torchaudio
```

ya que Qwen es un modelo de texto.

---

## Verificar CUDA

```powershell
python -c "import torch; print('Torch:', torch.__version__); print('CUDA runtime:', torch.version.cuda); print('CUDA disponible:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU'); print('Arquitecturas:', torch.cuda.get_arch_list() if torch.cuda.is_available() else [])"
```

Ejemplo:

```text
Torch: 2.14.1+cu132
CUDA runtime: 13.2
CUDA disponible: True
GPU: NVIDIA GeForce RTX 5060
```

---

## Comprobar uso de GPU

```powershell
nvidia-smi
```

Cuando Qwen está cargado debe aparecer:

```text
python.exe
```

utilizando VRAM.

El Backend mostrará:

```text
dispositivo: cuda
```

y posteriormente:

```text
Corrector contextual listo:
Qwen/Qwen3-0.6B (cuda)
```

---

# Base de datos

SignLang utiliza:

```text
SQLite
```

Archivo:

```text
backend/data/app.db
```

SQLAlchemy administra la conexión y modelos.

Al iniciar FastAPI se ejecuta la creación automática de las tablas faltantes.

Conceptualmente:

```python
Base.metadata.create_all(bind=engine)
```

---

## Tablas principales

```text
users
user_profiles
refresh_tokens
sessions
predictions
learning_events
user_confusions
user_bigrams
user_trigrams
user_word_stats
ranker_training_examples
words
```

Relaciones principales:

```text
users
  │
  ├── user_profiles
  ├── refresh_tokens
  ├── sessions
  │      └── predictions
  │
  ├── learning_events
  ├── user_confusions
  ├── user_bigrams
  ├── user_trigrams
  └── user_word_stats
```

---

## Comprobar base

```powershell
python scripts\check_database.py
```

---

# Sistema de aprendizaje

El corrector puede almacenar patrones propios de cada usuario.

Ejemplo:

```text
Captura:

HBXA
```

Interpretación:

```text
HOLA
```

El sistema puede registrar:

```text
HBXA → HOLA
```

y detectar relaciones como:

```text
B → O
X → L
```

---

## Aprendizaje implícito

Si el sistema genera:

```text
HBXA → HOLA
```

y el usuario continúa escribiendo sin modificar `HOLA`, se puede registrar como evidencia débil.

Ejemplo:

```text
weight = 0.20
```

---

## Aprendizaje explícito

Si el usuario selecciona o corrige directamente una palabra:

```text
weight = 1.0
```

Esto permite distinguir entre:

```text
suposición del sistema
```

y:

```text
confirmación real del usuario
```

---

# Reconocimiento de señas

## Reconocimiento estático

La cámara envía landmarks al Backend.

El sistema no acepta inmediatamente cada resultado.

La letra debe mantenerse estable durante un periodo mínimo.

Ejemplo:

```text
Predicción H
   ↓
¿confianza suficiente?
   ↓
Sí
   ↓
¿estable temporalmente?
   ↓
Sí
   ↓
Agregar H
```

Esto reduce caracteres aleatorios producidos durante movimientos de transición.

---

## Reconocimiento dinámico

Las señas dinámicas utilizan una secuencia de frames.

```text
Frame 1
Frame 2
Frame 3
...
Frame 30
   ↓
LSTM
   ↓
J / Ñ / Z
```

El reconocimiento híbrido permite combinar automáticamente MLP y LSTM.

---

# Corrección de palabras

La corrección utiliza varias fuentes:

```text
Hunspell
+
wordfreq
+
Levenshtein
+
matriz de confusión
+
bigramas
+
trigramas
+
aprendizaje del usuario
+
SGDClassifier
```

Ejemplo:

```text
HBXA
```

Candidatos:

```text
HOLA
HORA
HOJA
```

Después se calcula un score para determinar cuál es la opción más probable.

---

## Palabra original y palabra interpretada

El sistema conserva dos estados diferentes:

```text
raw_word
```

Ejemplo:

```text
HBXA
```

y:

```text
resolved_word
```

Ejemplo:

```text
HOLA
```

Esto permite aprender del error original sin mostrar al usuario permanentemente una palabra incorrecta.

---

# Corrección contextual

Una frase puede ser correcta a nivel de palabras individuales y aun así ser poco natural.

Ejemplo:

```text
hola como estdn hpy hacx fñoi
```

Qwen recibe la oración y produce una versión contextual.

```text
Hola, ¿cómo están? Hoy hace frío.
```

Pipeline:

```text
Reconocimiento
      ↓
Letras
      ↓
Corrector de palabras
      ↓
Oración preliminar
      ↓
Qwen3-0.6B
      ↓
Oración contextual
```

Qwen no se ejecuta:

```text
por frame
```

ni:

```text
por letra
```

Se ejecuta cuando se solicita corregir la oración completa.

Esto evita afectar el rendimiento del reconocimiento en tiempo real.

---

# Uso de la aplicación

## 1. Abrir aplicación

Acceder:

```text
http://localhost:5173
```

---

## 2. Autorizar cámara

El navegador solicitará permiso.

Seleccionar:

```text
Permitir
```

---

## 3. Colocar mano frente a cámara

MediaPipe mostrará los landmarks detectados.

---

## 4. Realizar una seña

El panel mostrará:

```text
Letra
Confianza
Modo de reconocimiento
```

Ejemplo:

```text
H

96.4 %

Estático
```

---

## 5. Construir palabra

```text
H
↓
HO
↓
HOL
↓
HOLA
```

---

## 6. Finalizar palabra

Seleccionar:

```text
Finalizar palabra
```

La palabra se añade a la oración.

---

## 7. Revisar sugerencias

Si existe una posible corrección:

```text
HBXA
```

el sistema puede mostrar:

```text
HOLA
HORA
HOJA
```

---

## 8. Corregir oración completa

Cuando exista una oración:

```text
HOLA COMO ESTDN HPY HACX FÑOI
```

seleccionar:

```text
Corregir oración con IA
```

Resultado:

```text
Hola, ¿cómo están? Hoy hace frío.
```

---

## 9. Limpiar

La interfaz dispone de:

```text
Borrar último
Limpiar
Finalizar palabra
Corregir oración con IA
```

---

# API

FastAPI proporciona documentación interactiva:

```text
http://127.0.0.1:8000/docs
```

Principales grupos:

```text
/api/auth
/api/users
/api/sessions
/api/language
/api/learning
```

---

## Autenticación

Registro:

```text
POST /api/auth/register
```

Login:

```text
POST /api/auth/login
```

Refresh:

```text
POST /api/auth/refresh
```

Logout:

```text
POST /api/auth/logout
```

Usuario actual:

```text
GET /api/auth/me
```

---

# WebSocket

Reconocimiento:

```text
/ws/recognition
```

Con usuario autenticado:

```text
/ws/recognition?token=ACCESS_TOKEN
```

Ejemplo de mensaje:

```json
{
  "mode": "hybrid",
  "landmarks": []
}
```

---

## Corrección contextual

Mensaje:

```json
{
  "mode": "correct_sentence",
  "sentence": "hola como estdn hpy hacx fñoi"
}
```

Respuesta esperada:

```json
{
  "kind": "sentence_correction",
  "sentence_correction": {
    "original": "hola como estdn hpy hacx fñoi",
    "corrected": "Hola, ¿cómo están? Hoy hace frío.",
    "changed": true,
    "model": "Qwen/Qwen3-0.6B",
    "device": "cuda"
  }
}
```

---

# Ejecución diaria

Una vez instalado el proyecto, no es necesario volver a instalar dependencias.

## Terminal 1 — Backend

```powershell
cd backend

venv\Scripts\activate

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Terminal 2 — Frontend

```powershell
cd frontend

npm run dev
```

Abrir:

```text
http://localhost:5173
```

---

# Instalación después de un nuevo Git Clone

```text
git clone
   │
   ├── Backend
   │     │
   │     ├── python -m venv venv
   │     ├── venv\Scripts\activate
   │     ├── pip install -r requirements.txt
   │     ├── instalar PyTorch CUDA si aplica
   │     ├── descargar Qwen
   │     └── iniciar Uvicorn
   │
   └── Frontend
         │
         ├── npm ci
         └── npm run dev
```

Backend:

```powershell
cd backend

python -m venv venv

venv\Scripts\activate

python -m pip install -r requirements.txt
```

Qwen:

```powershell
python -m scripts.download_qwen_model
```

Backend:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend

npm ci

npm run dev
```

---

# Archivos que no deben perderse

## Modelos de reconocimiento

```text
backend/app/ai/models/
├── gesture_model.onnx
├── gesture_model.onnx.data
├── lstm_model.onnx
├── lstm_model.onnx.data
├── scaler_static.pkl
└── scaler_dynamic.pkl
```

## MediaPipe

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
└── model.safetensors
```

## Persistencia

```text
backend/data/app.db
```

Si `app.db` no existe, el sistema puede crear una nueva base de datos.

Sin embargo, se perderán los usuarios y datos aprendidos existentes.

---

# Variables de entorno

Ejemplo de `.env`:

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

IMPLICIT_LEARNING_ENABLED=true
IMPLICIT_LEARNING_WEIGHT=0.20

SENTENCE_AI_ENABLED=true
SENTENCE_AI_MODEL_ID=Qwen/Qwen3-0.6B
SENTENCE_AI_USE_GPU=true
SENTENCE_AI_MAX_NEW_TOKENS=96
```

No subir `.env` al repositorio.

Sí se puede mantener:

```text
.env.example
```

---

# Git Ignore recomendado

No deben subirse:

```gitignore
# Python
venv/
__pycache__/
*.pyc

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

# Cache ML
backend/app/ml/*.joblib

# IDE
.vscode/
.idea/

# Sistema
.DS_Store
Thumbs.db
```

Los modelos ONNX pueden mantenerse en Git únicamente si su tamaño lo permite.

Para modelos grandes se recomienda Git LFS.

---

# Problemas frecuentes

## `uvicorn` no se reconoce

Activar:

```powershell
venv\Scripts\activate
```

y ejecutar:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

---

## `No module named pwdlib`

```powershell
python -m pip install "pwdlib[argon2]" email-validator
```

---

## `No module named app`

Ejecutar scripts como módulo desde:

```text
backend/
```

Ejemplo:

```powershell
python -m scripts.download_qwen_model
```

---

## Qwen utiliza CPU

Comprobar:

```powershell
python -c "import torch; print(torch.__version__); print(torch.version.cuda); print(torch.cuda.is_available())"
```

Si aparece:

```text
2.x.x+cpu
None
False
```

se está utilizando PyTorch CPU.

Instalar CUDA:

```powershell
python -m pip uninstall torch -y
```

```powershell
python -m pip install torch --index-url https://download.pytorch.org/whl/cu132
```

---

## Comprobar GPU

```powershell
python -c "import torch; print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU')"
```

Ejemplo:

```text
NVIDIA GeForce RTX 5060
```

---

## Qwen no carga

Descargar nuevamente:

```powershell
python -m scripts.download_qwen_model
```

Verificar:

```text
backend/data/models/qwen3-0.6b/model.safetensors
```

---

## Backend desconectado

Comprobar que FastAPI esté activo:

```text
http://127.0.0.1:8000/docs
```

Después revisar:

```text
ws://127.0.0.1:8000/ws/recognition
```

---

## Error de versión de scaler

Si aparece:

```text
InconsistentVersionWarning
```

significa que el `StandardScaler` fue guardado con una versión diferente de scikit-learn.

Lo recomendable es mantener la misma versión utilizada durante entrenamiento.

---

# Flujo técnico final

```text
┌─────────────┐
│   CÁMARA    │
└──────┬──────┘
       ▼
┌─────────────┐
│  MEDIAPIPE  │
└──────┬──────┘
       ▼
 LANDMARKS
       │
 ┌─────┴─────┐
 ▼           ▼
MLP         LSTM
 │           │
 └─────┬─────┘
       ▼
 RECONOCIMIENTO
       ▼
 ESTABILIZACIÓN
       ▼
    LETRAS
       ▼
   PALABRAS
       ▼
┌───────────────────┐
│ Hunspell          │
│ wordfreq          │
│ Levenshtein       │
│ matriz errores    │
│ contexto          │
│ aprendizaje       │
└────────┬──────────┘
         ▼
PALABRAS CORREGIDAS
         ▼
   Qwen3-0.6B
    CPU / CUDA
         ▼
 ORACIÓN CONTEXTUAL
         ▼
      USUARIO
```

---

# Estado del proyecto

Actualmente SignLang dispone de:

- Reconocimiento de señas estáticas.
- Reconocimiento de señas dinámicas.
- Reconocimiento híbrido MLP/LSTM.
- Estabilización temporal de letras.
- Corrección de palabras.
- Autocompletado.
- Diccionario español.
- Aprendizaje personalizado.
- Usuarios y autenticación.
- Persistencia SQLite.
- Registro de sesiones.
- Corrección contextual mediante Qwen.
- Ejecución Qwen mediante CPU o GPU NVIDIA.
- Frontend web interactivo.
- Comunicación en tiempo real mediante WebSocket.

---

# Próximas mejoras

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

# Autores

-Chacon Mayta Frans Rooswvelt
-
-

Proyecto desarrollado como parte de una propuesta de Traductor Inteligente de Lengua de Señas mediante
Machine Learning y Visión por Computadora.


## SignLang

**Traductor Inteligente de Lengua de Señas mediante
Machine Learning y Visión por Computadora**
