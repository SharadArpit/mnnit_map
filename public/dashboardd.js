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

    if (data.location) {
      const marker = L.marker([data.location.lat, data.location.lng], {
        title: data.room
      }).addTo(map);
      marker.bindPopup(`${data.room}`).openPopup();
      map.setView([data.location.lat, data.location.lng], 19);
    }
  } catch (err) {
    appendMessage('Error contacting chatbot server.', 'bot');
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('toggleShops').addEventListener('change', fetchShops);
  document.getElementById('logout-btn').addEventListener('click', logout);

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
  chatbotHeader.addEventListener('click', toggleChatbot);

  // Geolocation
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (currentLocationMarker) map.removeLayer(currentLocationMarker);
      currentLocationMarker = L.marker([lat, lng], { icon: L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [25, 25],
        iconAnchor: [12, 25]
      }) }).addTo(map).bindPopup("You are here").openPopup();
    });
  }

  fetchShops();
  loadSavedRoutes();
});

// --- DRAW & SAVE ROUTE ---


// --- LOAD SAVED ROUTES ---
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
  