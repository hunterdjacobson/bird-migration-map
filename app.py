import os
import json
import requests
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

# Ensure environment is fresh
load_dotenv(override=True)

app = Flask(__name__, static_folder='static')

# Load species mapping once at startup
try:
    with open('species.json', 'r') as f:
        SPECIES_MAP = json.load(f)
except Exception:
    SPECIES_MAP = {"amerob": "American Robin"}  # Fallback

def get_ebird_key():
    """Retrieve the latest API key from environment."""
    return os.getenv('EBIRD_API_KEY')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/species')
def get_species_list():
    """Return the list of species for the dropdown."""
    return jsonify(SPECIES_MAP)

@app.route('/api/sightings')
def get_sightings():
    # Handle query string properly
    species_code = request.args.get('speciesCode')
    region = request.args.get('region', 'US')
    back = request.args.get('back', 14, type=int)
    
    # Clamp back to max 30
    back = min(max(back, 1), 30)
    
    if not species_code:
        return jsonify({"error": "speciesCode is required"}), 400

    url = f"https://api.ebird.org/v2/data/obs/{region}/recent/{species_code}"
    headers = {'X-eBirdApiToken': get_ebird_key()}
    params = {'back': back}

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        return jsonify({
            "error": "eBird API Error",
            "status": response.status_code,
            "message": response.text
        }), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/notable')
def get_notable():
    region = request.args.get('region', 'US')
    back = request.args.get('back', 7, type=int)
    
    # Clamp back to max 30
    back = min(max(back, 1), 30)

    url = f"https://api.ebird.org/v2/data/obs/{region}/recent/notable"
    headers = {'X-eBirdApiToken': get_ebird_key()}
    params = {'back': back, 'detail': 'simple'}

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.HTTPError as e:
        return jsonify({
            "error": "eBird API Error",
            "status": response.status_code,
            "message": response.text
        }), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/species/<code>/info')
def get_species_info(code):
    com_name = SPECIES_MAP.get(code)
    if not com_name:
        return jsonify({"error": "Species code not found"}), 404

    wiki_name = com_name.replace(' ', '_')
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_name}"
    wiki_headers = {
        'User-Agent': 'BirdMigrationMap/1.0 (hunterdjacobson@gmail.com)'
    }

    result = {"comName": com_name, "extract": None, "thumbnail": None}

    try:
        response = requests.get(url, headers=wiki_headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('type') not in ('disambiguation', 'no-extract'):
                extract = data.get('extract', '')
                result['extract'] = (extract[:277] + '...') if len(extract) > 280 else extract
                result['thumbnail'] = data.get('thumbnail', {}).get('source')
    except Exception as e:
        print(f"Wikipedia error for {wiki_name}: {type(e).__name__}: {e}")

    return jsonify(result)


if __name__ == '__main__':
    print("Bird Migration Map Server Starting...")
    print(f"API Key Loaded: {bool(get_ebird_key())}")
    app.run(debug=True, port=5000)
