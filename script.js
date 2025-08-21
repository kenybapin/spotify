const clientId = 'cc57db2e4e4d4f1ca09307a25f8a2e50';
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
    localStorage.setItem('code_verifier', codeVerifier); // Changed to localStorage
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
  const codeVerifier = localStorage.getItem('code_verifier'); // Changed to localStorage

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
      localStorage.setItem('access_token', data.access_token); // Changed to localStorage
      window.location = 'index.html';
    });
}

// check if the user is logged in
document.addEventListener('DOMContentLoaded', () => {
  // Try to get token from localStorage or URL hash
  let token = localStorage.getItem('access_token'); // Changed to localStorage

  // If not in storage, try to parse from URL hash
  if (!token && window.location.hash) {
    const hash = window.location.hash;
    const match = hash.match(/access_token=([^&]*)/);
    if (match) {
      token = match[1];
      localStorage.setItem('access_token', token); // Changed to localStorage
      // Optional: clear hash from URL
      history.replaceState(null, null, ' ');
    }
  }

  if (token) {
    document.getElementById('login-message').style.display = 'none';
    document.getElementById('login-button').style.display = 'none';
    document.getElementById('logout-button').style.display = 'flex';
    document.querySelectorAll('.card, .list-section').forEach(element => {
  element.style.filter = 'none';
});
  } else {
    document.getElementById('login-message').style.display = 'flex';
    document.getElementById('login-button').style.display = 'flex';
    document.getElementById('logout-button').style.display = 'none';
    document.getElementById('profile-pic').style.display = 'none';
    document.getElementById('sub-title').style.display = 'none';
    document.getElementById('shareBtn').style.display = 'none';
    document.querySelectorAll('.card, .list-section').forEach(element => {
  element.style.filter = 'grayscale(1)';
});
  }
});

// Log out function
function logout() {
  localStorage.removeItem('access_token'); // Changed to localStorage
  location.reload(); // reload page to reset state
}


// Main dashboard logic (runs on index.html)
if (location.pathname.endsWith('index.html') && localStorage.getItem('access_token')) { // Changed to localStorage
  const token = localStorage.getItem('access_token'); // Changed to localStorage
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
        const artistLinks = item.track.artists.map(a => `<a href="https://open.spotify.com/artist/${a.id}" target="_blank">${a.name}</a>`).join(', ');
        const trackLink = `<a href="https://open.spotify.com/track/${item.track.id}" target="_blank">${item.track.name}</a>`;
        const albumImage = item.track.album.images[2]?.url || '';
        const albumLink = `<a href="https://open.spotify.com/album/${item.track.album.id}" target="_blank"><img src="${albumImage}" alt="${item.track.album.name}" /></a>`;

        li.innerHTML = `
        ${albumLink}
        <div>
          <strong>${artistLinks}</strong><br>
          <span>${trackLink}</span>
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
        const artistLinks = item.artists.map(a => `<a href="https://open.spotify.com/artist/${a.id}" target="_blank">${a.name}</a>`).join(', ');
        const trackLink = `<a href="https://open.spotify.com/track/${item.id}" target="_blank">${item.name}</a>`;
        const albumImage = item.album.images[2]?.url || '';
        const albumLink = `<a href="https://open.spotify.com/album/${item.album.id}" target="_blank"><img src="${albumImage}" alt="${item.album.name}" /></a>`;

        li.innerHTML = `
        ${albumLink}
        <div>
          <strong>${artistLinks}</strong><br>
          <span>${trackLink}</span>
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

    // 8. Top Album
fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term', { headers })
    .then(res => res.json())
    .then(data => {
      const albumMap = new Map();

      data.items.forEach(track => {
        const album = track.album;
        if (!albumMap.has(album.id)) {
          albumMap.set(album.id, {
            ...album,
            count: 0
          });
        }
        albumMap.get(album.id).count++;
      });

      // Sort by play count and keep only the most listened album
      const [topAlbum] = Array.from(albumMap.values())
        .sort((a, b) => b.count - a.count);

      if (topAlbum) {
        const list = document.getElementById('top-album');
        const li = document.createElement('li');

        const albumImage = topAlbum.images[1]?.url || '';
        const albumLink = `<a href="https://open.spotify.com/album/${topAlbum.id}" target="_blank"><img src="${albumImage}" alt="${topAlbum.name}" /></a>`;
        const artistLinks = topAlbum.artists.map(a => `<a href="https://open.spotify.com/artist/${a.id}" target="_blank">${a.name}</a>`).join(', ');

        li.innerHTML = `
          ${albumLink}
          <div>
            <strong>${artistLinks}</strong><br>
            <span>${topAlbum.name}</span>
          </div>
        `;

        list.appendChild(li);
      }
    });

    // 9. User Playlists
      fetch('https://api.spotify.com/v1/me/playlists?limit=10', { headers })
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('user-playlists');
      data.items.forEach(playlist => {
        const li = document.createElement('li');

        const playlistImage = playlist.images[0]?.url || '';
        const playlistLink = `<a href="${playlist.external_urls.spotify}" target="_blank"><img src="${playlistImage}" alt="${playlist.name}" /></a>`;
        const ownerLink = `<a href="https://open.spotify.com/user/${playlist.owner.id}" target="_blank">${playlist.owner.display_name}</a>`;

        li.innerHTML = `
          ${playlistLink}
          <div>
            <strong>${playlist.name}</strong><br>
            <span>by ${ownerLink}</span><br>
            <span>${playlist.tracks.total} tracks</span>
          </div>
        `;

        list.appendChild(li);
      });
    });
  

}

// Share button functionality
document.getElementById("shareBtn").addEventListener("click", async () => {
  const container = document.querySelector(".container"); // the part to capture
  const connectionDiv = document.querySelector(".connection"); // element to hide

  // hide the connection div before capture
  if (connectionDiv) connectionDiv.style.display = "none";

  html2canvas(container, { useCORS: true, logging: false }).then(async (canvas) => {
    // restore the connection div after capture
    if (connectionDiv) connectionDiv.style.display = "";

    canvas.toBlob(async (blob) => {
      const username = document.getElementById("username")?.textContent || "spotify-user";
      const file = new File([blob], `${username}-spotify-stats.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "My Spotify Stats 🎵",
            files: [file]
          });
        } catch (err) {
          console.error("Share failed:", err);
        }
      } else {
        // fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${username}-spotify-stats.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  });
});
