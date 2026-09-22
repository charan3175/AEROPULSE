import psycopg2

from database import DATABASE_CONFIG


def setup_database() -> None:
    admin_config = {
        **DATABASE_CONFIG,
        "database": "postgres",
    }

    admin_connection = psycopg2.connect(**admin_config)
    admin_connection.autocommit = True

    try:
        with admin_connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (DATABASE_CONFIG["database"],),
            )
            if cursor.fetchone() is None:
                cursor.execute(
                    f'CREATE DATABASE "{DATABASE_CONFIG["database"]}"'
                )
    finally:
        admin_connection.close()

    connection = psycopg2.connect(**DATABASE_CONFIG)
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS engine_telemetry (
                    id BIGSERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    rpm DOUBLE PRECISION NOT NULL,
                    egt DOUBLE PRECISION NOT NULL,
                    cht DOUBLE PRECISION NOT NULL,
                    oil_pressure DOUBLE PRECISION NOT NULL,
                    oil_temperature DOUBLE PRECISION NOT NULL,
                    vibration DOUBLE PRECISION NOT NULL,
                    fuel_flow DOUBLE PRECISION NOT NULL,
                    throttle DOUBLE PRECISION NOT NULL,
                    fault_mode VARCHAR(100) NOT NULL DEFAULT 'normal'
                )
                """
            )
        connection.commit()
    finally:
        connection.close()


if __name__ == "__main__":
    setup_database()
    print("PostgreSQL database and telemetry table are ready.")