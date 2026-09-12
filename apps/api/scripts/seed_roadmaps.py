"""
Seeds the AI & Robotics arm's Semester 1, 2026 roadmap — a beginner-to-
project-based track, Grokking-style: every foundations week ships a small,
fun, concrete project instead of pure lecture, so the "why" lands before
the theory does. New roadmaps should go through the admin editor instead —
this script only exists to backfill the initial plan the arm lead wrote up.

Idempotent: upserts the roadmap by (arm, title), and its milestones by
(roadmap, title). Leaves the roadmap in draft — publish it from
/admin/roadmaps once it's been reviewed.

Run with: .venv/bin/python scripts/seed_roadmaps.py
"""

from app.core.db import SessionLocal
from app.models.arm import Arm
from app.models.roadmap import Roadmap
from app.models.roadmap_milestone import RoadmapMilestone
from app.models.user import User
from app.services import roadmap as roadmap_service

ARM_SLUG = "artificial-intelligence-and-robotics"
SEED_ADMIN_EMAIL = "dev-admin@mut-tech.local"

ROADMAP_TITLE = "Semester 1, 2026"
ROADMAP_GOAL = (
    "Beginner to project-ready in one semester. Weeks 1-6 are fundamentals, but every one of them ships a small, "
    "fun project first — you feel why a concept matters before you get the lecture on it (Grokking-style, not "
    "slide-deck-style). Weeks 7-9 go applied (real frameworks, vision, LLMs). Weeks 10-13 are one team project, "
    "start to Demo Day."
)

MILESTONES = [
    (
        "Week 1 — Kickoff & tooling",
        (
            "**Mini-project:** automate something annoying (bulk-rename files, a quiz game, whatever's actually "
            "useful to you) in `Python`, pushed to `GitHub` from `Colab`. No ML yet — just get fluent with the "
            "tools. **Hook:** computers already save you time without learning anything; wait until they can learn "
            "patterns too."
        ),
    ),
    (
        "Week 2 — Data wrangling (NumPy & pandas)",
        (
            "**Mini-project:** take a dataset you actually care about (club attendance, a football league table, "
            "top songs — your call) and pull 3 fun insights out of it with `pandas`. **Hook:** every model is only "
            "as good as the data you hand it — get good at wrangling before a model ever sees it."
        ),
    ),
    (
        "Week 3 — Vectors & similarity",
        (
            '**Mini-project:** build a tiny "which club member/anime are you most like" matcher using **cosine '
            "similarity** over a few numeric traits. **Hook:** that one trick — comparing vectors — is half of "
            "every recommendation engine and search bar you've ever used."
        ),
    ),
    (
        "Week 4 — Your first model (supervised learning)",
        (
            "**Mini-project:** `logistic regression` on something relatable — spam vs. not-spam texts, or "
            "pass/fail from study hours. Train/test split, accuracy, done. **Hook:** a straight-line boundary "
            "works great... until the data stops being so clean-cut."
        ),
    ),
    (
        "Week 5 — When a line isn't enough",
        (
            "**Mini-project:** the same problem from week 4, but on messier data where logistic regression "
            "struggles — fix it with a `decision tree` or `k-NN`. Bonus: run `k-means` on a quick interest survey "
            "to auto-cluster everyone into project teams for Phase 3. **Hook:** still not 100%? Maybe the pattern "
            "isn't a line *or* a tree boundary."
        ),
    ),
    (
        "Week 6 — Why neural networks (the XOR problem)",
        (
            "**Mini-project:** prove a single-layer model can't solve `XOR`, then hand-build (or code) a tiny "
            "2-layer net that does. This is the actual historical moment that revived neural networks — you're "
            "re-discovering it in an afternoon. **Checkpoint:** a fast, gamified recap quiz on weeks 1-6 before "
            "moving to real frameworks."
        ),
    ),
    (
        "Week 7 — Neural networks for real (PyTorch)",
        (
            "**Mini-project:** a handwritten-digit recognizer (`MNIST`) — bonus points for testing it on your own "
            "handwriting via a phone photo. First taste of a real framework (`PyTorch`) instead of hand-rolled "
            "code."
        ),
    ),
    (
        "Week 8 — Computer vision via transfer learning",
        (
            "**Mini-project:** an image classifier for something you actually care about — campus landmarks, "
            "plant disease, memes, your call — built on a pretrained model (**transfer learning**). Training a "
            "`CNN` from scratch is too slow for a week; transfer learning is the honest, practical version."
        ),
    ),
    (
        "Week 9 — NLP & LLMs in practice",
        (
            "**Mini-project:** a small AI-powered app using an `LLM API` — a club-FAQ chatbot or a text classifier "
            "— plus real prompt-engineering practice. This is the most directly useful week for whatever project "
            "comes next."
        ),
    ),
    (
        "Week 10 — Project kickoff",
        (
            "Teams form (or use the week 5 clustering result), pick a real problem + dataset, write a one-page "
            'proposal: what you\'re building, why, and what "done" looks like by Demo Day.'
        ),
    ),
    (
        "Week 11 — Build week 1",
        (
            "Heads-down build time with mentor office hours. First working (ugly) version should exist by the end "
            "of this week."
        ),
    ),
    (
        "Week 12 — Build week 2",
        (
            "Polish, fix the embarrassing parts, get the demo path solid. No new features after this week — only "
            "make what exists work reliably."
        ),
    ),
    (
        "Week 13 — Demo Day",
        (
            "Showcase to the whole club (invite guest judges if you can). Feedback, wrap-up, and a look back at "
            "week 1's \"automate something annoying\" script — compare how far everyone's come."
        ),
    ),
]


def main() -> None:
    db = SessionLocal()

    admin = db.query(User).filter(User.email == SEED_ADMIN_EMAIL).first()
    if not admin:
        raise SystemExit(
            f"Seed admin '{SEED_ADMIN_EMAIL}' not found — run this against a dev DB that has it."
        )

    arm = db.query(Arm).filter(Arm.slug == ARM_SLUG).first()
    if not arm:
        raise SystemExit(f"Arm '{ARM_SLUG}' not found — seed arms first.")

    roadmap = (
        db.query(Roadmap)
        .filter(Roadmap.arm_id == arm.id, Roadmap.title == ROADMAP_TITLE)
        .first()
    )
    if roadmap:
        roadmap.goal_summary = ROADMAP_GOAL
        db.commit()
    else:
        roadmap = roadmap_service.create_roadmap(
            db,
            admin,
            {"arm_id": arm.id, "title": ROADMAP_TITLE, "goal_summary": ROADMAP_GOAL},
        )

    for title, description in MILESTONES:
        milestone = (
            db.query(RoadmapMilestone)
            .filter(
                RoadmapMilestone.roadmap_id == roadmap.id,
                RoadmapMilestone.title == title,
            )
            .first()
        )
        if milestone:
            milestone.description = description
            db.commit()
        else:
            roadmap_service.create_milestone(
                db, admin, roadmap, {"title": title, "description": description}
            )

    print(
        f"Seeded roadmap '{ROADMAP_TITLE}' for '{arm.name}' with {len(MILESTONES)} milestones (draft — publish from /admin/roadmaps)."
    )


if __name__ == "__main__":
    main()
