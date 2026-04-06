from google_auth_oauthlib.flow import InstalledAppFlow
import pickle, os
 
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
]
 
flow = InstalledAppFlow.from_client_secrets_file('oauth_credentials.json', SCOPES)
creds = flow.run_local_server(port=0)
with open('token.json', 'wb') as f:
    pickle.dump(creds, f)
print('token.json saved successfully')
