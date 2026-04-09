"""
demo_data.py — Hardcoded demo data for unauthenticated users.
Provides calendar events, a transcript, and utility helpers
so the entire app works without any Google OAuth token.
"""
from datetime import datetime, timedelta, timezone

DEMO_USER_ID   = "demo_user"
DEMO_USER_EMAIL = "demo@meridian.app"


def _ist(dt: datetime) -> str:
    """Return ISO string with +05:30 offset (IST)."""
    ist_offset = timedelta(hours=5, minutes=30)
    ist_dt = dt.replace(tzinfo=timezone.utc) + ist_offset
    return ist_dt.isoformat()


def get_demo_events() -> list[dict]:
    """
    Return 5 realistic upcoming calendar events (next 7 days).
    Formatted exactly like the /api/events response so the frontend
    needs zero changes.
    """
    now = datetime.utcnow()
    # Anchor to 9 AM today UTC so times look sane
    today9 = now.replace(hour=9, minute=0, second=0, microsecond=0)

    events = [
        {
            "id": "demo_event_001",
            "title": "Q2 Product Roadmap Review",
            "start": _ist(today9 + timedelta(hours=2)),
            "label": f"Q2 Product Roadmap Review  ·  {(today9 + timedelta(hours=2)).strftime('%a, %d %b %H:%M')} IST",
            "attendees": ["priya@acmecorp.com", "rahul@acmecorp.com", "demo@meridian.app"],
        },
        {
            "id": "demo_event_002",
            "title": "Client Call — TechVentures",
            "start": _ist(today9 + timedelta(days=1, hours=1)),
            "label": f"Client Call — TechVentures  ·  {(today9 + timedelta(days=1, hours=1)).strftime('%a, %d %b %H:%M')} IST",
            "attendees": ["ananya@techventures.io", "demo@meridian.app"],
        },
        {
            "id": "demo_event_003",
            "title": "Engineering Team Standup",
            "start": _ist(today9 + timedelta(days=1, hours=3)),
            "label": f"Engineering Team Standup  ·  {(today9 + timedelta(days=1, hours=3)).strftime('%a, %d %b %H:%M')} IST",
            "attendees": ["bob@acmecorp.com", "carol@acmecorp.com", "dave@acmecorp.com", "demo@meridian.app"],
        },
        {
            "id": "demo_event_004",
            "title": "Design Review — Dashboard v2",
            "start": _ist(today9 + timedelta(days=2, hours=0, minutes=30)),
            "label": f"Design Review — Dashboard v2  ·  {(today9 + timedelta(days=2, hours=0, minutes=30)).strftime('%a, %d %b %H:%M')} IST",
            "attendees": ["meena@acmecorp.com", "demo@meridian.app"],
        },
        {
            "id": "demo_event_005",
            "title": "Sprint Planning — Sprint 24",
            "start": _ist(today9 + timedelta(days=3, hours=2)),
            "label": f"Sprint Planning — Sprint 24  ·  {(today9 + timedelta(days=3, hours=2)).strftime('%a, %d %b %H:%M')} IST",
            "attendees": ["bob@acmecorp.com", "carol@acmecorp.com", "rahul@acmecorp.com", "demo@meridian.app"],
        },
    ]
    return events


def get_demo_event_by_id(event_id: str) -> dict:
    """Return a single demo event formatted like the Calendar API response."""
    events_map = {e["id"]: e for e in get_demo_events()}
    ev = events_map.get(event_id, events_map["demo_event_001"])

    return {
        "id": ev["id"],
        "summary": ev["title"],
        "description": "Demo meeting event. Agenda: status update, blockers, next steps.",
        "start": {"dateTime": ev["start"]},
        "end":   {"dateTime": ev["start"]},   # orchestrator only uses start
        "attendees": [{"email": a} for a in ev["attendees"]],
    }


DEMO_TRANSCRIPT = """Alice: Alright, let's get started. Main item — the login bug in production. Users on mobile can't sign in with Google OAuth.

Bob: I reproduced it this morning. It only happens on iOS Safari, specifically iOS 17 and above. The issue is how Safari handles third-party cookies in OAuth redirects.

Alice: That's a critical blocker. Bob, can you have a fix ready by Monday?

Bob: Yes, I'll patch the redirect handling and have a PR up by Monday morning.

Alice: Carol, can you do a code review Monday evening so we can ship Tuesday?

Carol: Absolutely. I'll block out Monday 4-6 PM for it.

Alice: Perfect. Next — the Q3 board report. David, where are we?

David: I'm still waiting on the sales data from Priya in finance. She said she'd send it by EOD today. I'll follow up in 30 minutes and make sure we have everything by Wednesday.

Alice: The board presentation is Friday. We cannot miss that deadline, David.

David: Understood. I'll also prepare the executive summary section by Thursday and send it to you for review.

Alice: Good. Carol, you mentioned the API docs were out of date?

Carol: Yes, the docs haven't been updated since the v2.3 release in February. I'll update the authentication and webhook sections this week — I can have that done by Wednesday.

Alice: Great. Let's also track the dashboard performance issues Rahul flagged last week. Rahul, any update?

Rahul: I've identified the root cause — it's N+1 queries on the analytics page. I'll fix the query optimization by Thursday EOD.

Alice: Excellent. Let's sync again Thursday at 3 PM to check progress on all these items. Carol, can you send a calendar invite?

Carol: Done, sending it right now.

Alice: One last thing — we should consider moving the Sprint 24 planning to next Monday instead of Friday given these blockers. Everyone okay with that?

Bob: Works for me.
David: Same.
Carol: Monday works.
Rahul: Fine by me.

Alice: Great. Monday it is. Thanks everyone."""


def get_demo_calendar_data() -> dict:
    """Structured calendar data for a demo event (mirrors calendar_agent output)."""
    return {
        "title": "Q2 Product Roadmap Review",
        "start_time": _ist(datetime.utcnow().replace(hour=11, minute=0, second=0, microsecond=0)),
        "duration_minutes": 60,
        "attendees": ["alice@acmecorp.com", "bob@acmecorp.com", "carol@acmecorp.com",
                      "david@acmecorp.com", "rahul@acmecorp.com"],
        "agenda_items": ["Login bug status", "Q3 board report", "API documentation", "Dashboard performance"],
        "meeting_type": "review",
        "event_id": "demo_event_001",
    }