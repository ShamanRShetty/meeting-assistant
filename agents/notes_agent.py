import vertexai
from vertexai.generative_models import GenerativeModel
from db.firestore_client import append_log
import os, json, re

vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION', 'us-central1'))
model = GenerativeModel('gemini-2.5-flash')

def run(meeting_id: str, transcript: str) -> dict:
    append_log(meeting_id, 'notes_agent', 'Processing transcript...')

    prompt = f"""
You are a transcript extractor. Your ONLY job is to extract what was EXPLICITLY said.
You MUST NOT infer, guess, calculate, or generate anything not directly stated.

TRANSCRIPT:
{transcript[:8000]}

════════════════════════════════════════
EXTRACTION RULES — READ EVERY RULE BEFORE EXTRACTING
════════════════════════════════════════

── ACTION ITEMS ──
Extract ONLY tasks where ALL three conditions are met:
  1. A named person is assigned ("Bob, can you…", "I'll…", "I will…", "can you…")
  2. The assignee explicitly accepts or self-commits in the transcript text
  3. The deliverable is concrete and stated word-for-word in the transcript

HARD RULES:
  - due_date: copy the EXACT words from the transcript (e.g. "Monday", "Thursday EOD",
    "by Wednesday", "next Friday"). Do NOT convert to a date. If no due date is stated,
    use "TBD".
  - Do NOT create tasks that are not explicitly stated.
  - Do NOT merge or split tasks. One statement = one task.
  - Do NOT add tasks for things already done before this meeting.
  - completed: true ONLY if the person says it is done IN THIS MEETING
    (exact phrases: "done", "sending it now", "sent", "already done", "just shared",
    "finished", "complete", "I've already", "I did that").

── DECISIONS ──
Extract ONLY statements where the group explicitly agrees on something final.
Required signal: explicit agreement by multiple people OR a clear announcement of a
final outcome that no one disputes.

Valid signals: "Monday it is", "Works for me / Same / Fine by me" (unanimous),
"We will ship Tuesday" (finalized plan announced with no objection).

Do NOT extract:
  - Individual task commitments (those go in action_items)
  - Suggestions without explicit agreement
  - Status updates or observations

── COMPLETED ITEMS ──
Extract tasks confirmed done WITHIN THIS MEETING only.
Use exact phrases as evidence: "done", "sending it now", "sent", "already did",
"just shared", "complete", "finished".

── EMAILS SENT COUNT ──
Count ONLY explicit email send confirmations.
A calendar invite send IS NOT an email — do not count it.
"Sending it now" about a calendar invite does NOT count.
Only count if the person explicitly says they are sending an EMAIL.
If none confirmed, set to 0.

── SENTIMENT ──
"positive" = mostly collaborative and constructive
"neutral"  = matter-of-fact, no strong emotion
"tense"    = friction, disagreement, frustration

════════════════════════════════════════
SELF-VALIDATION (run before returning)
════════════════════════════════════════
Before returning your JSON, verify each of these. If any fails, fix it:
  1. Every action_item has a named owner who explicitly accepted in the transcript.
  2. No two action_items have the same owner + same deliverable (deduplicate).
  3. due_date contains the literal words from the transcript, NOT a calculated date.
  4. emails_confirmed_sent does NOT count calendar invites or non-email confirmations.
  5. No field contains anything not stated in the transcript.
  6. decisions contains ONLY group agreements, not individual task commitments.
  7. The count of action_items in the array equals the number of distinct tasks extracted.
  8. completed items are NOT also in the open action_items list.

════════════════════════════════════════

Return a JSON object with EXACTLY these fields and no others:
{{
  "summary": "<3-5 sentences summarising only what was discussed and decided — no advice, no recommendations>",
  "decisions": ["<exact group decision 1>", ...],
  "action_items": [
    {{
      "task": "<exact deliverable as stated in transcript>",
      "owner": "<first name>",
      "due_date": "<exact words from transcript e.g. Monday, Thursday EOD, by Wednesday — or TBD>",
      "priority": "high|medium|low",
      "completed": true|false
    }}
  ],
  "completed_items": ["<task description confirmed done in this meeting>", ...],
  "emails_confirmed_sent": <integer, 0 if none>,
  "topics_discussed": ["<topic explicitly raised in transcript>", ...],
  "sentiment": "positive|neutral|tense"
}}

Respond ONLY with valid JSON. No markdown fences, no extra text."""

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

    # ── Post-process: split completed vs open action items ─────────────────
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
            (item.get('task') or '').lower().strip()[:60],
        )
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    open_items = deduped

    # Strip any completed field — it has done its job
    for item in open_items:
        item.pop('completed', None)

    result['action_items'] = open_items
    result['completed_items'] = (
        result.get('completed_items') or []
    ) + [i.get('task', '') for i in done_items]

    # Deduplicate completed_items
    seen_done = set()
    deduped_done = []
    for entry in result['completed_items']:
        key = (entry or '').lower().strip()[:60]
        if key and key not in seen_done:
            seen_done.add(key)
            deduped_done.append(entry)
    result['completed_items'] = deduped_done

    append_log(meeting_id, 'notes_agent',
               f'Extracted {len(open_items)} open action items, '
               f'{len(done_items)} completed in-meeting, '
               f'{len(result.get("decisions", []))} decisions')
    return result