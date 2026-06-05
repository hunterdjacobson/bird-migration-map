# Bird Migration Live Map

[![Deploy to Render](https://img.shields.io/badge/Live%20Demo-Render-blue)](https://bird-migration-map.onrender.com/)

**Bird Migration Live Map** is a full-stack, data-driven geospatial dashboard utilizing the eBird API to visualize real-time avifauna flow and continental migration patterns. The application aggregates millions of crowdsourced observations into an intuitive interface, allowing researchers and hobbyists alike to track the pulse of avian movements across North America. By superimposing real-time sighting clusters over stylized seasonal flyway corridors to visualize migration patterns, it provides a comprehensive look at the seasonal dynamics of bird migration.

## Core Capabilities

*   **Real-Time Data Ingestion:** Secure Flask network proxy tracking live sightings via an interactive timeline slider enabling dynamic adjustments from a 1-day limit up to a 30-day window, updating both species rosters and map markers symmetrically.
*   **Hybrid Priority Pipeline:** Dual-stream filtering that prioritizes rare/notable vagrant sightings while utilizing automated **Taxonomic Sanity Filtering** (verifying `['category'] == 'species'`) to cleanly strip out subspecies variations, domestic groupings, and hybrids from the data feed.
*   **Taxonomic Autocomplete Search Engine:** Asynchronous backend wildcard querying via the `/api/species/search` endpoint that enables users to instantly query and map any bird in the global eBird taxonomy, bypassing local dropdown restrictions and injecting custom selections into the dropdown control.
*   **Interactive Geospatial UI:** Custom Leaflet.js canvas mapping observations dynamically with proportional circle markers that scale by flock volume and provide detailed sighting metadata on click.
*   **Dynamic Regional Filtering:** Responsive context switching that completely self-populates dropdown options based on the active wildlife records of any selected US State, providing localized ecological context.
*   **Ornithological Context:** Asynchronous integration with the Wikipedia REST API to provide instant scientific extracts and species images in a reactive side panel upon selection.

## Architecture & Data Flow

```text
+-----------------------+          +----------------+          +--------------------+
| UI Selection / Search | -------> |  Flask Server  | -------> |  eBird API (v2)    |
| (Interactive Events)  |          |  (Python Proxy)|          |  (Secure Token)    |
+-----------------------+          +----------------+          +--------------------+
           ^                              |                             |
           |                              v                             |
           |                       +----------------+                   |
           +---------------------- | JSON Payload   | <-----------------+
                                   | (Processed)    |
                                   +----------------+
                                          |
                                          v
                                   +----------------+
                                   |  Leaflet Map   |
                                   |(Dynamic Canvas Overlay)|
                                   +----------------+
```

1.  **User Event:** A user selects a region, species, or searches for a bird on the frontend.
2.  **Flask Proxy:** The frontend triggers an asynchronous `fetch` request to the Flask backend.
3.  **Secure Request:** Flask pings the eBird API using a secure `X-eBirdApiToken` stored in system environment variables.
4.  **Payload Processing:** The backend filters and sorts the JSON response (e.g., prioritizing notable sightings or caching taxonomy).
5.  **Stream to Map:** The processed data is streamed back to the frontend, where Leaflet.js dynamically updates the map layer with proportional markers.

## Technical Stack

*   **Backend:** Python 3.x, Flask, Requests, Python-Dotenv, Gunicorn (Production).
*   **Frontend:** Vanilla JavaScript (ES6+), Leaflet.js (Geospatial Rendering), Tailwind CSS (CDN layout).
*   **Data Sources:** eBird API (Sighting data & Taxonomy), Wikipedia REST API (Species summaries & Images).

## Local Installation & Run Guide

To set up the project locally, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/bird-migration-map.git
    cd bird-migration-map
    ```

2.  **Initialize Virtual Environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add your eBird API key:
    ```env
    EBIRD_API_KEY=your_api_key_here
    ```

5.  **Boot the Application:**
    ```bash
    python app.py
    ```
    The application will be available at `http://127.0.0.1:5000`.

## Deployment Configuration

The application is hosted live on **Render** and is configured for production readiness using a dynamic `PORT` binding optimized for the **Gunicorn** WSGI server.

* **Live URL:** [https://bird-migration-map.onrender.com/](https://bird-migration-map.onrender.com/)
* **Build Command:** `pip install -r requirements.txt`
* **Start Command:** `gunicorn app:app`
* **Environment Note:** The application is deployed on Render's **Free Instance Tier**. As a result, the container automatically spins down after 15 minutes of inactivity. Initial visits may experience a **30-50 second delay ("Cold Start")** while the cloud container provisions and warms up the server-side eBird taxonomy cache. Subsequent interactions are instantaneous.