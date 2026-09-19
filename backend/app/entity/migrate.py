import logging

from sqlalchemy import Engine, inspect, text

from app.entity.base import Base

logger = logging.getLogger(__name__)


def add_missing_columns(engine: Engine) -> None:
    """Add columns the models have but an older database file lacks (create_all only creates missing tables).

    Only columns that can be added without touching existing rows are handled: nullable ones, and ones with a
    server_default. Anything else needs a manual migration and is reported in the log.
    """
    existing_tables = set(inspect(engine).get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # create_all makes it with every column
        present = {column["name"] for column in inspect(engine).get_columns(table.name)}
        for column in table.columns:
            if column.name in present:
                continue
            if not column.nullable and column.server_default is None:
                logger.error("Column %s.%s is missing and cannot be added automatically", table.name, column.name)
                continue
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column.type.compile(engine.dialect)}'
            if column.server_default is not None:
                ddl += f" DEFAULT {_default_literal(column.server_default.arg)}"
            if not column.nullable:
                ddl += " NOT NULL"
            with engine.begin() as connection:
                connection.execute(text(ddl))
            logger.info("Added column %s.%s to the existing database", table.name, column.name)


def _default_literal(arg) -> str:
    if hasattr(arg, "text"):  # server_default=text("...") is already SQL
        return arg.text
    if isinstance(arg, str):
        return "'" + arg.replace("'", "''") + "'"
    return str(arg)
