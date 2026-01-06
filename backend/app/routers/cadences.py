from google.oauth2 import service_account
from googleapiclient.discovery import build

def create_calendar_event(contact_name: str, touch_type: str, scheduled_for: datetime, contact_email: str = None):
    """Create Google Calendar reminder for a touch"""
    try:
        SCOPES = ['https://www.googleapis.com/auth/calendar']
        creds = service_account.Credentials.from_service_account_file(
            'google-credentials.json', scopes=SCOPES
        )
        service = build('calendar', 'v3', credentials=creds)
        
        event = {
            'summary': f"📞 {touch_type.upper()}: {contact_name}",
            'description': f"Cadence touch - {touch_type}\nContact: {contact_name}",
            'start': {
                'dateTime': scheduled_for.isoformat(),
                'timeZone': 'America/Los_Angeles',
            },
            'end': {
                'dateTime': (scheduled_for + timedelta(minutes=15)).isoformat(),
                'timeZone': 'America/Los_Angeles',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 15},
                    {'method': 'email', 'minutes': 60},
                ],
            },
        }
        
        event = service.events().insert(calendarId='primary', body=event).execute()
        return event.get('id')
    except Exception as e:
        print(f"Calendar error: {e}")
        return None
