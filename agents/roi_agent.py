"""
D4 — Meeting ROI Scorer
 
After post-meeting processing, calculates:
  - Real cost in time (attendees x duration)
  - Outcome quality score (decisions made, action items, agenda completion)
  - ROI score 0-100 with a 1-sentence recommendation
 
Stores results in Firestore 'roi_scores' collection for trend analysis.
"""
import vertexai
from vertexai.generative_models import GenerativeModel
from db.firestore_client import append_log, save_roi_score
import os, json
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
# Default hourly rate if team_config not set (INR per person per hour)
DEFAULT_HOURLY_RATE_INR = 2500
 
def run(meeting_id: str, meeting_data: dict, notes_data: dict) -> dict:
    """
    meeting_data: output from calendar_agent.run() — has attendees, duration_minutes
    notes_data:   output from notes_agent.run()   — has action_items, decisions, summary
    """
    append_log(meeting_id, 'roi_agent', 'Calculating meeting ROI...')
 
    attendees     = meeting_data.get('attendees', [])
    duration_mins = meeting_data.get('duration_minutes', 60)
    num_attendees = max(len(attendees), 1)
 
    action_items  = notes_data.get('action_items', [])
    decisions     = notes_data.get('decisions', [])
    agenda_items  = meeting_data.get('agenda_items', [])
 
    # ── Cost calculation ──────────────────────────────────────────
    hourly_rate   = DEFAULT_HOURLY_RATE_INR
    cost_inr      = round(num_attendees * (duration_mins / 60) * hourly_rate)
    person_hours  = round(num_attendees * duration_mins / 60, 1)
 
    # ── Outcome metrics ───────────────────────────────────────────
    num_action_items = len(action_items)
    num_decisions    = len(decisions)
 
    # Agenda completion: what fraction of agenda items appear in summary/topics
    summary_text = notes_data.get('summary', '') + ' '.join(notes_data.get('topics_discussed', []))
    agenda_covered = 0
    agenda_pct = 0
    summary_words = summary_text.lower().split()
    for item in agenda_items:
        words = [w.lower() for w in item.split()[:3] if len(w) > 3]
        if any(w in summary_words for w in words):
            agenda_covered += 1

    agenda_pct = round(100 * agenda_covered / max(len(agenda_items), 1))
 
    # ── ROI score with Gemini ─────────────────────────────────────
    prompt = f"""
Score this meeting's ROI from 0 to 100 and give a 1-sentence recommendation.
 
Meeting stats:
- Attendees: {num_attendees}
- Duration: {duration_mins} minutes
- Estimated cost: INR {cost_inr:,} ({person_hours} person-hours)
- Action items produced: {num_action_items}
- Decisions made: {num_decisions}
- Agenda completion: {agenda_pct}%
- Meeting sentiment: {notes_data.get('sentiment', 'neutral')}
 
Scoring guide:
- 80-100: High value — clear decisions, good action items, agenda covered
- 50-79:  Medium value — some outcomes but could be more efficient
- 0-49:   Low value — few outcomes relative to time/cost invested
 
Return ONLY valid JSON:
{{
  "score": <integer 0-100>,
  "recommendation": "<one sentence max>",
  "verdict": "high" | "medium" | "low"
}}
No markdown, no extra text."""
 
    raw = model.generate_content(prompt).text.strip()
    try:
        scored = json.loads(raw)
    except Exception:
        scored = {'score': 50, 'recommendation': 'Could not parse score.', 'verdict': 'medium'}
 
    roi_result = {
        'score':           scored.get('score', 50),
        'verdict':         scored.get('verdict', 'medium'),
        'recommendation':  scored.get('recommendation', ''),
        'cost_inr':        cost_inr,
        'person_hours':    person_hours,
        'num_attendees':   num_attendees,
        'duration_minutes': duration_mins,
        'action_items_produced': num_action_items,
        'decisions_made':  num_decisions,
        'agenda_completion_pct': agenda_pct,
    }
 
    save_roi_score(meeting_id, roi_result)
    append_log(meeting_id, 'roi_agent',
               f'ROI score: {roi_result["score"]}/100 ({roi_result["verdict"]}). Cost: INR {cost_inr:,}')
    return roi_result
