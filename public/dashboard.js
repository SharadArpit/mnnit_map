const map = L.map('map').setView([25.4920, 81.8639], 17);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// GLOBAL VARIABLES
let shopMarkers = [];
let drawnPolyline = null;
let routeStart = null;
let routeEnd = null;
let currentLocationMarker = null;

// --- FETCH SHOPS + PREDICTION ---
async function fetchShops() {
  try {
    const res = await fetch('/shops');
    const shops = await res.json();

    shopMarkers.forEach(marker => map.removeLayer(marker));
    shopMarkers = [];

    if (document.getElementById('toggleShops').checked) {
      for (const shop of shops) {
        let predictedStatus = 'Loading...';
        try {
          const predRes = await fetch(`/shops/${shop._id}/predict`);
          if (predRes.ok) {
            const predData = await predRes.json();
            predictedStatus = predData.predictedStatus || 'Unknown';
          }
        } catch (err) {
          predictedStatus = 'Prediction error';
        }

        const updatedByText = shop.updatedBy || "Unknown";
        const updatedTime = new Date(shop.updatedAt).toLocaleString();
        const voteText = `Votes: ${shop.votes || 0}`;
        const voted = localStorage.getItem(`voted_${shop._id}`) === 'true';
        const voteBtnDisabled = voted ? 'disabled' : '';

        const popupContent = `
          <b>${shop.name}</b><br>
          Status: <span id="status-${shop._id}">${shop.status}</span><br>
          Predicted: ${predictedStatus}<br>
          Updated by: ${updatedByText}<br>
          At: ${updatedTime}<br>
          <span id="votes-${shop._id}">${voteText}</span><br><br>
          <button onclick="updateStatus('${shop._id}')">Update Status</button>
          <button onclick="voteStatus('${shop._id}')" ${voteBtnDisabled}>Vote</button>
        `;

        const marker = L.marker([shop.location.lat, shop.location.lng]).addTo(map);
        marker.bindPopup(popupContent);
        shopMarkers.push(marker);
      }
    }
  } catch (err) {
    console.error('Error fetching shops:', err);
  }
}

function updateStatus(shopId) {
  const statusEl = document.getElementById(`status-${shopId}`);
  const updatedByEl = document.getElementById(`updatedBy-${shopId}`);
  const updatedAtEl = document.getElementById(`updatedAt-${shopId}`);
  const currentStatus = statusEl.textContent.toLowerCase();
  const newStatus = currentStatus === 'open' ? 'closed' : 'open';

  fetch(`/shops/${shopId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ status: newStatus })
  })
    .then(res => res.json())
    .then(shop => {
      localStorage.removeItem(`voted_${shopId}`);
      fetchShops();
    })
    .catch(err => {
      console.error('Error updating status:', err);
    });
}

function voteStatus(shopId) {
  fetch(`/shops/${shopId}/vote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
    .then(res => res.json())
    .then(data => {
      localStorage.setItem(`voted_${shopId}`, 'true');
      fetchShops();
    })
    .catch(err => {
      console.error('Error voting:', err);
    });
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}

// --- CLASSROOM CHATBOT ---
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatbotWidget = document.getElementById('chatbot-widget');
const chatbotHeader = document.getElementById('chatbot-header');
const chatbotBody = document.getElementById('chatbot-body');
const chatbotToggle = document.getElementById('chatbot-toggle');
let isOpen = false;

function appendMessage(text, sender = 'bot') {
  const messageDiv = document.createElement('div');
  messageDiv.style.marginBottom = '8px';
  messageDiv.style.padding = '6px 10px';
  messageDiv.style.borderRadius = '10px';
  messageDiv.style.maxWidth = '80%';
  messageDiv.style.wordWrap = 'break-word';
  messageDiv.style.backgroundColor = sender === 'user' ? '#667eea' : '#e2e2e2';
  messageDiv.style.color = sender === 'user' ? 'white' : 'black';
  messageDiv.style.marginLeft = sender === 'user' ? 'auto' : '0';
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
  
    appendMessage(message, 'user');
    chatInput.value = '';
    sendBtn.disabled = true;
  
    try {
      const res = await fetch('/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
  
      const data = await res.json();
      appendMessage(data.reply || 'Sorry, I didn’t understand that.', 'bot');
  
      // 📍 Case 1: "Where is ROOM" query
      if (data.location && data.room) {
        const targetLatLng = L.latLng(data.location.lat, data.location.lng);
        const classroomMarker = L.marker(targetLatLng, {
          title: data.room,
          icon: L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
            iconSize: [25, 25],
            iconAnchor: [12, 25],
          })
        }).addTo(map).bindPopup(`${data.room}`).openPopup();
  
        map.setView(targetLatLng, 18);
  
        // 🧭 Try navigation from current location
        if (currentLocationMarker) {
          const currentCoords = currentLocationMarker.getLatLng();
  
          const navRes = await fetch('/navigate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: {
                lat: currentCoords.lat,
                lng: currentCoords.lng,
                flr: 'Ground'
              },
              to: data.room
            })
          });
  
          const pathData = await navRes.json();
  
          if (!pathData.path || !Array.isArray(pathData.path)) {
            appendMessage('⚠️ Could not find a navigation path.', 'bot');
          } else {
            if (drawnPolyline) map.removeLayer(drawnPolyline);
            const latlngs = pathData.path.map(p => {
              const coords = Array.isArray(p) ? p : p.split(',').map(Number);
              return L.latLng(coords[0], coords[1]);
            });
            drawnPolyline = L.polyline(latlngs, { color: 'blue', weight: 5 }).addTo(map);
            map.fitBounds(drawnPolyline.getBounds());
  
            // 📏 Distance and Time
            let totalDistance = 0;
            for (let i = 0; i < latlngs.length - 1; i++) {
              totalDistance += latlngs[i].distanceTo(latlngs[i + 1]);
            }
  
            const km = (totalDistance / 1000).toFixed(2);
            const meters = totalDistance.toFixed(0);
  
            const walkingSpeed = 1.4; // m/s
            const walkingTimeSec = totalDistance / walkingSpeed;
            const minutes = Math.floor(walkingTimeSec / 60);
            const seconds = Math.round(walkingTimeSec % 60);
  
            appendMessage(`📏 Distance: ${km} km (${meters} meters)\n⏱️ Estimated Time: ${minutes} min ${seconds} sec`, 'bot');
          }
        }
      }
  
      // 🚦 Case 2: "Navigate from X to Y"
      else if (data.from && data.to && data.fromLocation && data.toLocation) {
        const navRes = await fetch('/navigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: data.from,
            to: data.to
          })
        });
  
        const pathData = await navRes.json();
  
        if (!pathData.path || !Array.isArray(pathData.path)) {
          appendMessage('⚠️ Could not find a navigation path.', 'bot');
        } else {
          if (drawnPolyline) map.removeLayer(drawnPolyline);
          const latlngs = pathData.path.map(p => {
            const coords = Array.isArray(p) ? p : p.split(',').map(Number);
            return L.latLng(coords[0], coords[1]);
          });
          drawnPolyline = L.polyline(latlngs, { color: 'blue', weight: 5 }).addTo(map);
          map.fitBounds(drawnPolyline.getBounds());
  
          // Start and end markers
          L.marker([data.fromLocation.lat, data.fromLocation.lng])
            .addTo(map)
            .bindPopup(`Start: ${data.from}`)
            .openPopup();
  
          L.marker([data.toLocation.lat, data.toLocation.lng])
            .addTo(map)
            .bindPopup(`End: ${data.to}`)
            .openPopup();
  
          // 📏 Distance and Time
          let totalDistance = 0;
          for (let i = 0; i < latlngs.length - 1; i++) {
            totalDistance += latlngs[i].distanceTo(latlngs[i + 1]);
          }
  
          const km = (totalDistance / 1000).toFixed(2);
          const meters = totalDistance.toFixed(0);
  
          const walkingSpeed = 1.4; // m/s
          const walkingTimeSec = totalDistance / walkingSpeed;
          const minutes = Math.floor(walkingTimeSec / 60);
          const seconds = Math.round(walkingTimeSec % 60);
  
          appendMessage(`📏 Distance: ${km} km (${meters} meters)\n⏱️ Estimated Time: ${minutes} min ${seconds} sec`, 'bot');
        }
      }
  
    } catch (err) {
      appendMessage('⚠️ Error contacting chatbot or navigation server.', 'bot');
      console.error(err);
    }
  
    sendBtn.disabled = false;
  }
  
  
function toggleChatbot() {
  isOpen = !isOpen;
  chatbotBody.style.display = isOpen ? 'flex' : 'none';
  chatbotWidget.style.height = isOpen ? '400px' : '50px';
  chatbotToggle.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

async function loadSavedRoutes() {
    try {
      const res = await fetch('/routes');
      const routes = await res.json();
  
      routes.forEach(route => {
        if (route.geojson && route.geojson.type === 'FeatureCollection') {
          L.geoJSON(route.geojson, {
            style: {
              color: 'green',
              weight: 3,
              dashArray: '5,5'
            },
            onEachFeature: function (feature, layer) {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(`Route: ${feature.properties.name}`);
              }
            }
          }).addTo(map);
        }
      });
    } catch (err) {
      console.error('Error loading saved routes:', err);
    }
  }
  

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('toggleShops').addEventListener('change', fetchShops);
  document.getElementById('logout-btn').addEventListener('click', logout);

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
  chatbotHeader.addEventListener('click', toggleChatbot);


  // Geolocation
  let userMarker, accuracyCircle;
  let heading = 0;
  
  // Custom rotating marker using a divIcon
  const userIcon = L.divIcon({
    className: 'user-marker-icon',
    html: `
      <div class="user-heading-container">
        <div class="dot"></div>
        <div class="arrow"></div>
      </div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
  
  // Create or update the marker with heading
  function updateUserMarker(lat, lng) {
    const latlng = L.latLng(lat, lng);
  
    if (!userMarker) {
      userMarker = L.marker(latlng, { icon: userIcon }).addTo(map);
      accuracyCircle = L.circle(latlng, { radius: 5, color: 'blue', fillOpacity: 0.1 }).addTo(map);
    } else {
      userMarker.setLatLng(latlng);
      accuracyCircle.setLatLng(latlng);
    }
  
    // Rotate marker based on heading
    const arrowEl = document.querySelector('.arrow');
    if (arrowEl) {
      arrowEl.style.transform = `rotate(${heading}deg)`;
    }
  
    map.setView(latlng, 18);
  }
  
  // Start tracking location
  navigator.geolocation.watchPosition(
    position => {
      const { latitude, longitude } = position.coords;
      updateUserMarker(latitude, longitude);
    },
    err => {
      console.error('Geolocation error:', err);
      alert('⚠️ Location access is required for live tracking.');
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    }
  );
  
  // Listen to compass direction
  window.addEventListener('deviceorientationabsolute', e => {
    if (e.alpha !== null) heading = e.alpha;
  }, true);
  
  fetchShops();
  loadSavedRoutes(); 
});

// --- DRAW & SAVE ROUTE ---



// --- LOAD SAVED ROUTES ---
