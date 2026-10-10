# Base de datos de SignLang

## Ubicación por defecto

```text
backend/data/app.db
```

Configuración:

```text
DATABASE_URL
```

Si no se define, `config.py` utiliza SQLite local.

SQLite se inicia con:

```text
PRAGMA foreign_keys=ON
PRAGMA journal_mode=WAL
PRAGMA synchronous=NORMAL
```

---

## Tablas activas

| Tabla | Propósito | Se usa |
|---|---|---|
| `users` | cuentas | Sí |
| `user_profiles` | nombre, locale y preferencias de aprendizaje | Sí |
| `refresh_tokens` | refresh tokens hasheados | Sí |
| `sessions` | sesiones del traductor | Sí |
| `predictions` | letras/palabras reconocidas por sesión | Sí |
| `learning_events` | historial de feedback | Sí |
| `user_corrections` | memoria exacta raw -> correct | Sí |
| `user_confusions` | sustituciones de caracteres aprendidas | Sí |
| `user_bigrams` | contexto de dos palabras | Sí |
| `user_trigrams` | contexto de tres palabras | Sí |
| `user_word_stats` | frecuencia personal de palabras | Sí |
| `ranker_training_examples` | auditoría/dataset del SGD | Sí, como auditoría |
| `practice_progress` | XP, nivel y rachas | Sí |
| `practice_attempts` | historial de prácticas | Sí |

La tabla antigua `words` fue retirada del modelo porque ningún servicio actual
la utilizaba.

En una `app.db` creada antes de la limpieza, esa tabla puede seguir físicamente
presente. `create_all()` **no elimina tablas antiguas**.

---

## Relaciones

```text
users
├── user_profiles
├── refresh_tokens
├── sessions
│   └── predictions
├── learning_events
├── user_corrections
├── user_confusions
├── user_bigrams
├── user_trigrams
├── user_word_stats
├── ranker_training_examples
├── practice_progress
└── practice_attempts
```

Los modelos nuevos incorporan `ON DELETE CASCADE` en las relaciones de usuario
y sesión relevantes.

> Importante: SQLite/SQLAlchemy `create_all()` no modifica constraints de una
> base existente. Una BD antigua conserva su esquema anterior hasta aplicar una
> migración.

---

## Auditoría

Ejecutar:

```powershell
cd backend
venv\Scripts\activate
python scripts\check_database.py
```

Comprueba:

- tablas,
- cantidad de filas,
- `PRAGMA integrity_check`,
- `PRAGMA foreign_key_check`,
- huérfanos,
- tablas legado conocidas.

No modifica los datos.

---

## Qué persiste fuera de SQLite

### Modelos visuales

```text
backend/app/ai/models/
```

### Ranker incremental

```text
backend/app/ml/language_ranker.joblib
```

Este archivo es generado localmente y está ignorado por Git.

### Qwen

```text
backend/data/models/qwen3-0.6b/
```

No pertenece a SQLite.

---

## Observaciones de mantenimiento

### `create_all` no es un migrador

Actualmente:

```python
Base.metadata.create_all(...)
```

crea tablas faltantes, pero no:

- agrega columnas a tablas existentes,
- cambia claves foráneas,
- elimina tablas legado,
- renombra columnas.

Para una fase posterior de producción se recomienda Alembic.

### Refresh tokens

Los tokens expirados/revocados permanecen en la tabla hasta que se implemente
una tarea de limpieza. Esto no rompe autenticación, pero puede hacer crecer la
tabla con el tiempo.

### Ranker global

El SGD es global aunque sus ejemplos SQL lleven `user_id`. La memoria exacta y
contextual sí está aislada por usuario.
