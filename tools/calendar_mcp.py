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
