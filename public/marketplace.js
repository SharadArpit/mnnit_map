let currentUser = { id: null, username: null };

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Get current user info from token
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const decoded = jwt_decode(token);
            currentUser.id = decoded.id;
            currentUser.username = decoded.username;
        } catch (e) {
            console.error('Error decoding token:', e);
        }
    } else {
        // Redirect to login if not authenticated
        window.location.href = '/index.html';
    }

    // Set up event listeners
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = '/';
    });

    document.getElementById('adForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await postAd();
    });

    // Load initial ads
    loadAds();
});

// Load ads from server
async function loadAds() {
    try {
        const response = await fetch('/ads');
        if (!response.ok) throw new Error('Failed to load ads');
        
        const ads = await response.json();
        const adsContainer = document.getElementById('adsContainer');
        adsContainer.innerHTML = '';

        if (ads.length === 0) {
            adsContainer.innerHTML = '<p>No advertisements found.</p>';
            return;
        }

        ads.forEach(ad => {
            const adCard = document.createElement('div');
            adCard.className = 'col-md-6 col-lg-4 mb-4';
            adCard.innerHTML = `
                <div class="card h-100 ad-card">
                    <div class="card-body">
                        <h5 class="card-title">${ad.title}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">
                            ₹${ad.price} • ${ad.category.charAt(0).toUpperCase() + ad.category.slice(1)}
                        </h6>
                        <p class="card-text">${ad.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">Posted by ${ad.username}</small>
                            <button class="btn btn-sm btn-outline-primary contact-btn" 
                                    data-contact="${ad.contact}">
                                Contact
                            </button>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent">
                        <small class="text-muted">
                            ${new Date(ad.createdAt).toLocaleString()}
                        </small>
                        ${currentUser.id && ad.userId === currentUser.id ? `
                        <button class="btn btn-sm btn-outline-danger float-right delete-ad" 
                                data-id="${ad._id}">
                            Delete
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            adsContainer.appendChild(adCard);
        });

        // Add event listeners
        document.querySelectorAll('.contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const contactInfo = e.target.getAttribute('data-contact');
                alert(`Contact: ${contactInfo}`);
            });
        });

        document.querySelectorAll('.delete-ad').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const adId = e.target.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this ad?')) {
                    await deleteAd(adId);
                }
            });
        });

    } catch (error) {
        console.error('Error loading ads:', error);
        alert('Failed to load ads. Please try again later.');
    }
}

// Post new ad
async function postAd() {
    const title = document.getElementById('adTitle').value;
    const description = document.getElementById('adDescription').value;
    const price = document.getElementById('adPrice').value;
    const category = document.getElementById('adCategory').value;
    const contact = document.getElementById('adContact').value;

    if (!title || !description || !price || !contact) {
        alert('Please fill all required fields');
        return;
    }

    try {
        const response = await fetch('/ads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                title,
                description,
                price,
                category,
                contact
            })
        });

        if (!response.ok) throw new Error('Failed to post ad');

        // Clear form and reload ads
        document.getElementById('adForm').reset();
        await loadAds();
        alert('Advertisement posted successfully!');
    } catch (error) {
        console.error('Error posting ad:', error);
        alert('Failed to post ad. Please try again.');
    }
}

// Delete ad
async function deleteAd(adId) {
    try {
        const response = await fetch(`/ads/${adId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete ad');

        await loadAds();
        alert('Advertisement deleted successfully!');
    } catch (error) {
        console.error('Error deleting ad:', error);
        alert('Failed to delete ad. Please try again.');
    }
}