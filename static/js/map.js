// Initialize Leaflet map
const map = L.map('map').setView([38, -95], 4);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

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
    const status = document.getElementById('fetch-status');
    
    markersLayer.clearLayers();
    select.disabled = true;
    status.innerText = "Loading sightings...";
    status.classList.remove('text-red-500');
    
    try {
        const response = await fetch(`/api/sightings?speciesCode=${speciesCode}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        
        data.forEach(sighting => {
            if (sighting.lat && sighting.lng) {
                const marker = L.circleMarker([sighting.lat, sighting.lng], {
                    radius: 6,
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

// Event listener for species selection
document.getElementById('species-select').addEventListener('change', (e) => {
    fetchSightings(e.target.value);
    updateSpeciesInfo(e.target.value);
});

// Initialize the dropdown on load
populateSpecies();
