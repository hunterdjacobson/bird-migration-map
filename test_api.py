import os
from dotenv import load_dotenv
import requests

load_dotenv()
key = os.getenv('EBIRD_API_KEY')

print(f"Key Found: {bool(key)}")
if key:
    print(f"Key Length: {len(key)}")
    print(f"Key Sample (first 2): {key[:2]}...")
    
    # Try a very basic endpoint
    url = "https://api.ebird.org/v2/ref/region/list/country/US"
    headers = {'X-eBirdApiToken': key}
    try:
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
