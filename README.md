# Sistema de Reconocimiento de Lengua de Senas en Tiempo Real

Aplicacion web para el reconocimiento de lengua de senas mediante vision por computadora e inteligencia artificial. El sistema captura video desde la camara del navegador, detecta las manos del usuario y clasifica las senas en tiempo real, mostrando el texto reconocido en pantalla.

---

## Tabla de Contenidos

1. [Descripcion](#descripcion)
2. [Tecnologias Utilizadas](#tecnologias-utilizadas)
3. [Arquitectura](#arquitectura)
4. [Requisitos Previos](#requisitos-previos)
5. [Instalacion y Configuracion](#instalacion-y-configuracion)
6. [Ejecucion del Proyecto](#ejecucion-del-proyecto)
7. [Endpoints de la API](#endpoints-de-la-api)
8. [Uso del Sistema](#uso-del-sistema)
9. [Estructura del Proyecto](#estructura-del-proyecto)
10. [Solucion de Problemas](#solucion-de-problemas)
11. [Equipo de Trabajo](#equipo-de-trabajo)

---

## Descripcion

El proyecto consiste en una aplicacion web que permite el reconocimiento de lengua de senas en tiempo real. Utiliza:

- **MediaPipe JS** en el navegador para detectar manos y extraer 21 puntos de referencia (landmarks)
- **WebSocket** para enviar los landmarks al backend en tiempo real
- **ONNX Runtime** para ejecutar los modelos de clasificacion
- **FastAPI** como framework del backend
- **SQLite** como base de datos local
- **React + TypeScript + Vite** como stack del frontend

Actualmente el sistema reconoce:

- **Senas estaticas:** Letras del abecedario A-Z
- **Senas dinamicas:** Letras con movimiento (J, N, Z)

---

## Tecnologias Utilizadas

### Backend
| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| Python | 3.10+ | Lenguaje principal |
| FastAPI | Ultima | Framework web y API REST |
| Uvicorn | Ultima | Servidor ASGI |
| SQLAlchemy | 2.x | ORM para base de datos |
| SQLite | 3.x | Base de datos local |
| ONNX Runtime | Ultima | Inferencia de modelos |
| Scikit-learn | 1.5+ | Carga de scalers |
| NumPy | 2.x | Procesamiento numerico |
| Joblib | Ultima | Serializacion |

### Frontend
| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| Node.js | 18+ | Runtime de JavaScript |
| React | 18+ | Framework de UI |
| TypeScript | 5+ | Tipado estatico |
| Vite | 5+ | Build tool |
| MediaPipe Tasks Vision | Ultima | Deteccion de manos |

### IA / Entrenamiento
| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| PyTorch | 2.x | Entrenamiento de modelos |
| MediaPipe | 2.x | Extraccion de landmarks |
| OpenCV | 4.x | Captura de camara |
| ONNX | Ultima | Formato de modelos |

---

## Arquitectura
#################################
#####
#################################
#####
#####
#####
#################################
#####
#####
#####
#################################


---

## Requisitos Previos

Antes de comenzar, asegurate de tener instalado:

| Herramienta | Version Minima | Verificar con |
|-------------|----------------|---------------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | Cualquiera | `git --version` |
| Camara web | - | - |

---

## Instalacion y Configuracion

### Paso 1: Clonar el repositorio

```bash

git clone https://github.com/artlyse/Sign-lang.git
cd Sign-lang

## Requisitos
Paso 2: Configurar el Backend
cd backend

REM Crear entorno virtual
python -m venv venv

REM Activar entorno virtual (Windows)
venv\Scripts\activate

REM En Linux/Mac:
REM source venv/bin/activate

REM Instalar dependencias
pip install -r requirements.txt

REM Asegurar scikit-learn
pip install scikit-learn

Paso 3: Obtener los modelos ONNX

Los modelos no estan incluidos en el repositorio por su tamano. Debes obtenerlos de una de estas dos formas:

Opcion A: Solicitar los modelos al equipo
Pide los siguientes archivos y colocalos en backend/app/ai/models/:

backend/app/ai/models/
+-- gesture_model.onnx          (modelo MLP para letras estaticas)
+-- lstm_model.onnx             (modelo LSTM para letras dinamicas)
+-- scaler_static.pkl           (normalizador estatico)
+-- scaler_dynamic.pkl          (normalizador dinamico)
+-- hand_landmarker.task        (modelo de MediaPipe)

Opcion B: Generarlos desde cero
Requiere camara web y aproximadamente 1 hora de captura.

REM Volver a la raiz del proyecto
cd ..

REM Instalar dependencias de IA
pip install opencv-python mediapipe numpy torch scikit-learn onnx onnxruntime onnxscript matplotlib seaborn joblib

REM Descargar modelo de MediaPipe
python ai-training/descargar_modelo.py

REM Capturar dataset (seguir instrucciones en pantalla)
python ai-training/capture_dataset.py
python ai-training/capture_dynamic.py

REM Preprocesar
python ai-training/training/preprocess.py
python ai-training/training/preprocess_dynamic.py

REM Entrenar
python ai-training/training/train_mlp.py
python ai-training/training/train_lstm.py

REM Exportar a ONNX (copia automaticamente al backend)
python ai-training/export/export_onnx.py

Paso 4: Configurar el Frontend
cd frontend
npm install

Descargar el modelo de MediaPipe para el navegador:

REM Windows (PowerShell)
Invoke-WebRequest -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -OutFile "public\hand_landmarker.task"



Ejecucion del Proyecto
Necesitas dos terminales abiertas simultaneamente.

Terminal 1: Backend
bash
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
Salida esperada:

text
Modelo estatico cargado: .../gesture_model.onnx
Modelo dinamico cargado: .../lstm_model.onnx
Scaler estatico cargado
Scaler dinamico cargado
Base de datos inicializada
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
Terminal 2: Frontend
bash
cd frontend
npm run dev
Salida esperada:

text
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/



Endpoints de la API
Una vez que el backend este corriendo, puedes acceder a los siguientes endpoints:

Endpoints publicos
Metodo	URL	Descripcion
GET	http://localhost:8000/	Mensaje de bienvenida
GET	http://localhost:8000/health	Estado del servidor
GET	http://localhost:8000/docs	Documentacion Swagger (interactiva)
GET	http://localhost:8000/redoc	Documentacion ReDoc
Endpoints de reconocimiento
Metodo	URL	Descripcion
GET	http://localhost:8000/api/recognition/models	Estado de los modelos cargados
POST	http://localhost:8000/api/recognition/predict-static	Predecir letra estatica
POST	http://localhost:8000/api/recognition/predict-dynamic	Predecir letra dinamica
Endpoints WebSocket
URL	Descripcion
ws://localhost:8000/ws/recognition	Reconocimiento en tiempo real
