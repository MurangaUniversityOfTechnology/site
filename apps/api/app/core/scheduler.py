"""A tiny in-process job loop — the API runs as a single container with no
cron/worker service beside it, and the only periodic job (event reminder
emails) is cheap and idempotent, so a daemon thread started with the app is
enough. Safe even if uvicorn is ever run with several workers: each job
locks the rows it acts on (see event_reminders.send_due_reminders)."""

import logging
import threading

from app.core.db import SessionLocal
from app.services import event_reminders

logger = logging.getLogger(__name__)

# The hour-before email lands 55–60 minutes before an event at this cadence.
TICK_SECONDS = 5 * 60

_stop = threading.Event()
_thread: threading.Thread | None = None


def _run_jobs() -> None:
    db = SessionLocal()
    try:
        sent = event_reminders.send_due_reminders(db)
        if sent:
            logger.info("Sent %d event reminder email(s)", sent)
    except Exception:
        db.rollback()
        logger.exception("Event reminder job failed")
    finally:
        db.close()


def _loop() -> None:
    # Run once on boot too, so a deploy that lands mid-window doesn't wait
    # a full tick before catching up.
    while not _stop.is_set():
        _run_jobs()
        _stop.wait(TICK_SECONDS)


def start() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="scheduler", daemon=True)
    _thread.start()


def stop() -> None:
    _stop.set()
    if _thread:
        _thread.join(timeout=10)
