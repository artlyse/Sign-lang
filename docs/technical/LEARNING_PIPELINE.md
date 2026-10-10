# Aprendizaje lingüístico de SignLang

## 1. Qué aprende y qué no aprende

Las correcciones del usuario **no reentrenan** `gesture_model.onnx`,
`lstm_model.onnx` ni `word_model.onnx`.

El aprendizaje ocurre después del reconocimiento visual:

```text
Cámara
  ↓
MLP / LSTM
  ↓
Secuencia cruda, por ejemplo: HOL
  ↓
LanguageService
  ├─ similitud ortográfica
  ├─ Hunspell
  ├─ frecuencia general
  ├─ contexto
  ├─ memoria exacta por usuario
  ├─ confusiones aprendidas
  ├─ frecuencia personal
  └─ CandidateRanker SGD
  ↓
HOLA
```

Qwen se ejecuta después, sobre la oración construida.

---

## 2. Problema encontrado en la versión anterior

`HOL -> HOLA` es una **inserción de A**.

La tabla `user_confusions` solo aprende sustituciones de caracteres:

```text
B -> O
X -> L
```

Por eso una corrección `HOL -> HOLA` no generaba ninguna confusión aprendida.

El SGD sí se entrenaba, pero su peso aumenta lentamente:

```text
LANGUAGE_RANKER_MAX_WEIGHT = 0.28
LANGUAGE_RANKER_WARMUP_FEEDBACK = 30
```

Con un solo feedback:

```text
peso SGD ≈ 0.28 × 1/30 = 0.0093 = 0.93 %
```

Prueba controlada del código anterior:

```text
HOL -> HOLA

antes de corregir : score 0.8439
1 corrección      : score 0.8451
2 correcciones    : score 0.8467
```

El aprendizaje existía, pero visualmente era casi imperceptible.

---

## 3. Memoria exacta nueva

Se agregó:

```text
user_corrections
```

que guarda por usuario:

```text
user_id
raw_word
correct_word
weight_sum
occurrences
```

Ejemplo:

```text
1 | HOL | HOLA | 2.0 | 2
```

Esto permite aprender inserciones, borrados y transformaciones completas.

### Comportamiento

Primera corrección:

```text
HOL -> HOLA
```

- HOLA recibe un boost visible.
- No se fuerza todavía una autocorrección de prefijo.

Segunda corrección igual:

```text
HOL -> HOLA
```

- la memoria exacta aumenta,
- HOLA vuelve a subir de score,
- al finalizar `HOL`, el sistema puede autocorregir a `HOLA`.

Prueba controlada con la versión corregida:

```text
antes            : 0.8439
1 corrección     : 0.9471
2 correcciones   : 0.9714
```

Después de 2 correcciones, `_resolve_word()` eligió `HOLA` automáticamente.

Los valores reales pueden variar según Hunspell, wordfreq, contexto y el estado
del ranker del usuario.

---

## 4. Componentes del score

`LanguageService._candidate_metrics()` combina:

```text
similarity
frequency
static_context
learned_context
first_letter_match
exact
dictionary
completion
learned_confusion
learned_correction
personal_word
```

Después, si el SGD ya está entrenado:

```text
final_score =
    (1 - ml_weight) * base_score
    + ml_weight * ml_probability
```

### Memoria exacta

`learned_correction` representa cuánto ha confirmado el usuario exactamente:

```text
HOL -> HOLA
```

### Frecuencia personal

`user_word_stats` ahora sí participa en el score mediante `personal_word`.

Antes esta tabla se actualizaba, pero no se consultaba para ordenar candidatos.

---

## 5. Aprendizaje por usuario vs. global

Son personalizados por usuario:

- `user_corrections`
- `user_confusions`
- `user_bigrams`
- `user_trigrams`
- `user_word_stats`
- `learning_events`

El `CandidateRanker` (`language_ranker.joblib`) sigue siendo un modelo
**global**. Sus ejemplos se almacenan en SQL con `user_id` para auditoría, pero
el SGD mezcla aprendizaje de diferentes usuarios.

Esto no afecta la nueva memoria exacta por usuario, pero es una decisión de
arquitectura importante. Si en el futuro se requiere aislamiento total, el
ranker puede dividirse por `user_id`.

---

## 6. Cómo inspeccionar el score real

Desde `backend`:

```powershell
venv\Scripts\activate
python scripts\check_learning.py HOL --user-id 1
```

Ejemplo de salida:

```text
PALABRA    SCORE   BASE   ML   EXACTA   N   USO   CTX   CONF
HOLA       ...
```

Campos:

- `SCORE`: score final.
- `BASE`: score antes del SGD.
- `ML`: probabilidad del SGD.
- `EXACTA`: memoria exacta raw->correct.
- `N`: número de correcciones exactas.
- `USO`: frecuencia personal.
- `CTX`: contexto aprendido.
- `CONF`: confusión de caracteres aprendida.

El script es de solo lectura.
