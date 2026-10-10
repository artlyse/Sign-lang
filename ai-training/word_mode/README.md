# SignLang - Entrenamiento del modo Palabra

Este módulo utiliza **el mismo `backend/venv` y la misma versión de Python** del proyecto. No crea un segundo entorno y `requirements.txt` no incluye `torch`, por lo que no reemplaza tu PyTorch con CUDA.

## Qué aprende

Cada muestra es una secuencia de **30 frames**. Cada frame contiene **192 características**:

- mano izquierda: 21 landmarks XYZ normalizados + posición global de muñeca = 66;
- mano derecha: 21 landmarks XYZ normalizados + posición global de muñeca = 66;
- pose superior: nariz, hombros, codos, muñecas, puntos de manos/cadera (15 landmarks) con XYZ + visibilidad = 60.

Total: `66 + 66 + 60 = 192`.

El modelo aprende el movimiento completo de una seña de palabra, por lo que sirve para señas de una o dos manos y desplazamientos de brazos.

## Instalación, una sola vez

Desde Windows puedes ejecutar:

```text
instalar_requisitos.bat
```

O manualmente, desde la raíz del proyecto:

```powershell
backend\venv\Scripts\activate
python -m pip install -r ai-training\word_mode\requirements.txt
```

## Uso simple

Ejecuta:

```text
iniciar_entrenamiento.bat
```

O:

```powershell
backend\venv\Scripts\python.exe ai-training\word_mode\menu.py
```

El menú permite:

1. Capturar muestras con cámara.
2. Importar uno o varios videos de la misma palabra.
3. Entrenar y exportar el modelo.

### Captura por cámara

Escribe una etiqueta, por ejemplo `HOLA`, selecciona el índice de cámara y la cantidad de muestras. Pulsa **ESPACIO** para grabar cada repetición de aproximadamente 2 segundos.

Para un prototipo usa al menos 20 muestras por palabra. Para mejor generalización se recomiendan 30-50 o más, variando ligeramente distancia, velocidad, iluminación y posición.

### Video

Cada clip debe contener principalmente **una ejecución completa** de la misma seña. Puedes seleccionar varios videos de una vez; cada clip genera una muestra.

## Entrenar

Cuando tengas al menos dos palabras y varias muestras por clase, elige `Entrenar y exportar modelo ONNX`.

Se generan directamente:

```text
backend/app/ai/models/word_model.onnx
backend/app/ai/models/scaler_word.pkl
backend/app/ai/models/word_labels.json
```

Además se guarda `word_model.pt` aquí como checkpoint de entrenamiento.

Si `torch.cuda.is_available()` es `True`, el entrenamiento usa tu GPU NVIDIA automáticamente. La inferencia web/backend usa el ONNX exportado.

Después de entrenar, reinicia FastAPI para recargar el modelo.
