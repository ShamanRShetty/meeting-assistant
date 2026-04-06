from tools.calendar_mcp import create_followup_event
from tools.gmail_mcp import send_email
from db.firestore_client import save_action_items, append_log
from datetime import datetime, timedelta, timezone
 
def run(meeting_id: str, action_items: list[dict], attendees: list[str]) -> dict:
    append_log(meeting_id, 'task_agent',
               f'Processing {len(action_items)} action items...')
 
    saved = []
    emails_sent = 0
 
    for item in action_items:
        owner = item.get('owner', attendees[0] if attendees else 'unknown')
        task = item.get('task', '')
        due_date = item.get('due_date', 'TBD')
        priority = item.get('priority', 'medium')
 
        saved.append({
            'task': task,
            'owner': owner,
            'due_date': due_date,
            'priority': priority,
        })
 
        # Send email to owner if we have their email
        if '@' in owner:
            try:
                send_email(
                    to=owner,
                    subject=f'[Action Item] {task[:60]}',
                    body=f'Hi,\n\nYou have an action item from your recent meeting:\n\n'
                         f'Task: {task}\nDue: {due_date}\nPriority: {priority}\n\n'
                         f'Meeting ID: {meeting_id}'
                )
                emails_sent += 1
            except Exception as e:
                pass  # Non-fatal: log and continue
 
    save_action_items(meeting_id, saved)
 
    append_log(meeting_id, 'task_agent',
               f'Saved {len(saved)} tasks. Sent {emails_sent} notification emails.')
    return {'tasks_created': len(saved), 'emails_sent': emails_sent, 'items': saved}
