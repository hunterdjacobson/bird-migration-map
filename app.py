import os
import json
import requests
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

from collections import Counter

# Ensure environment is fresh
load_dotenv(override=True)

app = Flask(__name__, static_folder='static')

# Global cache for taxonomy to avoid repeated heavy calls
TAXONOMY_CACHE = {}

def get_ebird_key():
    """Retrieve the latest API key from environment."""
    return os.getenv('EBIRD_API_KEY')

def get_taxonomy():
    """Fetch and cache eBird taxonomy with categories for filtering."""
    global TAXONOMY_CACHE
    if TAXONOMY_CACHE:
        return TAXONOMY_CACHE
    
    url = "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        # Map speciesCode to {name, category}
        TAXONOMY_CACHE = {
            item['speciesCode']: {
                'name': item['comName'],
                'category': item.get('category')
            } for item in data
        }
        return TAXONOMY_CACHE
    except Exception as e:
        print(f"Taxonomy fetch error: {e}")
        return {}

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/species')
def get_species_list():
    """Return a dynamic list of species seen in a region within X days, prioritizing notable birds."""
    region = request.args.get('region', 'US')
    back = request.args.get('back', 14, type=int)
    
    # Clamp back to max 30 for safety/performance
    back = min(max(back, 1), 30)
    
    headers = {'X-eBirdApiToken': get_ebird_key()}
    
    # 1. Fetch recent and notable sightings simultaneously
    recent_url = f"https://api.ebird.org/v2/data/obs/{region}/recent"
    notable_url = f"https://api.ebird.org/v2/data/obs/{region}/recent/notable"
    
    try:
        # Standard Observations
        recent_resp = requests.get(recent_url, headers=headers, params={'back': back})
        recent_resp.raise_for_status()
        recent_obs = recent_resp.json()
        
        # Notable Observations
        notable_resp = requests.get(notable_url, headers=headers, params={'back': back, 'detail': 'simple'})
        notable_resp.raise_for_status()
        notable_obs = notable_resp.json()
        
        # 2. Extract unique codes from both streams
        notable_codes = {item['speciesCode'] for item in notable_obs if 'speciesCode' in item}
        recent_codes = [item['speciesCode'] for item in recent_obs if 'speciesCode' in item]
        
        # 3. Combine and Filter to only include 'species' (not subspecies/groups/hybrids)
        # This ensures that selecting a bird in the UI actually returns map data.
        taxonomy = get_taxonomy()
        
        final_codes = []
        seen = set()

        # Add notables first (VIPs)
        for code in list(notable_codes) + recent_codes:
            if code in taxonomy and taxonomy[code]['category'] == 'species':
                if code not in seen:
                    final_codes.append(code)
                    seen.add(code)
            if len(final_codes) >= 100:
                break
                
        # 4. Map to Common Names and Sort Alphabetically
        species_data = [{"code": c, "name": taxonomy[c]['name']} for c in final_codes]
        species_data.sort(key=lambda x: x['name'])
        
        # Convert back to clean dictionary for frontend
        result = {item['code']: item['name'] for item in species_data}
        return jsonify(result)
        
    except Exception as e:
        print(f"Species list error: {e}")
        return jsonify({"error": str(e)}), 500

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

@app.route('/api/species/search')
def search_species():
    """Search the taxonomy for species matching a query."""
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify([])
    
    taxonomy = get_taxonomy()
    results = []
    
    for code, info in taxonomy.items():
        if info['category'] == 'species':
            name = info['name'].lower()
            if query in name:
                results.append({
                    "code": code,
                    "name": info['name']
                })
        if len(results) >= 10: # Limit results for performance
            break
            
    return jsonify(results)

@app.route('/api/species/<code>/info')
def get_species_info(code):
    taxonomy = get_taxonomy()
    species_entry = taxonomy.get(code)
    if not species_entry:
        return jsonify({"error": "Species code not found"}), 404

    com_name = species_entry['name']
    wiki_name = com_name.replace(' ', '_')
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_name}"
    wiki_headers = {
        'User-Agent': 'BirdMigrationMap/1.0 (hunterdjacobson@gmail.com)'
    }

    result = {"comName": com_name, "extract": None, "thumbnail": None, "wikiUrl": None}

    try:
        response = requests.get(url, headers=wiki_headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('type') not in ('disambiguation', 'no-extract'):
                extract = data.get('extract', '')
                result['extract'] = (extract[:277] + '...') if len(extract) > 280 else extract
                result['thumbnail'] = data.get('thumbnail', {}).get('source')
                result['wikiUrl'] = data.get('content_urls', {}).get('desktop', {}).get('page')
    except Exception as e:
        print(f"Wikipedia error for {wiki_name}: {type(e).__name__}: {e}")

    return jsonify(result)


if __name__ == '__main__':
    print("Bird Migration Map Server Starting...")
    print(f"API Key Loaded: {bool(get_ebird_key())}")
    app.run(debug=True, port=5000)
