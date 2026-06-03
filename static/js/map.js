// Initialize Leaflet map
const map = L.map('map').setView([38, -95], 4);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);

// Atlantic Flyway Coordinates
const flywayCoords = [
    [25.7617, -80.1918], // Miami
    [32.0809, -81.0912], // Savannah
    [35.2552, -75.5267], // Cape Hatteras
    [38.9351, -74.9060], // Cape May
    [41.0632, -71.9542], // Montauk
    [43.6615, -70.2553], // Portland, ME
    [44.6488, -63.5752]  // Halifax
];

// Draw the flyway polyline
const flywayLine = L.polyline(flywayCoords, {
    color: '#ef4444',
    weight: 3,
    opacity: 0.6,
    dashArray: '10, 10'
}).addTo(map);

// Animated pulse marker for flyway
const pulseIcon = L.divIcon({
    className: 'pulse-container',
    html: '<div class="pulse"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const animatedMarker = L.marker(flywayCoords[0], { icon: pulseIcon }).addTo(map);

// Animation logic
let step = 0;
const totalSteps = 500;

function animateFlyway() {
    step = (step + 1) % totalSteps;
    const progress = step / totalSteps;
    
    const segmentCount = flywayCoords.length - 1;
    const currentSegment = Math.floor(progress * segmentCount);
    const segmentProgress = (progress * segmentCount) % 1;
    
    const start = flywayCoords[currentSegment];
    const end = flywayCoords[currentSegment + 1];
    
    if (start && end) {
        const lat = start[0] + (end[0] - start[0]) * segmentProgress;
        const lng = start[1] + (end[1] - start[1]) * segmentProgress;
        animatedMarker.setLatLng([lat, lng]);
    }
    
    requestAnimationFrame(animateFlyway);
}

animateFlyway();

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
        if (firstSpecies) fetchSightings(firstSpecies);

    } catch (error) {
        console.error('Error loading species list:', error);
    }
}

// Fetch sightings from API proxy
async function fetchSightings(speciesCode) {
    markersLayer.clearLayers();
    
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
    } catch (error) {
        console.error('Error fetching sightings:', error);
    }
}

// Event listener for species selection
document.getElementById('species-select').addEventListener('change', (e) => {
    fetchSightings(e.target.value);
});

// Initialize the dropdown on load
populateSpecies();
