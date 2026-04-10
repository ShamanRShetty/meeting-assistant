import vertexai
from vertexai.generative_models import GenerativeModel
from db.firestore_client import append_log
import os, json, re
from datetime import date

vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION', 'us-central1'))
model = GenerativeModel('gemini-2.5-flash')

def run(meeting_id: str, transcript: str) -> dict:
    append_log(meeting_id, 'notes_agent', 'Processing transcript...')

    today = date.today().isoformat()

    prompt = f"""
You are a precise meeting analyst. Today's date is {today}.
Process this transcript and return structured output with STRICT rules below.

TRANSCRIPT:
{transcript[:8000]}

════════════════════════════════════════
STRICT EXTRACTION RULES
════════════════════════════════════════

── ACTION ITEMS ──
Include ONLY tasks that satisfy ALL of these:
  1. Explicitly assigned to a named person ("Bob, can you…", "I'll fix…", "I will…")
  2. The assignee verbally accepts or self-commits (says yes, confirms, or states they will do it)
  3. Has a concrete deliverable (not vague follow-up)

DO NOT include:
  - Implicit or inferred tasks not stated by anyone
  - Tasks where the assignee is unidentified
  - Duplicate tasks (same person, same deliverable)
  - Tasks that were already completed IN THIS MEETING (see completed_items below)

For each action item set:
  - task: concise description of the deliverable
  - owner: first name of the person responsible
  - due_date: calculate actual YYYY-MM-DD from today ({today}) using any relative terms
    (Monday, EOD, this week, next Wednesday, etc.). If truly unknown use "TBD".
  - priority: "high" | "medium" | "low"
  - completed: true if the person confirmed completion IN THIS MEETING
    (phrases: "done", "sending it now", "sent", "already done", "just shared", "complete")

── DECISIONS ──
Include ONLY confirmed agreements, finalized plans, or official schedule changes
that were AGREED BY THE GROUP or announced as final.

DO NOT include:
  - Individual task commitments (those belong in action_items)
  - Suggestions that were not confirmed
  - Status updates

Examples of DECISIONS: "Sprint 24 planning moved to Monday" (group agreed),
"We will ship Tuesday" (plan finalized), "Board presentation is Friday" (confirmed deadline).
Examples of NOT decisions: "Bob will fix the bug" (that's an action item).

── COMPLETED ITEMS ──
List tasks that were explicitly confirmed as done WITHIN THIS MEETING.
Phrases to detect: "done", "sending it now", "sent", "already did", "just shared",
"complete", "finished", "I've already", "I did that".

── EMAIL DETECTION ──
Count how many distinct email/message sends were confirmed as completed in this meeting.
Only count explicit send confirmations ("done, sending now", "sent", "I'll send that now").

════════════════════════════════════════

Return a JSON object with EXACTLY these fields:
{{
  "summary": "<3-5 sentence summary>",
  "decisions": ["<decision 1>", ...],
  "action_items": [
    {{
      "task": "<deliverable>",
      "owner": "<first name>",
      "due_date": "<YYYY-MM-DD or TBD>",
      "priority": "high|medium|low",
      "completed": true|false
    }}
  ],
  "completed_items": ["<description of item completed in this meeting>", ...],
  "emails_confirmed_sent": <integer — count of sends confirmed in meeting>,
  "topics_discussed": ["<topic>", ...],
  "sentiment": "positive|neutral|tense"
}}

Respond ONLY with valid JSON. No markdown fences, no extra text.
Double-check: every action_item must have an explicit assignee who accepted.
Double-check: decisions must be group agreements, NOT individual commitments."""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Strip markdown fences if model wraps anyway
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw.strip()).strip()

    try:
        result = json.loads(raw)
    except Exception:
        result = {
            'summary': raw,
            'decisions': [],
            'action_items': [],
            'completed_items': [],
            'emails_confirmed_sent': 0,
            'topics_discussed': [],
            'sentiment': 'neutral',
        }

    # ── Post-process: split completed vs open action items ─────────────
    # Items marked completed=True should NOT appear in the open action list.
    all_items = result.get('action_items', [])
    if not isinstance(all_items, list):
        all_items = []

    open_items = [i for i in all_items if not i.get('completed', False)]
    done_items = [i for i in all_items if i.get('completed', False)]

    # Deduplicate open_items: same owner + same task keyword = duplicate
    seen = set()
    deduped = []
    for item in open_items:
        key = (
            (item.get('owner') or '').lower().strip(),
            (item.get('task') or '').lower().strip()[:40],
        )
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    open_items = deduped

    result['action_items'] = open_items        # only open items go forward
    result['completed_items'] = (
        result.get('completed_items') or []
    ) + [i.get('task', '') for i in done_items]

    append_log(meeting_id, 'notes_agent',
               f'Extracted {len(open_items)} open action items, '
               f'{len(done_items)} completed in-meeting, '
               f'{len(result.get("decisions", []))} decisions')
    return result