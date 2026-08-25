"""
Seeds the events table to match apps/web/src/lib/data.ts's `events` array —
slug is the join key between the two. Idempotent (upserts by slug).

Run with: .venv/bin/python scripts/seed_events.py
"""

from app.core.db import SessionLocal
from app.models.event import Event, EventAudience

EVENTS = [
    {"slug": "rust-systems-workshop", "title": "Rust Systems Workshop", "capacity": 30, "audience": EventAudience.open_to_all, "fee_kes": 0},
    {"slug": "deploy-night", "title": "Deploy Night: ship your side project", "capacity": 40, "audience": EventAudience.members_only, "fee_kes": 0},
    {"slug": "mut-mini-hackathon", "title": "MUT Mini-Hackathon", "capacity": 5, "audience": EventAudience.open_to_all, "fee_kes": 100},
    {"slug": "cloud-study-group", "title": "Cloud Study Group: week 1", "capacity": None, "audience": EventAudience.members_only, "fee_kes": 0},
    {"slug": "alumni-panel", "title": "Alumni Panel: first job in tech", "capacity": 200, "audience": EventAudience.open_to_all, "fee_kes": 0},
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
