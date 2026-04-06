import vertexai
from vertexai.generative_models import GenerativeModel
from tools.calendar_mcp import get_event_by_id, get_attendees
from db.firestore_client import append_log
import os
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
def run(meeting_id: str, event_id: str) -> dict:
    append_log(meeting_id, 'calendar_agent', 'Fetching calendar event...')
    event = get_event_by_id(event_id)
 
    title = event.get('summary', 'Untitled Meeting')
    description = event.get('description', 'No description.')
    start = event['start'].get('dateTime', event['start'].get('date'))
    attendees = get_attendees(event)
 
    prompt = f"""
Extract structured information from this meeting event.
Title: {title}
Description: {description}
Start: {start}
Attendees: {', '.join(attendees)}
 
Return a JSON object with these fields only:
- title (string)
- start_time (string)
- duration_minutes (integer, estimate from event if not specified, default 60)
- attendees (list of email strings)
- agenda_items (list of strings extracted from description, max 5)
- meeting_type (string: 'standup' | 'planning' | 'review' | 'sync' | 'other')
 
Respond ONLY with valid JSON, no markdown."""
 
    response = model.generate_content(prompt)
    import json
    try:
        parsed = json.loads(response.text.strip())
    except Exception:
        parsed = {'title': title, 'attendees': attendees,
                  'agenda_items': [], 'meeting_type': 'other',
                  'start_time': start, 'duration_minutes': 60}
 
    append_log(meeting_id, 'calendar_agent',
               f'Event parsed: {parsed["meeting_type"]} with {len(attendees)} attendees')
    return parsed
