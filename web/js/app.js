'use strict';

// ===== Speed Presets =====
var SPEEDS = {
  walk: {
    label: '🚶 散歩モード',
    millis: 180,           // フレーム間隔(ms) — 遅いほどゆっくり
    distance_between_points: 3,  // 地点間隔(m)
    max_points: 200
  },
  drive: {
    label: '🚗 ドライブモード',
    millis: 50,
    distance_between_points: 8,
    max_points: 350
  }
};

// ===== State =====
var map;
var originMarker = null;
var destMarker = null;
var routeLine = null;
var directionsService;
var hyperlapse = null;
var currentSpeed = 'walk';
var totalFrames = 0;
var isPlaying = false;

// ===== Map Initialization (called by Google Maps API callback) =====
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 35.6812, lng: 139.7671 },  // 東京駅
    zoom: 14,
    mapTypeId: 'roadmap',
    styles: darkMapStyle(),
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  directionsService = new google.maps.DirectionsService();

  map.addListener('click', function(e) {
    handleMapClick(e.latLng);
  });
}

function handleMapClick(latLng) {
  if (!originMarker) {
    placeMarker('origin', latLng);
    updateStepUI(2);
    updateInstruction('クリックして終点を選択');
  } else if (!destMarker) {
    placeMarker('destination', latLng);
    updateStepUI(3);
    updateInstruction('');
    document.getElementById('start-btn').disabled = false;
    drawRoute();
  }
}

function placeMarker(type, latLng) {
  var isOrigin = (type === 'origin');
  var marker = new google.maps.Marker({
    position: latLng,
    map: map,
    label: {
      text: isOrigin ? 'A' : 'B',
      color: '#fff',
      fontWeight: 'bold'
    },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: isOrigin ? '#4f8ef7' : '#3dd68c',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    },
    title: isOrigin ? '始点' : '終点'
  });

  if (isOrigin) {
    originMarker = marker;
    document.getElementById('origin-display').textContent =
      latLng.lat().toFixed(5) + ', ' + latLng.lng().toFixed(5);
  } else {
    destMarker = marker;
    document.getElementById('dest-display').textContent =
      latLng.lat().toFixed(5) + ', ' + latLng.lng().toFixed(5);
  }
}

function drawRoute() {
  if (!originMarker || !destMarker) return;
  directionsService.route({
    origin: originMarker.getPosition(),
    destination: destMarker.getPosition(),
    travelMode: google.maps.TravelMode.WALKING
  }, function(result, status) {
    if (status === 'OK') {
      if (routeLine) routeLine.setMap(null);
      var path = result.routes[0].overview_path;
      routeLine = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#4f8ef7',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: map
      });
    }
  });
}

function resetPoint(type) {
  if (type === 'origin') {
    if (originMarker) { originMarker.setMap(null); originMarker = null; }
    document.getElementById('origin-display').textContent = '未選択';
    updateStepUI(1);
    updateInstruction('クリックして始点を選択');
  } else {
    if (destMarker) { destMarker.setMap(null); destMarker = null; }
    document.getElementById('dest-display').textContent = '未選択';
  }
  if (routeLine) { routeLine.setMap(null); routeLine = null; }
  document.getElementById('start-btn').disabled = true;
}

// ===== Speed Selection =====
function setSpeed(mode) {
  currentSpeed = mode;
  document.getElementById('speed-walk').classList.toggle('active', mode === 'walk');
  document.getElementById('speed-drive').classList.toggle('active', mode === 'drive');
}

// ===== Hyperlapse Start =====
function startHyperlapse() {
  if (!originMarker || !destMarker) return;

  showLoading('ルートを計算中...');

  var preset = SPEEDS[currentSpeed];

  hyperlapse = new Hyperlapse(document.getElementById('hyperlapse-container'), {
    zoom: 1,
    use_lookat: false,
    distance_between_points: preset.distance_between_points,
    max_points: preset.max_points,
    millis: preset.millis
  });

  hyperlapse.onError = function(e) {
    hideLoading();
    alert('エラー: ' + (e.message || e));
  };

  hyperlapse.onRouteProgress = function(e) {
    setLoadingMessage('ルートを解析中... ' + e.position);
  };

  hyperlapse.onRouteComplete = function(e) {
    totalFrames = e.points.length;
    setLoadingMessage('パノラマ画像を読み込み中...');
    showProgressBar(totalFrames);
    hyperlapse.load();
  };

  hyperlapse.onLoadProgress = function(e) {
    updateProgressBar(e.position, totalFrames);
  };

  hyperlapse.onLoadComplete = function() {
    hideLoading();
    showPlayer();
    updateSpeedBadge();
    hyperlapse.play();
    isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸';
  };

  hyperlapse.onLoadCanceled = function() {
    hideLoading();
  };

  hyperlapse.onFrame = function(e) {
    var pos = e.position;
    updateHUDProgress(pos, totalFrames);
  };

  hyperlapse.onPlay = function() {
    isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸';
  };

  hyperlapse.onPause = function() {
    isPlaying = false;
    document.getElementById('btn-play').textContent = '▶';
  };

  directionsService.route({
    origin: originMarker.getPosition(),
    destination: destMarker.getPosition(),
    travelMode: google.maps.TravelMode.WALKING
  }, function(result, status) {
    if (status === 'OK') {
      hyperlapse.generate({ route: result });
    } else {
      hideLoading();
      alert('ルートの取得に失敗しました: ' + status);
    }
  });
}

// ===== Playback Controls =====
function hyperlapseControl(action) {
  if (!hyperlapse) return;
  if (action === 'play') {
    if (isPlaying) {
      hyperlapse.pause();
    } else {
      hyperlapse.play();
    }
  } else if (action === 'prev') {
    hyperlapse.pause();
    hyperlapse.prev();
  } else if (action === 'next') {
    hyperlapse.pause();
    hyperlapse.next();
  }
}

function changeSpeedHUD(mode) {
  currentSpeed = mode;
  document.getElementById('hud-walk').classList.toggle('active', mode === 'walk');
  document.getElementById('hud-drive').classList.toggle('active', mode === 'drive');
  if (hyperlapse) {
    hyperlapse.millis = SPEEDS[mode].millis;
  }
  updateSpeedBadge();
}

function cancelLoad() {
  if (hyperlapse) hyperlapse.cancel();
}

function backToSetup() {
  if (hyperlapse) {
    hyperlapse.pause();
    hyperlapse.cancel();
    hyperlapse = null;
  }
  isPlaying = false;
  document.getElementById('player-screen').style.display = 'none';
  document.getElementById('setup-panel').style.display = 'flex';
}

// ===== UI Helpers =====
function showLoading(msg) {
  document.getElementById('loading-message').textContent = msg;
  document.getElementById('loading-progress-wrap').style.display = 'none';
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

function setLoadingMessage(msg) {
  document.getElementById('loading-message').textContent = msg;
}

function showProgressBar(total) {
  document.getElementById('loading-progress-wrap').style.display = 'flex';
  document.getElementById('loading-progress-text').textContent = '0 / ' + total;
  document.getElementById('loading-progress-fill').style.width = '0%';
}

function updateProgressBar(current, total) {
  var pct = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('loading-progress-fill').style.width = pct + '%';
  document.getElementById('loading-progress-text').textContent = current + ' / ' + total;
}

function showPlayer() {
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('player-screen').style.display = 'block';

  // Sync HUD speed buttons
  document.getElementById('hud-walk').classList.toggle('active', currentSpeed === 'walk');
  document.getElementById('hud-drive').classList.toggle('active', currentSpeed === 'drive');

  // Resize hyperlapse canvas to full screen
  if (hyperlapse) {
    hyperlapse.setSize(window.innerWidth, window.innerHeight);
  }
}

function updateSpeedBadge() {
  document.getElementById('speed-badge').textContent = SPEEDS[currentSpeed].label;
}

function updateHUDProgress(current, total) {
  var pct = total > 0 ? (current / total) * 100 : 0;
  document.getElementById('progress-bar-fill').style.width = pct + '%';
  document.getElementById('frame-counter').textContent = current + ' / ' + total;
}

function updateStepUI(activeStep) {
  for (var i = 1; i <= 3; i++) {
    var el = document.getElementById('step-' + i);
    el.classList.remove('active', 'done');
    if (i < activeStep) el.classList.add('done');
    else if (i === activeStep) el.classList.add('active');
  }
}

function updateInstruction(text) {
  var el = document.getElementById('map-instruction');
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

// Handle resize
window.addEventListener('resize', function() {
  if (hyperlapse && document.getElementById('player-screen').style.display !== 'none') {
    hyperlapse.setSize(window.innerWidth, window.innerHeight);
  }
});

// ===== Dark Map Style =====
function darkMapStyle() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1a1d27' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7a82a0' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1117' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252837' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2e3245' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#323650' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1523' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e2135' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#152420' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3548' }] }
  ];
}
