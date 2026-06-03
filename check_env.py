import os
from dotenv import load_dotenv

load_dotenv()
key = os.getenv('EBIRD_API_KEY')
print(f"DEBUG_KEY: [{key}]")
print(f"Length: {len(key) if key else 0}")
