import os
import re
from contextlib import closing
from datetime import datetime, timezone

from flask import Flask, request

from database.db import DATABASE_PATH, get_db_connection
from database.init_db import initialize_database


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_PATTERN = re.compile(r"^[0-9+() .'-]+$")
DEFAULT_ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
}


def create_app(test_config=None):
    app = Flask(__name__)
    configured_origins = os.environ.get("ALLOWED_ORIGINS")
    app.config.from_mapping(
        DATABASE=os.environ.get("DATABASE_PATH", str(DATABASE_PATH)),
        ALLOWED_ORIGINS=(
            {
                origin.strip()
                for origin in configured_origins.split(",")
                if origin.strip()
            }
            if configured_origins
            else DEFAULT_ALLOWED_ORIGINS
        ),
    )

    if test_config:
        app.config.update(test_config)

    initialize_database(app.config["DATABASE"])

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in app.config["ALLOWED_ORIGINS"]:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers["Vary"] = "Origin"
        return response

    @app.get("/")
    def service_info():
        return {
            "service": "Charity Event Registration API",
            "health": "/api/health",
        }

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/event")
    def get_event():
        with closing(get_db_connection(app.config["DATABASE"])) as connection:
            event = connection.execute(
                """
                SELECT
                    Event.event_id,
                    Event.event_name,
                    Event.event_date,
                    Event.location,
                    Event.description,
                    COUNT(Registration.registration_id) AS registration_count
                FROM Event
                LEFT JOIN Registration
                    ON Registration.event_id = Event.event_id
                GROUP BY Event.event_id
                ORDER BY Event.event_id
                LIMIT 1
                """
            ).fetchone()

        if event is None:
            return api_error("Event not found.", 404)

        return {"event": event_to_dict(event)}

    @app.get("/api/registrations")
    def list_registrations():
        with closing(get_db_connection(app.config["DATABASE"])) as connection:
            rows = connection.execute(REGISTRATION_SELECT + """
                ORDER BY Registration.registration_id DESC
                """
            ).fetchall()

        return {
            "registrations": [registration_to_dict(row) for row in rows],
            "count": len(rows),
        }

    @app.post("/api/registrations")
    def create_registration():
        data, errors = validate_registration(request.get_json(silent=True))
        if errors:
            return api_error(
                "Please correct the highlighted fields.",
                422,
                errors,
            )

        with closing(get_db_connection(app.config["DATABASE"])) as connection:
            event = connection.execute(
                "SELECT event_id FROM Event ORDER BY event_id LIMIT 1"
            ).fetchone()
            if event is None:
                return api_error("Event not found.", 404)

            cursor = connection.execute(
                """
                INSERT INTO Registration (
                    participant_name,
                    email,
                    phone,
                    registration_date,
                    event_id
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    data["name"],
                    data["email"],
                    data["phone"],
                    datetime.now(timezone.utc).date().isoformat(),
                    event["event_id"],
                ),
            )
            connection.commit()
            registration = fetch_registration(connection, cursor.lastrowid)

        return {"registration": registration_to_dict(registration)}, 201

    @app.get("/api/registrations/<int:registration_id>")
    def get_registration(registration_id):
        with closing(get_db_connection(app.config["DATABASE"])) as connection:
            registration = fetch_registration(connection, registration_id)

        if registration is None:
            return api_error("Registration not found.", 404)

        return {"registration": registration_to_dict(registration)}

    @app.put("/api/registrations/<int:registration_id>")
    def update_registration(registration_id):
        data, errors = validate_registration(request.get_json(silent=True))
        if errors:
            return api_error(
                "Please correct the highlighted fields.",
                422,
                errors,
            )

        with closing(get_db_connection(app.config["DATABASE"])) as connection:
            existing = fetch_registration(connection, registration_id)
            if existing is None:
                return api_error("Registration not found.", 404)

            connection.execute(
                """
                UPDATE Registration
                SET participant_name = ?, email = ?, phone = ?
                WHERE registration_id = ?
                """,
                (
                    data["name"],
                    data["email"],
                    data["phone"],
                    registration_id,
                ),
            )
            connection.commit()
            registration = fetch_registration(connection, registration_id)

        return {"registration": registration_to_dict(registration)}

    @app.delete("/api/registrations/<int:registration_id>")
    def delete_registration(registration_id):
        with closing(get_db_connection(app.config["DATABASE"])) as connection:
            existing = fetch_registration(connection, registration_id)
            if existing is None:
                return api_error("Registration not found.", 404)

            connection.execute(
                "DELETE FROM Registration WHERE registration_id = ?",
                (registration_id,),
            )
            connection.commit()

        return "", 204

    @app.errorhandler(404)
    def not_found(_error):
        return api_error("The requested resource was not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return api_error("This request method is not allowed.", 405)

    return app


REGISTRATION_SELECT = """
    SELECT
        Registration.registration_id,
        Registration.participant_name,
        Registration.email,
        Registration.phone,
        Registration.registration_date,
        Event.event_id,
        Event.event_name,
        Event.event_date,
        Event.location,
        Event.description
    FROM Registration
    JOIN Event
        ON Registration.event_id = Event.event_id
"""


def fetch_registration(connection, registration_id):
    return connection.execute(
        REGISTRATION_SELECT + """
        WHERE Registration.registration_id = ?
        """,
        (registration_id,),
    ).fetchone()


def event_to_dict(row):
    event = {
        "id": row["event_id"],
        "name": row["event_name"],
        "date": row["event_date"],
        "location": row["location"],
        "description": row["description"],
    }
    if "registration_count" in row.keys():
        event["registrationCount"] = row["registration_count"]
    return event


def registration_to_dict(row):
    return {
        "id": row["registration_id"],
        "name": row["participant_name"],
        "email": row["email"],
        "phone": row["phone"],
        "registeredAt": row["registration_date"],
        "event": event_to_dict(row),
    }


def validate_registration(payload):
    if not isinstance(payload, dict):
        return {}, {"form": "A JSON request body is required."}

    values = {}
    errors = {}

    for field in ("name", "email", "phone"):
        value = payload.get(field, "")
        values[field] = value.strip() if isinstance(value, str) else ""

    values["email"] = values["email"].lower()

    if len(values["name"]) < 2:
        errors["name"] = "Enter a name with at least 2 characters."
    elif len(values["name"]) > 100:
        errors["name"] = "Name must be 100 characters or fewer."

    if not EMAIL_PATTERN.fullmatch(values["email"]):
        errors["email"] = "Enter a valid email address."
    elif len(values["email"]) > 100:
        errors["email"] = "Email must be 100 characters or fewer."

    phone_digits = sum(character.isdigit() for character in values["phone"])
    if (
        not PHONE_PATTERN.fullmatch(values["phone"])
        or phone_digits < 7
        or len(values["phone"]) > 20
    ):
        errors["phone"] = "Enter a valid phone number with at least 7 digits."

    return values, errors


def api_error(message, status, fields=None):
    error = {"message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}, status


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
