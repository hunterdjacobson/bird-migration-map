// Initialize Leaflet map
const map = L.map('map').setView([38, -95], 4);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Visualization Layers
let markersLayer = L.layerGroup().addTo(map);

// Migration Flyways Configuration
const FLYWAYS = {
    atlantic: { 
        name: "Atlantic", 
        color: "#ef4444", 
        coords: [[25.76, -80.19], [35.25, -75.53], [38.93, -74.91], [41.06, -71.95], [43.66, -70.25], [44.65, -63.58]] 
    },
    mississippi: { 
        name: "Mississippi", 
        color: "#10b981", 
        coords: [[29.95, -90.07], [35.15, -90.05], [38.63, -90.20], [41.88, -87.63], [44.98, -93.27], [49.90, -97.14]] 
    },
    central: { 
        name: "Central", 
        color: "#f59e0b", 
        coords: [[27.80, -97.40], [35.47, -97.52], [37.69, -97.34], [41.12, -100.76], [46.81, -100.78], [50.45, -104.62]] 
    },
    pacific: { 
        name: "Pacific", 
        color: "#8b5cf6", 
        coords: [[32.72, -117.16], [37.77, -122.42], [45.52, -122.68], [47.61, -122.33], [49.25, -123.12], [64.84, -147.72]] 
    }
};

const flywayLayers = {};

// Draw all polylines
Object.entries(FLYWAYS).forEach(([key, flyway]) => {
    flywayLayers[key] = L.polyline(flyway.coords, {
        color: flyway.color,
        weight: 3,
        opacity: 0.6,
        dashArray: '10, 10'
    }).addTo(map);
});

// Animated pulse marker for flyway
const pulseIcon = L.divIcon({
    className: 'pulse-container',
    html: '<div class="pulse"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const animatedMarker = L.marker(FLYWAYS.atlantic.coords[0], { icon: pulseIcon }).addTo(map);

// Animation logic
let step = 0;
const totalSteps = 500;

function animateFlyway() {
    step = (step + 1) % totalSteps;
    const progress = step / totalSteps;
    
    const coords = FLYWAYS.atlantic.coords;
    const segmentCount = coords.length - 1;
    const currentSegment = Math.floor(progress * segmentCount);
    const segmentProgress = (progress * segmentCount) % 1;
    
    const start = coords[currentSegment];
    const end = coords[currentSegment + 1];
    
    if (start && end) {
        const lat = start[0] + (end[0] - start[0]) * segmentProgress;
        const lng = start[1] + (end[1] - start[1]) * segmentProgress;
        animatedMarker.setLatLng([lat, lng]);
    }
    
    requestAnimationFrame(animateFlyway);
}

animateFlyway();

// Toggle Flyway function
function toggleFlyway(key) {
    const layer = flywayLayers[key];
    const button = document.getElementById(`toggle-${key}`);
    
    if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        button.classList.add('opacity-50');
        button.classList.remove('ring-2', 'ring-offset-2', 'ring-gray-400');
    } else {
        map.addLayer(layer);
        button.classList.remove('opacity-50');
        button.classList.add('ring-2', 'ring-offset-2', 'ring-gray-400');
    }
}

// Add event listeners for toggles
Object.keys(FLYWAYS).forEach(key => {
    const btn = document.getElementById(`toggle-${key}`);
    if (btn) {
        btn.addEventListener('click', () => toggleFlyway(key));
    }
});

// Fetch species info (Wikipedia summary)
async function updateSpeciesInfo(code) {
    const placeholder = document.getElementById('species-placeholder');
    const skeleton = document.getElementById('species-skeleton');
    const dataPanel = document.getElementById('species-data');
    const nameEl = document.getElementById('species-name');
    const descEl = document.getElementById('species-desc');
    const imgEl = document.getElementById('species-img');

    // Show skeleton state
    placeholder.classList.add('hidden');
    dataPanel.classList.add('hidden');
    skeleton.classList.remove('hidden');

    try {
        const response = await fetch(`/api/species/${code}/info`);
        const info = await response.json();

        nameEl.textContent = info.comName;
        
        if (info.extract) {
            descEl.textContent = info.extract;
            if (info.wikiUrl) {
                const readMore = document.createElement('a');
                readMore.href = info.wikiUrl;
                readMore.target = '_blank';
                readMore.className = 'text-blue-500 hover:underline ml-1 text-xs font-medium';
                readMore.textContent = '(read more)';
                descEl.appendChild(readMore);
            }
        } else {
            descEl.innerHTML = '<span class="italic text-gray-400">No detailed information available from Wikipedia.</span>';
        }

        if (info.thumbnail) {
            imgEl.src = info.thumbnail;
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }

        skeleton.classList.add('hidden');
        dataPanel.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching species info:', error);
        nameEl.textContent = "Error";
        descEl.textContent = "Failed to load species information.";
        imgEl.classList.add('hidden');
        skeleton.classList.add('hidden');
        dataPanel.classList.remove('hidden');
    }
}

// Populate Species Dropdown
async function populateSpecies() {
    const select = document.getElementById('species-select');
    try {
        const response = await fetch('/api/species');
        const speciesMap = await response.json();
        
        // Clear existing and add from JSON
        select.innerHTML = '';
        Object.entries(speciesMap).forEach(([code, name]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = name;
            select.appendChild(option);
        });
        
        // Initial fetch for the first species in the new list
        const firstSpecies = Object.keys(speciesMap)[0];
        if (firstSpecies) {
            fetchSightings(firstSpecies);
            updateSpeciesInfo(firstSpecies);
        }

    } catch (error) {
        console.error('Error loading species list:', error);
    }
}

// Fetch sightings from API proxy
async function fetchSightings(speciesCode) {
    const select = document.getElementById('species-select');
    const regionSelect = document.getElementById('region-select');
    const daysSlider = document.getElementById('days-slider');
    const status = document.getElementById('fetch-status');
    
    const region = regionSelect.value;
    const back = daysSlider.value;
    
    markersLayer.clearLayers();
    
    select.disabled = true;
    status.innerText = "Loading sightings...";
    status.classList.remove('text-red-500');
    
    try {
        const response = await fetch(`/api/sightings?speciesCode=${speciesCode}&region=${region}&back=${back}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        
        // Find max count for proportional radius
        const maxCount = Math.max(...data.map(s => s.howMany || 1), 1);

        data.forEach(sighting => {
            if (sighting.lat && sighting.lng) {
                // Proportional Radius: 5px to 23px
                const radius = 5 + (((sighting.howMany || 1) / maxCount) * 18);

                const marker = L.circleMarker([sighting.lat, sighting.lng], {
                    radius: radius,
                    fillColor: "#3b82f6",
                    color: "#ffffff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
                
                const popupContent = `
                    <div class="p-2">
                        <h3 class="font-bold text-lg">${sighting.comName}</h3>
                        <p><strong>Location:</strong> ${sighting.locName}</p>
                        <p><strong>Date:</strong> ${sighting.obsDt}</p>
                        <p><strong>Count:</strong> ${sighting.howMany || 'N/A'}</p>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
                markersLayer.addLayer(marker);
            }
        });
        
        status.innerText = "";
    } catch (error) {
        console.error('Error fetching sightings:', error);
        status.innerText = "Failed to load sightings. Check console.";
        status.classList.add('text-red-500');
    } finally {
        select.disabled = false;
    }
}

// Controls Logic
let sliderTimeout;
const daysSlider = document.getElementById('days-slider');
const daysLabel = document.getElementById('days-label');
const regionSelect = document.getElementById('region-select');

daysSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    daysLabel.textContent = `Last ${val} days`;
    
    clearTimeout(sliderTimeout);
    sliderTimeout = setTimeout(() => {
        fetchSightings(document.getElementById('species-select').value);
    }, 400);
});

// Region View Configuration (Lat, Lng, Zoom)
const REGION_VIEWS = {
    "US": { center: [38, -95], zoom: 4 },
    "US-AL": { center: [32.31, -86.90], zoom: 7 },
    "US-AK": { center: [63.58, -154.49], zoom: 4 },
    "US-AZ": { center: [34.04, -111.09], zoom: 7 },
    "US-AR": { center: [35.20, -91.83], zoom: 7 },
    "US-CA": { center: [36.77, -119.41], zoom: 6 },
    "US-CO": { center: [39.55, -105.78], zoom: 7 },
    "US-CT": { center: [41.60, -73.08], zoom: 9 },
    "US-DE": { center: [38.91, -75.52], zoom: 9 },
    "US-FL": { center: [27.66, -81.51], zoom: 7 },
    "US-GA": { center: [32.16, -82.90], zoom: 7 },
    "US-HI": { center: [19.89, -155.58], zoom: 7 },
    "US-ID": { center: [44.06, -114.74], zoom: 6 },
    "US-IL": { center: [40.63, -89.39], zoom: 7 },
    "US-IN": { center: [40.26, -86.13], zoom: 7 },
    "US-IA": { center: [41.87, -93.09], zoom: 7 },
    "US-KS": { center: [38.52, -96.72], zoom: 7 },
    "US-KY": { center: [37.83, -84.27], zoom: 7 },
    "US-LA": { center: [30.98, -91.96], zoom: 7 },
    "US-ME": { center: [45.25, -69.44], zoom: 7 },
    "US-MD": { center: [39.04, -76.64], zoom: 8 },
    "US-MA": { center: [42.40, -71.38], zoom: 8 },
    "US-MI": { center: [44.31, -85.60], zoom: 7 },
    "US-MN": { center: [46.72, -94.68], zoom: 6 },
    "US-MS": { center: [32.74, -89.67], zoom: 7 },
    "US-MO": { center: [37.96, -91.83], zoom: 7 },
    "US-MT": { center: [46.87, -110.36], zoom: 6 },
    "US-NE": { center: [41.12, -98.26], zoom: 7 },
    "US-NV": { center: [38.80, -116.41], zoom: 6 },
    "US-NH": { center: [43.19, -71.57], zoom: 8 },
    "US-NJ": { center: [40.05, -74.40], zoom: 8 },
    "US-NM": { center: [34.51, -105.87], zoom: 7 },
    "US-NY": { center: [43.29, -74.21], zoom: 7 },
    "US-NC": { center: [35.75, -79.01], zoom: 7 },
    "US-ND": { center: [47.55, -101.00], zoom: 7 },
    "US-OH": { center: [40.41, -82.90], zoom: 7 },
    "US-OK": { center: [35.00, -97.09], zoom: 7 },
    "US-OR": { center: [43.80, -120.55], zoom: 7 },
    "US-PA": { center: [41.20, -77.19], zoom: 7 },
    "US-RI": { center: [41.58, -71.47], zoom: 10 },
    "US-SC": { center: [33.83, -81.16], zoom: 7 },
    "US-SD": { center: [44.29, -99.43], zoom: 7 },
    "US-TN": { center: [35.51, -86.58], zoom: 7 },
    "US-TX": { center: [31.96, -99.90], zoom: 6 },
    "US-UT": { center: [39.32, -111.09], zoom: 7 },
    "US-VT": { center: [44.04, -72.71], zoom: 8 },
    "US-VA": { center: [37.43, -78.65], zoom: 7 },
    "US-WA": { center: [47.75, -120.74], zoom: 7 },
    "US-WV": { center: [38.59, -80.45], zoom: 8 },
    "US-WI": { center: [43.78, -88.78], zoom: 7 },
    "US-WY": { center: [43.07, -107.29], zoom: 7 }
};

regionSelect.addEventListener('change', (e) => {
    const code = e.target.value;
    const view = REGION_VIEWS[code];
    if (view) {
        map.flyTo(view.center, view.zoom);
    }
    fetchSightings(document.getElementById('species-select').value);
});

// Event listener for species selection
document.getElementById('species-select').addEventListener('change', (e) => {
    fetchSightings(e.target.value);
    updateSpeciesInfo(e.target.value);
});

// Initialize the dropdown on load
populateSpecies();
