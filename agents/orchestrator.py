import vertexai
from vertexai.generative_models import GenerativeModel
from agents import research_agent, calendar_agent, notes_agent, task_agent
from agents import conflict_agent, debt_agent, agenda_agent, roi_agent
from db.firestore_client import create_session, update_session, append_log, get_session
import os, json, uuid

vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')


# ── Pre-Meeting Brief ────────────────────────────────────────────────────────
def prepare_meeting(event_id: str) -> dict:
    """
    Full pre-meeting workflow:
    1. Calendar agent fetches & parses event
    2. Research agent finds relevant docs + context
    3. Orchestrator assembles final brief
    4. D1 conflict detection (non-blocking)
    5. D3 agenda negotiation polls (non-blocking)
    """
    meeting_id = str(uuid.uuid4())[:8]
    create_session(meeting_id, {'event_id': event_id})
    append_log(meeting_id, 'orchestrator', 'Starting pre-meeting workflow')

    # Step 1: Calendar agent
    cal_data = calendar_agent.run(meeting_id, event_id)
    # Store event_id back into cal_data so agenda_agent can use it
    cal_data['event_id'] = event_id
    update_session(meeting_id, {'meeting_data': cal_data, 'status': 'researching'})

    # Step 2: Research agent
    research_data = research_agent.run(
        meeting_id,
        cal_data.get('title', ''),
        cal_data.get('attendees', [])
    )
    update_session(meeting_id, {'status': 'assembling'})

    # Step 3: Assemble brief with Gemini
    prompt = f"""
Assemble a concise pre-meeting brief for a busy professional.

MEETING DETAILS:
{json.dumps(cal_data, indent=2)}

RESEARCH CONTEXT:
{research_data['research_brief']}

RELEVANT DOCUMENTS:
{json.dumps(research_data['docs_found'], indent=2)}

Write a clean, scannable brief with sections:
## Meeting snapshot (title, time, attendees, type)
## What to know going in (2-4 bullet points from research)
## Agenda to cover (from calendar description)
## Relevant docs (list with links)
## Suggested questions to ask

Keep it under 400 words. Plain markdown only."""

    brief_response = model.generate_content(prompt)
    brief = brief_response.text

    update_session(meeting_id, {
        'brief': brief,
        'research_data': research_data,
        'status': 'ready'
    })
    append_log(meeting_id, 'orchestrator', 'Pre-meeting brief ready')

    # D1: Conflict detection — non-blocking, never crashes the brief
    conflict_result = {'conflicts_found': 0, 'proposals': []}
    try:
        conflict_result = conflict_agent.run(meeting_id)
        update_session(meeting_id, {'conflict_result': conflict_result})
    except Exception as ex:
        append_log(meeting_id, 'orchestrator', f'Conflict agent skipped: {ex}')

    # D3: Agenda negotiation polls — non-blocking
    agenda_result = {}
    try:
        agenda_result = agenda_agent.run(
            meeting_id=meeting_id,
            event_id=event_id,
            meeting_title=cal_data.get('title', ''),
            meeting_time=cal_data.get('start_time', ''),
            attendees=cal_data.get('attendees', []),
        )
        update_session(meeting_id, {'agenda_result': agenda_result})
    except Exception as ex:
        append_log(meeting_id, 'orchestrator', f'Agenda agent skipped: {ex}')

    return {
        'meeting_id': meeting_id,
        'brief': brief,
        'meeting_data': cal_data,
        'conflict_result': conflict_result,
        'agenda_result': agenda_result,
    }


# ── Post-Meeting Processing ──────────────────────────────────────────────────
def process_meeting(meeting_id: str, transcript: str) -> dict:
    """
    Post-meeting workflow:
    1. Notes agent processes transcript → summary, decisions, action_items
    2. Task agent saves action items & sends email notifications
    3. D2 debt tracker — surfaces overdue items
    4. D4 ROI scorer — calculates meeting value

    Returns a flat dict that the frontend reads directly.
    All keys are always present (never missing/KeyError).
    """
    append_log(meeting_id, 'orchestrator', 'Starting post-meeting workflow')
    update_session(meeting_id, {'status': 'processing_transcript'})

    # Get stored session data (attendees, calendar info)
    session = get_session(meeting_id) or {}
    cal_data_stored = session.get('meeting_data', {})
    attendees = cal_data_stored.get('attendees', [])

    # Step 1: Notes agent — processes transcript
    notes_data = notes_agent.run(meeting_id, transcript)

    # Step 2: Task agent — saves items + sends emails
    # Guard: ensure action_items is always a list
    action_items_raw = notes_data.get('action_items', [])
    if not isinstance(action_items_raw, list):
        action_items_raw = []

    task_data = task_agent.run(
        meeting_id,
        action_items_raw,
        attendees
    )

    # Persist core results immediately
    update_session(meeting_id, {
        'notes': notes_data,
        'task_summary': task_data,
        'status': 'complete'
    })
    append_log(meeting_id, 'orchestrator', 'Post-meeting processing complete')

    # D2: Meeting debt tracker — run after every meeting
    # Returns None on failure so frontend can null-check
    debt_result = None
    try:
        debt_result = debt_agent.run(meeting_id)
        update_session(meeting_id, {'debt_result': debt_result})
    except Exception as ex:
        append_log(meeting_id, 'orchestrator', f'Debt agent skipped: {ex}')

    # D4: ROI scorer — needs both cal_data and notes_data
    # Returns None on failure so frontend can null-check
    roi_result = None
    try:
        roi_result = roi_agent.run(meeting_id, cal_data_stored, notes_data)
        update_session(meeting_id, {'roi_result': roi_result})
    except Exception as ex:
        append_log(meeting_id, 'orchestrator', f'ROI agent skipped: {ex}')

    # ── Build response — ALL keys always present ──────────────────────────
    # Frontend reads: summary, decisions, action_items, tasks_created,
    # emails_sent, debt_result, roi_result
    return {
        'meeting_id':    meeting_id,
        'summary':       notes_data.get('summary') or '',
        'decisions':     notes_data.get('decisions') or [],
        'topics':        notes_data.get('topics_discussed') or [],
        'sentiment':     notes_data.get('sentiment') or 'neutral',
        'action_items':  task_data.get('items') or [],
        'tasks_created': task_data.get('tasks_created') or 0,
        'emails_sent':   task_data.get('emails_sent') or 0,
        'debt_result':   debt_result,   # None if agent failed
        'roi_result':    roi_result,    # None if agent failed
    }