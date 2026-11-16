# Práctica como entrenamiento del modelo

## Flujo

1. En **Práctica**, con "Guardar muestras al practicar" activo, el front guarda los
   landmarks (21 puntos × 3) de la mano mientras el reto está activo.
2. Al evaluar, `POST /api/practice/attempt` recibe `samples`:
   - Reto de **letra estática**: hasta 8 tomas de los últimos 1,5 s, etiquetadas con la letra objetivo.
   - Reto de **J, Ñ, Z**: una secuencia de 30 frames (formato del LSTM).
   - Reto de **palabra/frase** (reconocimiento por letras): una toma por cada letra aceptada.
3. Las muestras quedan **verificadas** si el reto fue exitoso. Si falló, el usuario puede
   pulsar *"Mi seña era correcta"* (`POST /api/training/attempts/{id}/confirm`).
4. **Modelo personal (aprende al instante):** las muestras estáticas verificadas forman
   un k-NN por usuario que se combina con el MLP en el WebSocket (`HybridRecognitionSession`).
   Una letra empieza a influir con ≥ 3 muestras verificadas. Cuando cambia la predicción,
   el front muestra *"Ajustado por tu modelo"*.
5. **Corrector de palabras:** en retos de palabra/frase, los pares reconocido → objetivo
   se registran en el aprendizaje lingüístico (`source="practice"`).
6. **Reentrenar los modelos ONNX:** *Exportar al dataset* (`POST /api/training/export`)
   escribe `.npy` en `ai-training/dataset/static/<LETRA>/` y `dynamic/<SEÑA>/`, con el mismo
   formato que `capture_dataset.py`. Luego:

```bash
cd ai-training
python training/preprocess.py && python training/train_mlp.py
python training/preprocess_dynamic.py && python training/train_lstm.py
python export/export_onnx.py   # copiar modelos a backend/app/ai/models y reiniciar
```

Si el usuario desactiva *Aprendizaje* en Configuración, no se guardan ni se usan muestras.

## Endpoints nuevos

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/training/stats` | Totales, letras aprendidas, estado del modelo personal |
| GET | `/api/training/samples` | Últimas muestras |
| POST | `/api/training/samples` | Guardar muestras manuales |
| POST | `/api/training/attempts/{id}/confirm` | Verificar muestras de un intento fallido |
| POST | `/api/training/export` | Escribir `.npy` en el dataset |
| DELETE | `/api/training/samples?label=A` | Borrar muestras (todas o de una letra) |
| GET/POST/PATCH/DELETE | `/api/templates[/{id}]`, `POST /api/templates/{id}/use` | Plantillas del usuario |
| GET/PUT | `/api/users/me/preferences` | Tema, voz y landmarks sincronizados |

## Tablas nuevas

`training_samples`, `user_templates`, `user_preferences` (las crea `init_db`; no modifican tablas existentes).

## Variables `.env` opcionales

`TRAINING_DATASET_DIR`, `PERSONAL_MIN_SAMPLES_PER_LABEL` (3), `PERSONAL_MAX_WEIGHT` (0.55),
`PERSONAL_KNN_K` (7), `PERSONAL_MAX_DISTANCE` (0.9).
