from sqlalchemy import inspect

from app.database import engine, init_db

init_db()
inspector = inspect(engine)
print("Dialect:", engine.dialect.name)
print("Tables:")
for table in sorted(inspector.get_table_names()):
    print(" -", table)
