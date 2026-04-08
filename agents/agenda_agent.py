"""
D3 — Agenda Negotiation Agent
 
24 hours before a meeting:
  1. Sends each attendee a short email asking their top priority
  2. Polls Gmail for replies (waits up to the configured window)
  3. Uses Gemini to synthesize a time-boxed agenda
  4. Patches the calendar event description with the final agenda
 
In a hackathon context the 'poll and wait' step is simulated:
the agent sends emails and immediately returns a placeholder agenda.
The /api/agenda/finalize endpoint can be called later once replies arrive.
"""
import vertexai
from vertexai.generative_models import GenerativeModel
from tools.calendar_mcp import patch_event_description
from tools.gmail_mcp import send_agenda_poll, get_recent_thread
from db.firestore_client import append_log, get_db
from datetime import datetime, timezone
import os, json
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
def run(meeting_id: str, event_id: str, meeting_title: str,
        meeting_time: str, attendees: list[str]) -> dict:
    """
    Phase 1: Send agenda poll emails to all attendees.
    Stores a 'pending' agenda doc in Firestore.
    """
    append_log(meeting_id, 'agenda_agent', f'Sending agenda polls to {len(attendees)} attendees...')
 
    polls_sent = 0
    failed = []
    for email in attendees:
        name = email.split('@')[0].capitalize()
        try:
            send_agenda_poll(
                to=email,
                attendee_name=name,
                meeting_title=meeting_title,
                meeting_time=meeting_time,
            )
            polls_sent += 1
        except Exception as ex:
            failed.append(email)
            append_log(meeting_id, 'agenda_agent', f'Poll email failed for {email}: {ex}')
 
    # Store pending agenda record in Firestore
    get_db().collection('agendas').document(meeting_id).set({
        'meeting_id': meeting_id,
        'event_id': event_id,
        'meeting_title': meeting_title,
        'meeting_time': meeting_time,
        'attendees': attendees,
        'polls_sent': polls_sent,
        'status': 'awaiting_replies',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'final_agenda': None,
    })
 
    append_log(meeting_id, 'agenda_agent',
               f'Polls sent to {polls_sent} attendees. Waiting for replies.')
    return {
        'polls_sent': polls_sent,
        'failed': failed,
        'status': 'awaiting_replies',
        'message': f'Agenda polls sent. Call /api/agenda/finalize/{meeting_id} after replies arrive.',
    }
 
 
def finalize(meeting_id: str) -> dict:
    """
    Phase 2: Read replies from Gmail, synthesize agenda with Gemini,
    patch the calendar event, and update Firestore.
    Called via /api/agenda/finalize/{meeting_id}
    """
    agenda_doc = get_db().collection('agendas').document(meeting_id).get()
    if not agenda_doc.exists:
        return {'error': f'No agenda record found for meeting_id {meeting_id}'}
 
    data = agenda_doc.to_dict()
    meeting_title = data.get('meeting_title', 'Meeting')
    event_id = data.get('event_id', '')
 
    # Search Gmail for replies to the poll
    replies_raw = get_recent_thread(f'agenda {meeting_title[:30]}')
    reply_texts = []
    for msg in replies_raw[:8]:
        # gmail returns message stubs; extract snippet field
        snippet = msg.get('snippet', '')
        if snippet:
            reply_texts.append(snippet)
 
    replies_text = ('\n'.join(reply_texts)
                   if reply_texts else
                   'No replies received yet. Generating agenda from meeting title only.')
 
    # Synthesize agenda with Gemini
    prompt = f"""
You are creating a structured meeting agenda by synthesizing attendee priorities.
 
Meeting: {meeting_title}
Attendee replies:
{replies_text}
 
Create a time-boxed agenda (total 60 minutes) with:
- 3-5 agenda items ranked by frequency / importance
- Time allocation for each item (e.g. 10 min, 15 min)
- A 5-minute buffer at the end for decisions and next steps
 
Format as plain text, each line: 'HH:MM - HH:MM  Item title'
Then add one line: 'Goal: <one sentence goal for the meeting>'
Keep it concise. Max 150 words."""
 
    final_agenda = model.generate_content(prompt).text.strip()
 
    # Patch the calendar event description
    patched = False
    if event_id:
        try:
            patch_event_description(event_id, f'AGREED AGENDA:\n\n{final_agenda}')
            patched = True
        except Exception as ex:
            pass  # Non-fatal
 
    # Update Firestore
    get_db().collection('agendas').document(meeting_id).update({
        'final_agenda': final_agenda,
        'status': 'finalized',
        'calendar_patched': patched,
        'finalized_at': datetime.now(timezone.utc).isoformat(),
    })
 
    return {
        'final_agenda': final_agenda,
        'calendar_patched': patched,
        'replies_found': len(reply_texts),
    }
