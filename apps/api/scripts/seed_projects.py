"""
Seeds the projects table from the club's real GitHub repos and immediately
syncs each one's metadata (description, language, topics, good-first-issues)
straight from the API. Idempotent (upserts by slug). Requires GITHUB_ORG and
GITHUB_SYNC_TOKEN to already be set in .env.

Run with: .venv/bin/python scripts/seed_projects.py
"""

import re

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.project import Project
from app.services import github as github_service

settings = get_settings()

SMALL_WORDS = {"and", "of", "the", "in", "for", "to", "a", "an"}

# repo_name -> display name override, for the couple of repos whose real
# GitHub name reads badly as a public project title (see chat: user picked
# this one as "least empty" among four similarly-named repos).
DISPLAY_OVERRIDES = {
    "Final-Extended-Reality-Project-Trainings": "Extended Reality Training",
}

REPOS = [
    "Final-Extended-Reality-Project-Trainings",
    "past_lens",
    "butterfly_eye",
    "OriginFest2025",
    "AI_and_Robotics_Sessions",
    "Animals_That_Destrory_Farm_AI_Project",
    "CommunityManagementTools",
]


def _prettify(repo_name: str) -> str:
    name = re.sub(r"[_\-]+", " ", repo_name.rstrip("-"))
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)
    name = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", name)
    words = re.sub(r"\s+", " ", name).strip().split()
    out = []
    for i, w in enumerate(words):
        if w.isupper() and len(w) <= 4:
            out.append(w)
        elif i > 0 and w.lower() in SMALL_WORDS:
            out.append(w.lower())
        else:
            out.append(w.capitalize())
    return " ".join(out)


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> None:
    if not settings.github_org or not settings.github_sync_token:
        raise SystemExit("GITHUB_ORG and GITHUB_SYNC_TOKEN must be set in .env before seeding projects")

    db = SessionLocal()
    for repo_name in REPOS:
        display_name = DISPLAY_OVERRIDES.get(repo_name, _prettify(repo_name))
        slug = _slugify(display_name)

        project = db.query(Project).filter(Project.slug == slug).first()
        if not project:
            project = Project(
                slug=slug, name=display_name, repo_owner=settings.github_org, repo_name=repo_name
            )
            db.add(project)
            db.flush()
        else:
            project.name = display_name
            project.repo_owner = settings.github_org
            project.repo_name = repo_name

        github_service.sync_project(db, project)
        status = "synced" if project.synced_at else "added (sync failed — check token/permissions)"
        print(f"{slug}: {status}")

    db.commit()
    print(f"Seeded {len(REPOS)} projects.")


if __name__ == "__main__":
    main()
