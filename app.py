import os
import json
import requests
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

# Ensure environment is fresh
load_dotenv(override=True)

app = Flask(__name__, static_folder='static')

EBIRD_BASE_URL = "https://api.ebird.org/v2/data/obs/US/recent"

def get_ebird_key():
    """Retrieve the latest API key from environment."""
    return os.getenv('EBIRD_API_KEY')

def load_species():
    """Load species mapping from JSON file."""
    try:
        with open('species.json', 'r') as f:
            return json.load(f)
    except Exception:
        return {"amerob": "American Robin"} # Fallback

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/species')
def get_species_list():
    """Return the list of species for the dropdown."""
    return jsonify(load_species())

@app.route('/api/sightings')
def get_sightings():
    # Handle query string properly
    species_code = request.args.get('speciesCode')
    
    # Fallback for the odd concatenated format seen in logs if still sent by client
    if not species_code:
        # Check if the whole string was sent as a single key in some malformed way
        for key in request.args.keys():
            if 'speciesCode=' in key:
                species_code = key.split('=')[-1]
                break
    
    if not species_code:
        return jsonify({"error": "speciesCode is required"}), 400

    url = f"{EBIRD_BASE_URL}/{species_code}"
    headers = {'X-eBirdApiToken': get_ebird_key()}
    params = {'back': 14}

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

# Legacy fix for old browser behavior
@app.route('/api/sightingsspeciesCode=<species_code>')
def redirect_sightings(species_code):
    return get_sightings_by_code(species_code)

def get_sightings_by_code(code):
    url = f"{EBIRD_BASE_URL}/{code}"
    headers = {'X-eBirdApiToken': get_ebird_key()}
    try:
        r = requests.get(url, headers=headers, params={'back': 14})
        r.raise_for_status()
        return jsonify(r.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Bird Migration Map Server Starting...")
    print(f"API Key Loaded: {bool(get_ebird_key())}")
    app.run(debug=True, port=5000)
