"""
Seeds the events table with real display content (previously mirrored from
apps/web/src/lib/data.ts before the admin event editor existed). Idempotent
(upserts by slug). New events should go through the admin editor instead —
this script only exists to backfill the original launch lineup.

Run with: .venv/bin/python scripts/seed_events.py
"""

from datetime import UTC, datetime, timedelta

from app.core.db import SessionLocal
from app.models.event import Event, EventAudience


def nairobi(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    """The club runs on Africa/Nairobi time (UTC+3, no DST) — build the UTC
    instant for a given Nairobi wall-clock time so displayed times match
    what's actually announced to members."""
    return datetime(year, month, day, hour, minute, tzinfo=UTC) - timedelta(hours=3)


EVENTS = [
    {
        "slug": "rust-systems-workshop",
        "title": "Rust Systems Workshop",
        "capacity": 30,
        "audience": EventAudience.open_to_all,
        "fee_kes": 0,
        "starts_at": nairobi(2026, 8, 29, 17, 0),
        "venue": "Engineering Lab 2",
        "description": "Build systems that actually understand memory. Three hours, one compiler, zero garbage collection.",
        "what_youll_build": (
            "A working key-value store with a write-ahead log — the same shape as the storage engine underneath "
            "Redis, but small enough to finish in one sitting. You leave with code on your GitHub."
        ),
        "schedule": [
            {"time": "17:00", "what": "Setup & why Rust exists"},
            {"time": "17:30", "what": "Ownership, borrowing, lifetimes"},
            {"time": "18:15", "what": "Build: append-only log"},
            {"time": "19:15", "what": "Build: index & recovery"},
            {"time": "20:00", "what": "Demos + pizza"},
        ],
        "speaker_name": "Kevin Mwangi",
        "speaker_meta": "4th year · systems · club lead",
        "requirements": ["A laptop with Rust installed", "Comfort with any one language", "Active club membership"],
        "who_should_attend": (
            "Anyone who has written a program and wondered where the memory went. Intermediate — you don't need "
            "Rust experience."
        ),
    },
    {
        "slug": "deploy-night",
        "title": "Deploy Night: ship your side project",
        "capacity": 40,
        "audience": EventAudience.members_only,
        "fee_kes": 0,
        "starts_at": nairobi(2026, 9, 2, 18, 30),
        "venue": "Innovation Hub",
        "description": "Bring whatever you've been building and get it live before you leave.",
    },
    {
        "slug": "mut-mini-hackathon",
        "title": "MUT Mini-Hackathon",
        "capacity": 5,
        "audience": EventAudience.open_to_all,
        "fee_kes": 100,
        "starts_at": nairobi(2026, 9, 6, 9, 0),
        "venue": "Main Lab",
        "description": "A day of building, lunch provided.",
    },
    {
        "slug": "cloud-study-group",
        "title": "Cloud Study Group: week 1",
        "capacity": None,
        "audience": EventAudience.members_only,
        "fee_kes": 0,
        "starts_at": nairobi(2026, 9, 10, 17, 30),
        "venue": "Lab 4",
        "description": "Weekly recurring study group working through cloud fundamentals together.",
    },
    {
        "slug": "alumni-panel",
        "title": "Alumni Panel: first job in tech",
        "capacity": 200,
        "audience": EventAudience.open_to_all,
        "fee_kes": 0,
        "starts_at": nairobi(2026, 9, 19, 16, 0),
        "venue": "Main Hall",
        "description": "Four alumni on how they landed their first role, and what they'd do differently.",
    },
]


def main() -> None:
    db = SessionLocal()
    for row in EVENTS:
        event = db.query(Event).filter(Event.slug == row["slug"]).first()
        if event:
            for key, value in row.items():
                setattr(event, key, value)
        else:
            db.add(Event(**row))
    db.commit()
    print(f"Seeded {len(EVENTS)} events.")


if __name__ == "__main__":
    main()
