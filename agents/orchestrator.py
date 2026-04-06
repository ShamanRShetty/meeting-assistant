import vertexai
from vertexai.generative_models import GenerativeModel
from agents import research_agent, calendar_agent, notes_agent, task_agent
from db.firestore_client import create_session, update_session, append_log
import os, json, uuid
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
# ── Pre-Meeting Brief ───────────────────────────────────────────────
def prepare_meeting(event_id: str) -> dict:
    """
    Full pre-meeting workflow:
    1. Calendar agent fetches & parses event
    2. Research agent finds relevant docs + context
    3. Orchestrator assembles final brief
    4. Saves to Firestore
    """
    meeting_id = str(uuid.uuid4())[:8]
    create_session(meeting_id, {'event_id': event_id})
    append_log(meeting_id, 'orchestrator', 'Starting pre-meeting workflow')
 
    # Step 1: Get event details
    cal_data = calendar_agent.run(meeting_id, event_id)
    update_session(meeting_id, {'meeting_data': cal_data, 'status': 'researching'})
 
    # Step 2: Research
    research_data = research_agent.run(
        meeting_id,
        cal_data.get('title', ''),
        cal_data.get('attendees', [])
    )
    update_session(meeting_id, {'status': 'assembling'})
 
    # Step 3: Assemble final brief with Gemini
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
 
    return {'meeting_id': meeting_id, 'brief': brief, 'meeting_data': cal_data}
 
 
# ── Post-Meeting Processing ─────────────────────────────────────────
def process_meeting(meeting_id: str, transcript: str) -> dict:
    """
    Post-meeting workflow:
    1. Notes agent processes transcript
    2. Task agent saves & notifies owners
    3. Orchestrator stores final summary
    """
    append_log(meeting_id, 'orchestrator', 'Starting post-meeting workflow')
    update_session(meeting_id, {'status': 'processing_transcript'})
 
    # Get attendees from stored session
    from db.firestore_client import get_session
    session = get_session(meeting_id)
    attendees = session.get('meeting_data', {}).get('attendees', [])
 
    # Step 1: Notes agent
    notes_data = notes_agent.run(meeting_id, transcript)
 
    # Step 2: Task agent
    task_data = task_agent.run(
        meeting_id,
        notes_data.get('action_items', []),
        attendees
    )
 
    update_session(meeting_id, {
        'notes': notes_data,
        'task_summary': task_data,
        'status': 'complete'
    })
    append_log(meeting_id, 'orchestrator', 'Post-meeting processing complete')
 
    return {
        'meeting_id': meeting_id,
        'summary': notes_data.get('summary'),
        'decisions': notes_data.get('decisions', []),
        'action_items': task_data['items'],
        'tasks_created': task_data['tasks_created'],
        'emails_sent': task_data['emails_sent'],
    }
