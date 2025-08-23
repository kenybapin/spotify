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

// Helper: get token safely
function getStoredToken() {
  const token = localStorage.getItem('access_token');
  const expiry = localStorage.getItem('token_expiry');

  if (!token || !expiry) return null;

  if (Date.now() > parseInt(expiry, 10)) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expiry');
    return null;
  }

  return token;
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
      localStorage.setItem('token_expiry', Date.now() + data.expires_in * 1000);
      window.location = 'index.html';
    });
}

// check if the user is logged in
document.addEventListener('DOMContentLoaded', () => {
  let token = getStoredToken();

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
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_expiry');
  location.reload();
}

// Main dashboard logic (runs on index.html)
if (location.pathname.endsWith('index.html')) {
  const token = getStoredToken();
  if (!token) {
    console.log("No valid token, please log in again.");
  } else {
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
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=4', { headers })
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
    fetch('https://api.spotify.com/v1/me/top/tracks?limit=4&time_range=long_term', { headers })
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

    // 8. Top Albums
    fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term', { headers })
      .then(res => res.json())
      .then(data => {
        const albumMap = new Map();

        data.items.forEach(track => {
          const album = track.album;
          if (!albumMap.has(album.id)) {
            albumMap.set(album.id, { ...album, count: 0 });
          }
          albumMap.get(album.id).count++;
        });

        const topAlbums = Array.from(albumMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 2);

        const list = document.getElementById('top-album');
        
        topAlbums.forEach(album => {
          const li = document.createElement('li');

          const albumImage = album.images[1]?.url || '';
          const albumLink = `<a href="https://open.spotify.com/album/${album.id}" target="_blank"><img src="${albumImage}" alt="${album.name}" /></a>`;
          const artistLinks = album.artists.map(a => `<a href="https://open.spotify.com/artist/${a.id}" target="_blank">${a.name}</a>`).join(', ');

          li.innerHTML = `
            ${albumLink}
            <div>
              <strong>${artistLinks}</strong><br>
              <span>${album.name}</span>
            </div>
          `;

          list.appendChild(li);
        });
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
}

// Share button functionality
const shareBtn = document.getElementById("shareBtn");
const previewModal = document.getElementById("previewModal");
const previewImg = document.getElementById("previewImg");
const closePreview = document.getElementById("closePreview");
const shareConfirm = document.getElementById("shareConfirm");
const copyConfirm = document.getElementById("copyConfirm");
const downloadConfirm = document.getElementById("downloadConfirm");

shareBtn.addEventListener("click", async () => {
  const container = document.querySelector(".container");
  const connectionDiv = document.querySelector(".connection");
  const username = document.getElementById("username")?.textContent || "spotify-user";

  if (connectionDiv) connectionDiv.style.display = "none";

  html2canvas(container, { useCORS: true, logging: false }).then((canvas) => {
    if (connectionDiv) connectionDiv.style.display = "";

    previewImg.src = canvas.toDataURL("image/png");
    previewModal.style.display = "flex";

    canvas.toBlob((blob) => {
      window.shareFile = new File([blob], `${username}-spotify-stats.png`, { type: "image/png" });
      window.shareBlob = blob;
      window.shareUsername = username;
    });
  });
});

closePreview.addEventListener("click", () => {
  previewModal.style.display = "none";
});

shareConfirm.addEventListener("click", async () => {
  const file = window.shareFile;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: "My Spotify Stats 🎵", files: [file] });
    }
      previewModal.style.display = "none";
});

copyConfirm.addEventListener("click", async () => {
  const blob = window.shareBlob;
    if (navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } 
  previewModal.style.display = "none";
});

downloadConfirm.addEventListener("click", () => {
  const blob = window.shareBlob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${window.shareUsername}-spotify-stats.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  previewModal.style.display = "none";
});
