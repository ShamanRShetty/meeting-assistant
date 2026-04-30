from tools.gmail_mcp import send_email
from db.firestore_client import save_action_items, append_log

def run(meeting_id: str, action_items: list[dict], attendees: list[str],
        notes_data: dict = None) -> dict:
    """
    action_items are already filtered to OPEN items only by notes_agent.

    emails_sent = only the Gmail notification emails this agent sends out.
    We deliberately do NOT add notes_data.emails_confirmed_sent here —
    those are calendar invites / in-meeting sends that are not emails from
    this agent and should not be counted in the notification total.
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

    append_log(meeting_id, 'task_agent',
               f'Saved {len(saved)} tasks. Sent {notification_emails_sent} notification emails.')

    return {
        'tasks_created': len(saved),
        'emails_sent': notification_emails_sent,
        'items': saved,
    }