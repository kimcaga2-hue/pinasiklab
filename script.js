// ===== Get HTML elements =====
const reportForm = document.getElementById("reportForm");
const reportList = document.getElementById("reportList");
const message = document.getElementById("message");
const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");
const locationInput = document.getElementById("location");

// Load saved reports from browser storage
let reports = JSON.parse(localStorage.getItem("ecoReports")) || [];

// ===== Initialize the main map (centered on Baguio City) =====
const map = L.map("map").setView([16.4023, 120.5960], 13);

// Use OpenFreeMap (No API key needed, won't get blocked)
L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/liberty"
}).addTo(map);

// Restrict the map to Baguio City bounds
map.setMaxBounds([
    [16.30, 120.50], // southwest corner
    [16.50, 120.70]  // northeast corner
]);

let marker = null;

// When user clicks the map, place/move the marker
map.on("click", function (e) {
    setMarker(e.latlng.lat, e.latlng.lng);
});

// ===== Search Location Feature =====
// Listen for "Enter" key in the location input
locationInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        e.preventDefault(); // Stop form from submitting
        searchLocation(locationInput.value);
    }
});

function searchLocation(query) {
    if (!query.trim()) return;
    
    // Add "Baguio" to the search so it stays local
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Baguio")}&limit=1`;

    fetch(searchUrl)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                // Move map to found location
                map.setView([lat, lon], 16);
                setMarker(lat, lon);
            } else {
                alert("Location not found. Try being more specific (e.g., 'Burnham Park').");
            }
        })
        .catch(err => console.error("Search error:", err));
}

// ===== Map Marker & Geocoding =====
function setMarker(lat, lng) {
    const latlng = [lat, lng];

    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng, { draggable: true }).addTo(map);

        marker.on("dragend", function () {
            const pos = marker.getLatLng();
            latInput.value = pos.lat;
            lngInput.value = pos.lng;
            reverseGeocode(pos.lat, pos.lng);
        });
    }

    latInput.value = lat;
    lngInput.value = lng;
    reverseGeocode(lat, lng);
}

function reverseGeocode(lat, lng) {
    // Use OpenStreetMap's Nominatim (fixed - no broken Google Maps tags)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    fetch(url, {
        headers: { "Accept-Language": "en" }
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.display_name) {
                // Only auto-fill if the user hasn't typed anything manually
                if (!locationInput.value.trim()) {
                    locationInput.value = data.display_name;
                }
            }
        })
        .catch(err => console.warn("Reverse geocoding failed:", err));
}

// ===== Submit Report =====
reportForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const report = {
        id: Date.now(),
        name: document.getElementById("reporter").value,
        category: document.getElementById("category").value,
        location: locationInput.value,
        description: document.getElementById("description").value,
        latitude: latInput.value,
        longitude: lngInput.value,
        status: "Pending",
        date: new Date().toLocaleString(),
        timestamp: Date.now() // Added timestamp so Admin panel sorts correctly
    };

    reports.push(report);

    // Save reports in browser storage
    localStorage.setItem("ecoReports", JSON.stringify(reports));

    message.textContent = "✅ Your report has been submitted successfully!";
    message.style.color = "green";

    // Reset the form and the map marker
    reportForm.reset();
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    map.setView([16.4023, 120.5960], 13);
    latInput.value = "";
    lngInput.value = "";

    displayReports();
});

// ===== Display submitted reports =====
function displayReports() {
    reportList.innerHTML = "";

    if (reports.length === 0) {
        reportList.innerHTML = "<p style='text-align:center;'>No reports yet. Be the first to report!</p>";
        updateStatistics();
        return;
    }

    // Sort reports so the newest is always first
    const sortedReports = [...reports].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    sortedReports.forEach(function (report) {
        const reportElement = document.createElement("div");
        reportElement.classList.add("report-item");

        const title = document.createElement("h3");
        title.textContent = report.category;

        const name = document.createElement("p");
        name.textContent = "Reported by: " + report.name;

        const location = document.createElement("p");
        location.textContent = "Location: " + report.location;

        const description = document.createElement("p");
        description.textContent = "Description: " + report.description;

        const date = document.createElement("p");
        date.textContent = "Date: " + report.date;

        const status = document.createElement("span");
        status.classList.add("status");
        status.textContent = "Status: " + report.status;

        reportElement.appendChild(title);
        reportElement.appendChild(name);
        reportElement.appendChild(location);
        reportElement.appendChild(description);
        reportElement.appendChild(date);
        reportElement.appendChild(status);

        // Add a mini-map if coordinates exist
        if (report.latitude && report.longitude) {
            const mapDiv = document.createElement("div");
            mapDiv.classList.add("report-map");
            reportElement.appendChild(mapDiv);

            // Must run after the element is in the DOM
            setTimeout(() => {
                const miniMap = L.map(mapDiv, {
                    scrollWheelZoom: false,
                    dragging: false,
                    zoomControl: false
                }).setView([report.latitude, report.longitude], 16);

                // Use OpenFreeMap for the mini maps too
                L.maplibreGL({
                    style: "https://tiles.openfreemap.org/styles/liberty"
                }).addTo(miniMap);

                L.marker([report.latitude, report.longitude]).addTo(miniMap);
            }, 0);
        }

        reportList.appendChild(reportElement);
    });

    updateStatistics();
}

// ===== Update dashboard statistics =====
function updateStatistics() {
    const total = reports.length;

    const pending = reports.filter(function (report) {
        return report.status === "Pending";
    }).length;

    const resolved = reports.filter(function (report) {
        return report.status === "Resolved";
    }).length;

    document.getElementById("totalReports").textContent = total;
    document.getElementById("pendingReports").textContent = pending;
    document.getElementById("resolvedReports").textContent = resolved;
}

// ===== Live Update (If Admin changes a status) =====
window.addEventListener("storage", function (e) {
    if (e.key === "ecoReports") {
        reports = JSON.parse(e.newValue) || [];
        displayReports();
    }
});

// ===== Display existing reports when page loads =====
displayReports();