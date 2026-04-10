from tools.gmail_mcp import send_email
from db.firestore_client import save_action_items, append_log

def run(meeting_id: str, action_items: list[dict], attendees: list[str],
        notes_data: dict = None) -> dict:
    """
    FIX: action_items here are already filtered to OPEN items only by notes_agent.
    Completed items were stripped before this call.

    emails_sent now = Gmail notifications sent by this agent
                    + emails confirmed already sent within the meeting transcript
                    (detected by notes_agent as emails_confirmed_sent).
    """
    append_log(meeting_id, 'task_agent',
               f'Processing {len(action_items)} open action items...')

    # Build name->email map from attendees list
    attendee_map = {}
    for email in attendees:
        name_part = email.split('@')[0].lower()
        attendee_map[name_part] = email

    saved = []
    notification_emails_sent = 0
    skipped_emails = []

    for item in action_items:
        owner_raw = item.get('owner', '')
        task = item.get('task', '')
        due_date = item.get('due_date', 'TBD')
        priority = item.get('priority', 'medium')

        if '@' in owner_raw:
            owner_email = owner_raw
        else:
            owner_email = attendee_map.get(owner_raw.lower(), None)

        saved.append({
            'task': task,
            'owner': owner_raw,
            'owner_email': owner_email,
            'due_date': due_date,
            'priority': priority,
        })

        if owner_email:
            try:
                send_email(
                    to=owner_email,
                    subject=f'[Action Item] {task[:60]}',
                    body=(
                        f'Hi {owner_raw},\n\n'
                        f'You have an action item from your recent meeting:\n\n'
                        f'Task: {task}\n'
                        f'Due: {due_date}\n'
                        f'Priority: {priority}\n\n'
                        f'Meeting ID: {meeting_id}'
                    )
                )
                notification_emails_sent += 1
            except Exception as e:
                append_log(meeting_id, 'task_agent', f'Email failed for {owner_email}: {e}')
        else:
            skipped_emails.append(owner_raw)
            append_log(meeting_id, 'task_agent',
                       f'No email found for "{owner_raw}" — skipping notification')

    save_action_items(meeting_id, saved)

    if skipped_emails:
        append_log(meeting_id, 'task_agent',
                   f'Could not email: {", ".join(skipped_emails)} — no matching attendee emails')

    # FIX: total emails_sent = Gmail notifications we sent
    #                        + sends that were confirmed IN the transcript by notes_agent
    in_transcript_sends = 0
    if notes_data and isinstance(notes_data, dict):
        in_transcript_sends = int(notes_data.get('emails_confirmed_sent') or 0)

    total_emails = notification_emails_sent + in_transcript_sends

    append_log(meeting_id, 'task_agent',
               f'Saved {len(saved)} tasks. '
               f'Sent {notification_emails_sent} notification emails + '
               f'{in_transcript_sends} confirmed in transcript = {total_emails} total.')

    return {
        'tasks_created': len(saved),
        'emails_sent': total_emails,
        'items': saved,
    }