from contextlib import closing
from pathlib import Path

from database.db import DATABASE_PATH, get_db_connection


SCHEMA = """
CREATE TABLE IF NOT EXISTS Event (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS Registration (
    registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    registration_date TEXT NOT NULL,
    event_id INTEGER NOT NULL,
    FOREIGN KEY (event_id)
        REFERENCES Event(event_id)
        ON DELETE CASCADE
);
"""

EVENT = (
    1,
    "Charity Fun Run",
    "2026-09-15",
    "Campus Park",
    "An uplifting day of movement and community, raising support for local "
    "projects that make a lasting difference.",
)


def initialize_database(database_path=DATABASE_PATH):
    path = Path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with closing(get_db_connection(path)) as connection:
        connection.executescript(SCHEMA)
        connection.execute(
            """
            INSERT OR IGNORE INTO Event (
                event_id,
                event_name,
                event_date,
                location,
                description
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            EVENT,
        )
        connection.commit()


if __name__ == "__main__":
    initialize_database()
    print("Database initialized successfully.")
