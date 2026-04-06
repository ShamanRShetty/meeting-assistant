import vertexai
from vertexai.generative_models import GenerativeModel
from db.firestore_client import append_log
import os, json
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
def run(meeting_id: str, transcript: str) -> dict:
    append_log(meeting_id, 'notes_agent', 'Processing transcript...')
 
    prompt = f"""
You are a meeting analyst. Process this meeting transcript and extract structured output.
 
TRANSCRIPT:
{transcript[:8000]}
 
Return a JSON object with:
- summary (string, 3-5 sentences)
- decisions (list of strings, decisions made in the meeting)
- action_items (list of objects with fields: task, owner, due_date, priority)
  - due_date format: YYYY-MM-DD or 'TBD'
  - priority: 'high' | 'medium' | 'low'
- topics_discussed (list of strings)
- sentiment (string: 'positive' | 'neutral' | 'tense')
 
Respond ONLY with valid JSON, no markdown."""
 
    response = model.generate_content(prompt)
    try:
        result = json.loads(response.text.strip())
    except Exception:
        result = {'summary': response.text, 'decisions': [],
                  'action_items': [], 'topics_discussed': [], 'sentiment': 'neutral'}
 
    append_log(meeting_id, 'notes_agent',
               f'Extracted {len(result.get("action_items",[]))} action items')
    return result
