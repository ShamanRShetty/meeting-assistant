"""
D2 — Meeting Debt Tracker

Reads open action items from Firestore scoped to the given user,
identifies overdue ones, sends escalation emails to owners via Gmail MCP,
and returns a debt summary for the dashboard.

Called by: Cloud Scheduler nightly job OR manually via /api/debt/escalate
"""
import vertexai
from vertexai.generative_models import GenerativeModel
from db.firestore_client import get_debt_summary, append_log, get_db
from tools.gmail_mcp import send_email
from datetime import datetime, timezone
import os

vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')

def run(meeting_id: str = 'system', user_id: str = None) -> dict:
    """
    1. Pull open action items scoped to user_id
    2. Identify overdue items
    3. Send escalation emails to owners of overdue items
    4. Return full debt summary

    FIX: user_id is now required to scope results — without it only
    items explicitly tagged to this user are returned, never global ones.
    """
    append_log(meeting_id, 'debt_agent', 'Running meeting debt check...')

    # FIX: always pass user_id so results are scoped to this user only
    summary = get_debt_summary(user_id=user_id)
    overdue = summary.get('overdue_items', [])

    emails_sent = 0
    for item in overdue:
        owner_email = item.get('owner_email')
        if not owner_email or '@' not in owner_email:
            continue
        task = item.get('task', 'N/A')
        due_date = item.get('due_date', 'N/A')
        owner = item.get('owner', owner_email)
        meeting_src = item.get('meeting_id', 'N/A')
        try:
            send_email(
                to=owner_email,
                subject=f'[Overdue] Action item from meeting {meeting_src}',
                body=(
                    f'Hi {owner},\n\n'
                    f'This is a reminder that you have an overdue action item:\n\n'
                    f'Task:     {task}\n'
                    f'Due date: {due_date}\n'
                    f'Meeting:  {meeting_src}\n\n'
                    f'Please update or complete this item at your earliest convenience.'
                )
            )
            emails_sent += 1
        except Exception as ex:
            append_log(meeting_id, 'debt_agent', f'Email failed for {owner_email}: {ex}')

    append_log(meeting_id, 'debt_agent',
               f'Debt check done. Open: {summary["open"]}, Overdue: {summary["overdue"]}, Escalated: {emails_sent}')

    return {
        'open': summary['open'],
        'overdue': summary['overdue'],
        'escalated': emails_sent,
        'overdue_items': overdue,
        'open_items': summary['open_items'],
    }