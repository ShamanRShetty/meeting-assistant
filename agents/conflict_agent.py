"""
D1 — Conflict-Aware Autonomous Rescheduling Agent
 
Detects double-bookings and overloaded days in the next 7 days,
finds a free mutual slot, drafts a rescheduling proposal, and
stores it in Firestore with status 'pending_approval'.
The user approves with one click via the /api/conflict/approve endpoint.
"""
import vertexai
from vertexai.generative_models import GenerativeModel
from tools.calendar_mcp import get_events_in_range, find_free_slot, get_attendees
from db.firestore_client import get_db, append_log
from datetime import datetime, timedelta, timezone
import os, json
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
def run(meeting_id: str) -> dict:
    """
    Scan the next 7 days for conflicts and overloaded days.
    For each conflict found, propose a reschedule.
    Returns a list of proposals stored in Firestore.
    """
    append_log(meeting_id, 'conflict_agent', 'Scanning calendar for conflicts...')
 
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)
    events = get_events_in_range(now.isoformat(), week_end.isoformat())
 
    if not events:
        append_log(meeting_id, 'conflict_agent', 'No events found in next 7 days.')
        return {'conflicts_found': 0, 'proposals': []}
 
    # Group events by date
    from collections import defaultdict
    by_date = defaultdict(list)
    for ev in events:
        start_raw = ev.get('start', {}).get('dateTime', ev.get('start', {}).get('date', ''))
        if start_raw:
            date_key = start_raw[:10]  # 'YYYY-MM-DD'
            by_date[date_key].append(ev)
 
    conflicts = []
 
    for date_key, day_events in by_date.items():
        # Sort by start time
        day_events.sort(key=lambda e: e.get('start', {}).get('dateTime', ''))
 
        # Check 1: Double-booking (overlapping events)
        for i in range(len(day_events) - 1):
            e1, e2 = day_events[i], day_events[i + 1]
            end1 = e1.get('end', {}).get('dateTime', '')
            start2 = e2.get('start', {}).get('dateTime', '')
            if end1 and start2 and end1 > start2:
                conflicts.append({
                    'type': 'overlap',
                    'event_id': e2['id'],
                    'event_title': e2.get('summary', 'Untitled'),
                    'event_start': start2,
                    'conflict_with': e1.get('summary', 'Untitled'),
                    'attendees': get_attendees(e2),
                })
 
        # Check 2: Overloaded day (4+ hours of meetings)
        total_minutes = 0
        for ev in day_events:
            start_str = ev.get('start', {}).get('dateTime', '')
            end_str   = ev.get('end',   {}).get('dateTime', '')
            if start_str and end_str:
                try:
                    s = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    e = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    total_minutes += (e - s).seconds // 60
                except Exception:
                    pass
        if total_minutes >= 240 and len(day_events) >= 2:
            # Flag the last meeting of the day as a candidate for moving
            last = day_events[-1]
            conflicts.append({
                'type': 'overload',
                'event_id': last['id'],
                'event_title': last.get('summary', 'Untitled'),
                'event_start': last.get('start', {}).get('dateTime', ''),
                'total_meeting_minutes': total_minutes,
                'attendees': get_attendees(last),
            })
 
    if not conflicts:
        append_log(meeting_id, 'conflict_agent', 'No conflicts detected. Calendar looks clean.')
        return {'conflicts_found': 0, 'proposals': []}
 
    # For each conflict, find a free slot and generate a proposal
    proposals = []
    for conflict in conflicts[:3]:  # cap at 3 to avoid API flooding
        attendees = conflict.get('attendees', [])
        free_slot = find_free_slot(attendees, duration_minutes=60, search_days=5)
 
        # Use Gemini to write a polished reschedule note
        prompt = f"""
Write a short, professional note explaining why we are proposing to reschedule a meeting.
Conflict type: {conflict['type']}
Meeting: {conflict['event_title']}
Current time: {conflict['event_start']}
Proposed new time: {free_slot or 'TBD — no free slot found this week'}
{'Overlaps with: ' + conflict.get('conflict_with','') if conflict['type']=='overlap' else 'Day has ' + str(conflict.get('total_meeting_minutes',0)) + ' minutes of meetings'}
 
Write 2 sentences max. Polite and concise. No subject line."""
        note_text = model.generate_content(prompt).text.strip()
 
        proposal = {
            'conflict': conflict,
            'proposed_slot': free_slot,
            'note': note_text,
            'status': 'pending_approval',
            'meeting_id': meeting_id,
        }
        proposals.append(proposal)
 
        # Store in Firestore under conflicts collection
        get_db().collection('conflict_proposals').add(proposal)
 
    append_log(meeting_id, 'conflict_agent',
               f'Found {len(conflicts)} conflict(s). Created {len(proposals)} proposal(s).')
    return {'conflicts_found': len(conflicts), 'proposals': proposals}
