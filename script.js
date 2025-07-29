const clientId = 'cc57db2e4e4d4f1ca09307a25f8a2e50';
// const redirectUri = "http://localhost:3000/callback.html"; // Change to your GitHub Pages URI for deployment
const redirectUri = location.origin + location.pathname.replace(/\/[^/]*$/, '') + '/callback.html';
const scopes = [
  'user-read-recently-played',
  'user-library-read',
  'user-follow-read',
  'user-read-private',
  'playlist-read-private',
  'user-top-read'
].join(' ');

function redirectToSpotify() {
  const codeVerifier = generateCodeVerifier();
  generateCodeChallenge(codeVerifier).then(codeChallenge => {
    localStorage.setItem('code_verifier', codeVerifier);
    const args = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });
    window.location = 'https://accounts.spotify.com/authorize?' + args;
  });
}

function generateCodeVerifier() {
  const array = new Uint32Array(56);
  window.crypto.getRandomValues(array);
  return btoa(Array.from(array).map(n => String.fromCharCode(n % 256)).join('')).replace(/[^a-zA-Z0-9]/g, '');
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}



// This runs only on callback.html
if (location.pathname.endsWith('callback.html') && location.search.includes('code=')) {
  const code = new URLSearchParams(location.search).get('code');
  const codeVerifier = localStorage.getItem('code_verifier');

  fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })
  })
    .then(res => res.json())
    .then(data => {
      localStorage.setItem('access_token', data.access_token);
      window.location = 'index.html';
    });
}

// check if the user is logged in
document.addEventListener('DOMContentLoaded', () => {
  // Try to get token from localStorage or URL hash
  let token = localStorage.getItem('access_token');

  // If not in storage, try to parse from URL hash
  if (!token && window.location.hash) {
    const hash = window.location.hash;
    const match = hash.match(/access_token=([^&]*)/);
    if (match) {
      token = match[1];
      localStorage.setItem('access_token', token);
      // Optional: clear hash from URL
      history.replaceState(null, null, ' ');
    }
  }

  if (token) {
    document.getElementById('login-message').style.display = 'none';
    document.getElementById('login-button').style.display = 'none';
    document.getElementById('logout-button').style.display = 'flex';
  } else {
    document.getElementById('login-message').style.display = 'flex';
    document.getElementById('login-button').style.display = 'flex';
    document.getElementById('logout-button').style.display = 'none';
    document.getElementById('profile-pic').style.display = 'none';
  }
});

// Log out function
function logout() {
  localStorage.removeItem('access_token');
  location.reload(); // reload page to reset state
}


// Main dashboard logic (runs on index.html)
if (location.pathname.endsWith('index.html') && localStorage.getItem('access_token')) {
  const token = localStorage.getItem('access_token');
  const headers = { Authorization: 'Bearer ' + token };

  // 1. Liked Songs Count
  fetch('https://api.spotify.com/v1/me/tracks?limit=1', { headers })
    .then(res => res.json())
    .then(data => {
      document.getElementById('liked-count').textContent = data.total;
    });

  // 2. Followers Count
  fetch('https://api.spotify.com/v1/me', { headers })
    .then(res => res.json())
    .then(data => {
      document.getElementById('followers-count').textContent = data.followers.total;
      document.getElementById('username').textContent = data.display_name;
      if (data.images && data.images.length > 0) {
        document.getElementById('profile-pic').src = data.images[0].url;
      }
    });

  // 3. Following Artists Count
  fetch('https://api.spotify.com/v1/me/following?type=artist', { headers })
    .then(res => res.json())
    .then(data => {
      document.getElementById('following-count').textContent = data.artists.total;
    });

  // 4. Playlist Count
  fetch('https://api.spotify.com/v1/me/playlists?limit=1', { headers })
    .then(res => res.json())
    .then(data => {
      document.getElementById('playlists-count').textContent = data.total;
    });

  // 5. Recently Played
  fetch('https://api.spotify.com/v1/me/player/recently-played?limit=6', { headers })
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('recent-tracks');
      data.items.forEach(item => {
        const li = document.createElement('li');
        const artistNames = item.track.artists.map(a => a.name).join(', ');
        const trackName = item.track.name;

        li.innerHTML = `
        <img src="${item.track.album.images[2]?.url}" alt="" />
        <div>
          <strong>${artistNames}</strong><br>
          <span>${trackName}</span>
        </div>
      `;
        list.appendChild(li);
      });
    });

  // 6. Top Tracks
  fetch('https://api.spotify.com/v1/me/top/tracks?limit=6&time_range=long_term', { headers })
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('top-tracks');
      data.items.forEach(item => {
        const li = document.createElement('li');
        const artistNames = item.artists.map(a => a.name).join(', ');
        const trackName = item.name;

        li.innerHTML = `
        <img src="${item.album.images[2]?.url}" alt="" />
        <div>
          <strong>${artistNames}</strong><br>
          <span>${trackName}</span>
        </div>
      `;
        list.appendChild(li);
      });
    });

  // 7. Top Genres
  fetch('https://api.spotify.com/v1/me/top/artists?limit=30&time_range=long_term', { headers })
    .then(res => res.json())
    .then(data => {
      const genreSet = new Set();

      data.items.forEach(artist => {
        artist.genres.forEach(genre => {
          genreSet.add(genre);
        });
      });

      const topGenres = Array.from(genreSet).slice(0, 20);
      const genreList = document.getElementById('top-genres');
      topGenres.forEach((genre, index) => {
        const li = document.createElement('li');
        li.textContent = genre;
        genreList.appendChild(li);
      });
    });


  // 8. Recommendations based on top tracks
  fetch('https://api.spotify.com/v1/me/top/tracks?limit=1', { headers }) // Limit to 1 to get the first track quickly
    .then(res => {
      if (!res.ok) throw new Error(`Top tracks error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      const list = document.getElementById('top-tracks');
      data.items.forEach(item => {
        const li = document.createElement('li');
        const artistNames = item.artists.map(a => a.name).join(', ');
        const trackName = item.name;
        const img = item.album.images[2]?.url || '';

        li.innerHTML = `
        <img src="${img}" alt="" />
        <div>
          <strong>${artistNames}</strong><br>
          <span>${trackName}</span>
        </div>
      `;
        list.appendChild(li);
      });

      if (data.items.length > 0) {
        const firstArtistName = data.items[0].artists[0].name;
        const searchUrl = `https://api.spotify.com/v1/search?q=artist:"${encodeURIComponent(firstArtistName)}"&type=track&limit=6`;
        return fetch(searchUrl, { headers });
      } else {
        console.log("No top tracks found.");
        return null;
      }
    })
    .then(res => {
      if (!res) return null;
      if (!res.ok) throw new Error(`Search error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!data || !data.tracks || !data.tracks.items) return;

      const recommendationsList = document.getElementById('recommendations-list');
      if (!recommendationsList) {
        console.error("Element with ID 'recommendations-list' not found.");
        return;
      }

      data.tracks.items.forEach(track => {
        const li = document.createElement('li');
        const artistNames = track.artists.map(a => a.name).join(', ');
        const trackName = track.name;
        const img = track.album.images[2]?.url || '';

        li.innerHTML = `
        <img src="${img}" alt="" />
        <div>
          <strong>${artistNames}</strong><br>
          <span>${trackName}</span>
        </div>
      `;
        recommendationsList.appendChild(li);
      });
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });

    
    // 9. Embed Spoify player
    fetch('https://api.spotify.com/v1/me/top/tracks?limit=1&time_range=medium_term', { headers })
  .then(res => {
    if (!res.ok) throw new Error(`Spotify error: ${res.status}`);
    return res.json();
  })
  .then(data => {
    if (!data.items || !data.items.length) {
      console.log("No top tracks found.");
      return;
    }

    const albumId = data.items[0].album.id;
    const iframeContainer = document.getElementById('spotify-embed');
    iframeContainer.innerHTML = `
      <iframe
        src="https://open.spotify.com/embed/album/${albumId}?utm_source=generator"
        style="top: 0; left: 0; width: 100%; height: 100%; position: absolute; border: 0;"
        allowfullscreen
        allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture">
      </iframe>
    `;
  })
  .catch(err => {
    console.error("Failed to load top album:", err);
  });

}
