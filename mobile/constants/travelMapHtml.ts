/**
 * Leaflet map HTML for the Travel screen.
 * Exported as a string and loaded via WebView source={{ html }}.
 * Uses OpenStreetMap tiles — free, no API key required.
 */
export const TRAVEL_MAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Travel Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%; background: #f3f4f6;
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #map { width: 100%; height: 100%; }

    .te-pin-wrap {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
    }
    .te-pin {
      width: 22px; height: 22px;
      background: #FFD900;
      border: 3px solid #111827;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    }
    .te-pin-dot {
      width: 7px; height: 7px;
      background: #111827;
      border-radius: 50%;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
    }

    .leaflet-popup-content-wrapper {
      border-radius: 16px !important;
      padding: 0 !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18) !important;
      border: none !important;
      overflow: hidden;
    }
    .leaflet-popup-content { margin: 0 !important; width: auto !important; min-width: 200px; }
    .leaflet-popup-tip-container { display: none; }
    .popup-card { padding: 14px 16px; background: #fff; }
    .popup-title {
      font-size: 14px; font-weight: 700; color: #111827;
      margin-bottom: 3px; line-height: 1.3;
    }
    .popup-date {
      font-size: 11px; color: #6B7280; margin-bottom: 10px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .popup-badge {
      display: inline-block; font-size: 10px; font-weight: 700;
      color: #2563EB; background: #EFF6FF;
      border-radius: 6px; padding: 2px 7px; margin-bottom: 6px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .popup-delete {
      width: 100%; padding: 8px;
      background: #FEE2E2; color: #EF4444;
      border: none; border-radius: 8px;
      font-size: 12px; font-weight: 600;
      cursor: pointer;
    }
    .te-pin-wish {
      background: #2563EB;
      border-color: #1D4ED8;
    }
    .te-pin-dot-wish {
      background: #fff;
    }

    /* ── Preview (search result) pin ── */
    .te-pin-preview {
      background: #6B7280;
      border-color: #374151;
    }
    .te-pin-dot-preview {
      background: #fff;
    }
    .te-preview-pulse {
      position: absolute;
      top: -6px; left: -6px;
      width: 34px; height: 34px;
      border-radius: 50%;
      background: rgba(107,114,128,0.25);
      animation: preview-pulse 1.4s ease-out infinite;
    }
    @keyframes preview-pulse {
      0%   { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(2);   opacity: 0; }
    }

    /* ── Live location dot ── */
    .me-wrap { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
    .me-ring {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: rgba(59,130,246,0.2);
      display: flex; align-items: center; justify-content: center;
      animation: me-pulse 2s ease-out infinite;
    }
    .me-dot {
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #2563EB;
      border: 2.5px solid #fff;
      box-shadow: 0 1px 6px rgba(37,99,235,0.6);
    }
    @keyframes me-pulse {
      0%   { transform: scale(1);   opacity: 1; }
      70%  { transform: scale(2.2); opacity: 0; }
      100% { transform: scale(1);   opacity: 0; }
    }

    /* ── Trip route waypoint dot ── */
    .wp-dot-wrap { width: 16px; height: 16px; display:flex; align-items:center; justify-content:center; }
    .wp-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #F97316; border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(249,115,22,0.6);
    }
    .wp-dot-past { background: rgba(249,115,22,0.55); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      center: [20.5937, 78.9629], zoom: 5,
      zoomControl: true, attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, keepBuffer: 4,
    }).addTo(map);

    var markers = {};

    function fmt(dateStr) {
      if (!dateStr) return '';
      var p = dateStr.split('-');
      if (p.length !== 3) return dateStr;
      var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return mo[parseInt(p[1],10)-1] + ' ' + parseInt(p[2],10) + ', ' + p[0];
    }
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function pinIcon() {
      return L.divIcon({
        html: '<div class="te-pin-wrap"><div class="te-pin"><div class="te-pin-dot"></div></div></div>',
        className: '', iconSize: [32,32], iconAnchor: [16,32], popupAnchor: [0,-34],
      });
    }
    function wishlistIcon() {
      return L.divIcon({
        html: '<div class="te-pin-wrap"><div class="te-pin te-pin-wish"><div class="te-pin-dot te-pin-dot-wish"></div></div></div>',
        className: '', iconSize: [32,32], iconAnchor: [16,32], popupAnchor: [0,-34],
      });
    }
    function popupHtml(id, title, date) {
      return '<div class="popup-card">'
        + '<div class="popup-title">'+esc(title)+'</div>'
        + '<div class="popup-date">Visited '+fmt(date)+'</div>'
        + '<button class="popup-delete" onclick="del(\\''+id+'\\')">✕ Remove place</button>'
        + '</div>';
    }
    function wishlistPopupHtml(id, title) {
      return '<div class="popup-card">'
        + '<div class="popup-badge">Want to Visit</div>'
        + '<div class="popup-title">'+esc(title)+'</div>'
        + '<button class="popup-delete" onclick="del(\\''+id+'\\')">✕ Remove</button>'
        + '</div>';
    }

    window.addMarker = function(id, lat, lng, title, date) {
      if (markers[id]) return;
      var m = L.marker([lat,lng], { icon: pinIcon() });
      m.bindPopup(popupHtml(id, title, date), { maxWidth: 260, minWidth: 200 });
      m.addTo(map);
      markers[id] = m;
    };
    window.addWishlistMarker = function(id, lat, lng, title) {
      if (markers[id]) return;
      if (!lat || !lng || (lat === 0 && lng === 0)) return; // no coords, skip
      var m = L.marker([lat,lng], { icon: wishlistIcon() });
      m.bindPopup(wishlistPopupHtml(id, title), { maxWidth: 260, minWidth: 200 });
      m.addTo(map);
      markers[id] = m;
    };
    window.removeMarker = function(id) {
      if (markers[id]) { map.removeLayer(markers[id]); delete markers[id]; }
    };
    window.fitToMarkers = function() {
      var keys = Object.keys(markers);
      if (!keys.length) return;
      if (keys.length === 1) { map.setView(markers[keys[0]].getLatLng(), 12); return; }
      map.fitBounds(L.featureGroup(Object.values(markers)).getBounds().pad(0.3));
    };
    window.clearMarkers = function() {
      Object.keys(markers).forEach(function(id){ map.removeLayer(markers[id]); });
      markers = {};
    };

    // ── Preview pin (shown while confirmation card is open) ──
    var previewMarker = null;
    function previewIcon() {
      return L.divIcon({
        html: '<div class="te-pin-wrap" style="position:relative"><div class="te-preview-pulse"></div><div class="te-pin te-pin-preview"><div class="te-pin-dot te-pin-dot-preview"></div></div></div>',
        className: '', iconSize: [32,32], iconAnchor: [16,32], popupAnchor: [0,-34],
      });
    }
    window.showPreviewPin = function(lat, lng) {
      if (previewMarker) { map.removeLayer(previewMarker); }
      previewMarker = L.marker([lat, lng], { icon: previewIcon(), zIndexOffset: 9500 }).addTo(map);
    };
    window.removePreviewPin = function() {
      if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; }
    };

    // ── Live location ──
    var meMarker = null;
    function meIcon() {
      return L.divIcon({
        html: '<div class="me-wrap"><div class="me-ring"><div class="me-dot"></div></div></div>',
        className: '', iconSize: [24,24], iconAnchor: [12,12],
      });
    }
    window.updateMyLocation = function(lat, lng) {
      if (meMarker) {
        meMarker.setLatLng([lat, lng]);
      } else {
        meMarker = L.marker([lat, lng], { icon: meIcon(), zIndexOffset: 9000 }).addTo(map);
      }
    };
    window.centerOnMe = function(lat, lng) {
      window.updateMyLocation(lat, lng);
      map.setView([lat, lng], 15);
    };

    // ── Active trip route ──
    var activeRoute = null;
    var activeWpMarkers = [];

    function wpDotIcon(isPast) {
      var cls = isPast ? 'wp-dot wp-dot-past' : 'wp-dot';
      return L.divIcon({
        html: '<div class="wp-dot-wrap"><div class="'+cls+'"></div></div>',
        className: '', iconSize: [16,16], iconAnchor: [8,8], popupAnchor: [0,-10],
      });
    }

    window.startTrip = function() {
      if (activeRoute) { map.removeLayer(activeRoute); }
      activeWpMarkers.forEach(function(m){ map.removeLayer(m); });
      activeWpMarkers = [];
      activeRoute = L.polyline([], {
        color: '#F97316', weight: 4, opacity: 0.9, lineJoin: 'round', lineCap: 'round',
      }).addTo(map);
    };

    window.updateTrip = function(lat, lng) {
      if (activeRoute) { activeRoute.addLatLng([lat, lng]); }
    };

    window.addTripWaypoint = function(lat, lng, label, isPast) {
      var m = L.marker([lat, lng], { icon: wpDotIcon(!!isPast), zIndexOffset: 8000 });
      m.bindPopup(
        '<div class="popup-card" style="min-width:140px"><div class="popup-title">'+esc(label)+'</div></div>',
        { maxWidth: 220, minWidth: 140 }
      );
      m.addTo(map);
      if (!isPast) { activeWpMarkers.push(m); }
      return m;
    };

    window.endTrip = function() {
      if (activeRoute) {
        activeRoute.setStyle({ dashArray: '8,6', opacity: 0.55 });
        activeRoute = null;
      }
    };

    // ── Saved (past) trips ──
    var savedTrips = {};

    window.addSavedTrip = function(id, waypointsJson) {
      if (savedTrips[id]) return;
      var wps;
      try { wps = JSON.parse(waypointsJson); } catch(e) { return; }
      if (!Array.isArray(wps) || wps.length === 0) return;
      var latlngs = wps.map(function(w){ return [w.lat, w.lng]; });
      var line = L.polyline(latlngs, {
        color: '#F97316', weight: 3, opacity: 0.4, dashArray: '8,6',
      }).addTo(map);
      var dots = wps.map(function(w){
        return window.addTripWaypoint(w.lat, w.lng, w.p || '', true);
      });
      savedTrips[id] = { line: line, dots: dots };
    };

    window.removeSavedTrip = function(id) {
      if (!savedTrips[id]) return;
      map.removeLayer(savedTrips[id].line);
      savedTrips[id].dots.forEach(function(m){ map.removeLayer(m); });
      delete savedTrips[id];
    };

    function del(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'delete', id:id }));
      }
      window.removeMarker(id);
    }

    document.addEventListener('DOMContentLoaded', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'ready' }));
      }
    });
  </script>
</body>
</html>`;
