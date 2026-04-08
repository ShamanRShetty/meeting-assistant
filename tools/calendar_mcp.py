from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from tools.auth import get_credentials
import pickle, os
from datetime import datetime, timedelta, timezone
 
def _get_service():
    return build('calendar', 'v3', credentials=get_credentials())
 
def get_upcoming_events(hours_ahead: int = 2) -> list[dict]:
    """Fetch events in the next N hours."""
    service = _get_service()
    now = datetime.now(timezone.utc)
    time_max = now + timedelta(hours=hours_ahead)
    result = service.events().list(
        calendarId='primary',
        timeMin=now.isoformat(),
        timeMax=time_max.isoformat(),
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    return result.get('items', [])
 
def get_event_by_id(event_id: str) -> dict:
    service = _get_service()
    return service.events().get(calendarId='primary', eventId=event_id).execute()
 
def get_attendees(event: dict) -> list[str]:
    return [a.get('email', '') for a in event.get('attendees', [])]
 
def create_followup_event(summary: str, description: str,
                          start_time: str, attendees: list[str]) -> dict:
    """Write a new calendar event (for follow-ups)."""
    service = _get_service()
    event = {
        'summary': summary,
        'description': description,
        'start': {'dateTime': start_time, 'timeZone': 'Asia/Kolkata'},
        'end': {'dateTime': start_time, 'timeZone': 'Asia/Kolkata'},
        'attendees': [{'email': e} for e in attendees],
    }
    return service.events().insert(calendarId='primary', body=event).execute()

# ═══════════════════════════════════════════════════════════════
# DIFFERENTIATOR ADDITIONS
# ═══════════════════════════════════════════════════════════════
 
# ── D1: Conflict detection ──────────────────────────────────────
def get_events_in_range(start_iso: str, end_iso: str) -> list[dict]:
    """Fetch all events between two ISO timestamps."""
    service = _get_service()
    result = service.events().list(
        calendarId='primary',
        timeMin=start_iso,
        timeMax=end_iso,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    return result.get('items', [])
 
def find_free_slot(attendee_emails: list[str],
                   duration_minutes: int = 60,
                   search_days: int = 5) -> str | None:
    """
    Use the Calendar freebusy API to find the first mutual free slot
    in the next search_days days for the given attendees.
    Returns an ISO datetime string or None if no slot found.
    """
    service = _get_service()
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=search_days)
    items = [{'id': e} for e in attendee_emails] + [{'id': 'primary'}]
    body = {
        'timeMin': now.isoformat(),
        'timeMax': window_end.isoformat(),
        'timeZone': 'Asia/Kolkata',
        'items': items,
    }
    fb = service.freebusy().query(body=body).execute()
 
    # Collect all busy windows across all calendars
    busy_windows = []
    for cal_data in fb.get('calendars', {}).values():
        for period in cal_data.get('busy', []):
            busy_windows.append((
                datetime.fromisoformat(period['start'].replace('Z', '+00:00')),
                datetime.fromisoformat(period['end'].replace('Z', '+00:00'))
            ))
    busy_windows.sort(key=lambda x: x[0])
 
    # Walk forward in 30-min increments looking for a free slot
    # Work-hours only: 9am-6pm IST
    slot_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    slot_duration = timedelta(minutes=duration_minutes)
    checked = 0
    while slot_start < window_end and checked < 200:
        checked += 1
        hour = slot_start.astimezone(timezone.utc).hour  # approximate IST check
        # Skip outside 3:30–12:30 UTC (= 9am-6pm IST)
        if not (3 <= hour <= 12):
            slot_start += timedelta(minutes=30)
            continue
        slot_end = slot_start + slot_duration
        conflict = any(b_start < slot_end and b_end > slot_start
                       for b_start, b_end in busy_windows)
        if not conflict:
            return slot_start.isoformat()
        slot_start += timedelta(minutes=30)
    return None
 
def patch_event_description(event_id: str, new_description: str) -> dict:
    """
    Patch only the description field of an existing calendar event.
    Used by D3 agenda negotiation to write the agreed agenda back.
    """
    service = _get_service()
    return service.events().patch(
        calendarId='primary',
        eventId=event_id,
        body={'description': new_description}
    ).execute()


