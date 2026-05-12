let splashMarker = null;
let splashTimer = null;
let splashClickCount = 0;
let splashClickTimer = null;

/**
 * Calculate bearing from one coordinate to another
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Bearing in degrees
 */
function calcBearing(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/**
 * Generate training exercise flight path waypoints relative to user location
 * @param {number} baseLat - User latitude
 * @param {number} baseLon - User longitude
 * @returns {Array} Array of [lat, lon] waypoints
 */
function generateTrainingPath(baseLat, baseLon) {
  const pts = [];
  const zoom = globalThis.map ? globalThis.map.getZoom() : CONFIG.MAP_ZOOM_DEFAULT;
  const s = Math.pow(2, CONFIG.MAP_ZOOM_DEFAULT - zoom);
  const cRLat = 0.035 * s, cRLon = 0.025 * s;
  const legBase = baseLat - 0.07 * s;
  const legTop  = baseLat + 0.07 * s;
  const legOff  = 0.015 * s;
  const tipRLat = 0.04 * s, tipRLon = legOff;
  const lCLon   = baseLon - legOff - cRLon;
  const rCLon   = baseLon + legOff + cRLon;
  const entryLat = baseLat - 0.28 * s;

  // Entry — inbound from off-screen south heading north to left circle rightmost
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([entryLat + t * (legBase - entryLat), baseLon - legOff]);
  }

  // Left approach — CCW from rightmost; exits rightmost heading north
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    pts.push([legBase + Math.sin(a) * cRLat, lCLon + Math.cos(a) * cRLon]);
  }

  // Right approach — CW from leftmost; exits leftmost heading north
  for (let i = 1; i <= 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI * 2;
    pts.push([legBase + Math.sin(a) * cRLat, rCLon + Math.cos(a) * cRLon]);
  }

  // Departure leg — straight north along right side
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    pts.push([legBase + t * (legTop - legBase), baseLon + legOff]);
  }

  // Holding pattern — CCW semicircle right to left through apex
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * Math.PI;
    pts.push([legTop + Math.sin(a) * tipRLat, baseLon + Math.cos(a) * tipRLon]);
  }

  // Descent — straight south along left side
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    pts.push([legTop - t * (legTop - legBase), baseLon - legOff]);
  }

  // Departure — exits south off screen from left leg base
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    pts.push([legBase - t * (legBase - entryLat), baseLon - legOff]);
  }

  return pts;
}

/**
 * Run animated training exercise flight pattern on the map
 */
function runTrainingExercise() {
  if (!globalThis.userLocation?.lat || !globalThis.userLocation?.lon) return;
  if (splashMarker) return;

  const path = generateTrainingPath(globalThis.userLocation.lat, globalThis.userLocation.lon);
  let idx = 0;

  splashTimer = setInterval(() => {
    if (idx >= path.length) {
      clearInterval(splashTimer);
      splashTimer = null;
      if (splashMarker && globalThis.map) {
        globalThis.map.removeLayer(splashMarker);
        splashMarker = null;
      }
      return;
    }

    const [lat, lon] = path[idx];
    const next = path[Math.min(idx + 1, path.length - 1)];
    const heading = calcBearing(lat, lon, next[0], next[1]);
    const iconHTML = createPlaneIconHTML(heading, '#7cfc00').replace(
      /style="transform: rotate\([^"]*\);"/,
      `style="transform: rotate(${heading}deg); transition: none;"`
    );

    if (splashMarker) {
      splashMarker.setLatLng([lat, lon]);
      const icon = L.divIcon({
        className: 'plane-marker-icon plane-far',
        html: iconHTML,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      splashMarker.setIcon(icon);
    } else {
      const icon = L.divIcon({
        className: 'plane-marker-icon plane-far',
        html: iconHTML,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      splashMarker = L.marker([lat, lon], { icon, zIndexOffset: 500 }).addTo(globalThis.map);
    }

    idx++;
  }, 150);

  debug('Training exercise started');
}

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.getElementById('logo');
  if (!logo) return;

  logo.addEventListener('click', () => {
    splashClickCount++;
    clearTimeout(splashClickTimer);
    splashClickTimer = setTimeout(() => { splashClickCount = 0; }, 600);

    if (splashClickCount >= 3) {
      splashClickCount = 0;
      clearTimeout(splashClickTimer);
      runTrainingExercise();
    }
  });
});
