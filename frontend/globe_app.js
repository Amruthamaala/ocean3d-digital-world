
// Global Three.js & Application State Variables
let scene, camera, renderer, controls;
let globeMesh;
let pinGroup, gliderGroup, particleGroup;
let depthChart = null;

// Initialize 3D Scene
function initGlobe() {
  const container = document.getElementById('globe-container');
  const width = container.clientWidth || window.innerWidth - 320;
  const height = container.clientHeight || window.innerHeight - 120;

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 160);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Ambient & Directional Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);

  // Create Textured Earth Globe
  const sphereGeo = new THREE.SphereGeometry(80, 64, 64);
  const textureLoader = new THREE.TextureLoader();
  
  // High Resolution Ocean/Earth Map Texture
  const earthTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const globeMat = new THREE.MeshPhongMaterial({ map: earthTexture, shininess: 15 });
  globeMesh = new THREE.Mesh(sphereGeo, globeMat);
  scene.add(globeMesh);

  // Groups for Map Markers & Overlays
  pinGroup = new THREE.Group();
  gliderGroup = new THREE.Group();
  particleGroup = new THREE.Group();

  scene.add(pinGroup);
  scene.add(gliderGroup);
  scene.add(particleGroup);

  // Load Initial Float Points & Glider Tracks
  loadArgoFloats();
  loadGliders();

  // Raycaster click detection setup
  setupRaycaster();

  // Animation Loop
  animate();
}

// Convert Geographic Coordinates (Lat, Lon) to 3D Cartesian Positions
function latLonToVector3(lat, lon, radius = 81) {
=======
const container = document.getElementById("globe-container");
let profileChart = null;
let currentDepth = 5;
let currentVariable = 'temp';
let activeFloatData = null;
let profileRequestId = 0;

// Ensure container exists
if (!container) {
  console.error("Critical Error: Element #globe-container not found in HTML!");
}

// --- 1. Scene, Camera, & WebGL Setup ---
const scene = new THREE.Scene();
const width = container ? (container.clientWidth || window.innerWidth * 0.5) : window.innerWidth * 0.5;
const height = container ? (container.clientHeight || window.innerHeight * 0.7) : window.innerHeight * 0.7;

const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.set(0, 0, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
if (container) {
  container.appendChild(renderer.domElement);
}

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 9;
controls.maxDistance = 25;

// --- 2. 3D Earth Globe Construction ---
const RADIUS = 6.5;
const globeGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");

// Blue Marble Earth textures
const earthDayMap = loader.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");
const earthBumpMap = loader.load("https://unpkg.com/three-globe/example/img/earth-topology.png");

const earthMat = new THREE.MeshStandardMaterial({
  map: earthDayMap,
  bumpMap: earthBumpMap,
  bumpScale: 0.12,
  roughness: 0.6,
  metalness: 0.1
});
const earthMesh = new THREE.Mesh(globeGeo, earthMat);
scene.add(earthMesh);

// Atmospheric Rim Glow
const atmosphereGeo = new THREE.SphereGeometry(RADIUS + 0.12, 64, 64);
const atmosphereMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  transparent: true,
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
      gl_FragColor = vec4(0.2, 0.65, 1.0, 1.0) * intensity;
    }
  `
});
scene.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(20, 10, 20);
scene.add(sunLight);

// --- 3. Dynamic Ocean Heatmap Overlay ---
const oceanCanvas = document.createElement("canvas");
oceanCanvas.width = 2048;
oceanCanvas.height = 1024;
const ctx = oceanCanvas.getContext("2d");
const oceanTexture = new THREE.CanvasTexture(oceanCanvas);

const oceanOverlayMat = new THREE.MeshBasicMaterial({
  map: oceanTexture,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending
});
const oceanOverlayMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.03, 64, 64), oceanOverlayMat);
scene.add(oceanOverlayMesh);

function latLonToCanvasPixel(lat, lon) {
  return {
    x: ((lon + 180) / 360) * oceanCanvas.width,
    y: ((90 - lat) / 180) * oceanCanvas.height
  };
}

async function drawOceanField(depth, variable) {
  if (variable !== "temp") {
    ctx.clearRect(0, 0, oceanCanvas.width, oceanCanvas.height);
    oceanTexture.needsUpdate = true;
    return;
  }

  try {
    console.log(`Loading Copernicus temperature at depth ${depth}m...`);

    const response = await fetch(`http://127.0.0.1:8000/api/temperature?depth=${depth}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.status !== "success") {
      throw new Error(result.message || "Temperature API failed");
    }

    console.log(`Received ${result.count} real Copernicus temperature points`);

    ctx.clearRect(0, 0, oceanCanvas.width, oceanCanvas.height);

    const values = result.data.map(point => point.value);
    const minTemp = Math.min(...values);
    const maxTemp = Math.max(...values);

    result.data.forEach(point => {
      const pixel = latLonToCanvasPixel(point.lat, point.lon);
      const normalized = (point.value - minTemp) / (maxTemp - minTemp || 1);

      let color;
      if (normalized < 0.33) {
        const t = normalized / 0.33;
        color = `rgb(${Math.round(0 + 0 * t)}, ${Math.round(80 + 175 * t)}, ${Math.round(255 - 0 * t)})`;
      } else if (normalized < 0.66) {
        const t = (normalized - 0.33) / 0.33;
        color = `rgb(${Math.round(0 + 255 * t)}, ${Math.round(255)}, ${Math.round(255 - 255 * t)})`;
      } else {
        const t = (normalized - 0.66) / 0.34;
        color = `rgb(255, ${Math.round(255 - 255 * t)}, 0)`;
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;
    oceanTexture.needsUpdate = true;

    console.log(`Copernicus temperature range: ${minTemp.toFixed(2)}°C - ${maxTemp.toFixed(2)}°C`);

  } catch (error) {
    console.error("Could not load Copernicus temperature data:", error);
  }
}

// --- 4. Dynamic Ocean Current Particles ---
function latLonToVector3(lat, lon, radius) {
>>>>>>> 29015f2095dafdf178ec64743704c9ec3bc6d264
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Render Argo Floats (Cyan Markers)
function loadArgoFloats() {
  const floatData = [
    { id: 'ARGO_01', name: 'Argo Float #13892', lat: 10.5, lon: 72.4 },
    { id: 'ARGO_02', name: 'Argo Float #14201', lat: 5.2, lon: 80.1 },
    { id: 'ARGO_03', name: 'Argo Float #15903', lat: -2.8, lon: 65.2 },
    { id: 'ARGO_04', name: 'Argo Float #16400', lat: 14.1, lon: 88.5 }
  ];

  const geo = new THREE.SphereGeometry(1.2, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

  floatData.forEach(item => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(latLonToVector3(item.lat, item.lon));
    mesh.userData = { ...item, type: 'argo' };
    pinGroup.add(mesh);

class CurrentStreamline {
  constructor() {
    this.historyLength = 8;
    this.positions = new Float32Array(this.historyLength * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.LineBasicMaterial({
      color: 0x80deea,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    this.line = new THREE.Line(this.geometry, this.material);
    particleGroup.add(this.line);
    this.reset();
  }

  reset() {
    this.lat = -15 + Math.random() * 38;
    this.lon = 50 + Math.random() * 48;
    this.life = 0;
    this.maxLife = 60 + Math.random() * 80;

    const pos = latLonToVector3(this.lat, this.lon, RADIUS + 0.08);
    for (let i = 0; i < this.historyLength; i++) {
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
    }
  }

  update() {
    this.life++;
    if (this.life > this.maxLife) {
      this.reset();
      return;
    }

    const { u, v } = getOceanCurrentVector(this.lat, this.lon);
    this.lon += (u * 0.1) + (Math.sin(this.life * 0.05) * 0.015);
    this.lat += (v * 0.1) + (Math.cos(this.life * 0.05) * 0.015);

    for (let i = this.historyLength - 1; i > 0; i--) {
      this.positions[i * 3] = this.positions[(i - 1) * 3];
      this.positions[i * 3 + 1] = this.positions[(i - 1) * 3 + 1];
      this.positions[i * 3 + 2] = this.positions[(i - 1) * 3 + 2];
    }

    const head = latLonToVector3(this.lat, this.lon, RADIUS + 0.08);
    this.positions[0] = head.x;
    this.positions[1] = head.y;
    this.positions[2] = head.z;

    this.geometry.attributes.position.needsUpdate = true;
  }
}

const streamlines = [];
for (let i = 0; i < NUM_PARTICLES; i++) {
  streamlines.push(new CurrentStreamline());
}

// --- 5. Argo Float Interactive Pins ---
let argoData = [];

const pinGroup = new THREE.Group();
scene.add(pinGroup);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function drawArgoFloats() {
  while (pinGroup.children.length > 0) {
    const pin = pinGroup.children[0];
    pin.geometry.dispose();
    pin.material.dispose();
    pinGroup.remove(pin);
  }

  argoData.forEach(float => {
    const pos = latLonToVector3(float.lat, float.lon, RADIUS + 0.12);
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    pin.position.copy(pos);
    pin.userData = float;
    pinGroup.add(pin);
>>>>>>> 29015f2095dafdf178ec64743704c9ec3bc6d264
  });
}

// Render Glider Markers (Yellow Markers)
function loadGliders() {
  const gliderData = [
    { id: 'GLIDER_01', name: 'Ocean Glider SG639', lat: 12.8, lon: 74.2 },
    { id: 'GLIDER_02', name: 'Ocean Glider SG640', lat: 8.4, lon: 76.8 },
    { id: 'GLIDER_03', name: 'Ocean Glider SG642', lat: 15.2, lon: 82.1 }
  ];

  const geo = new THREE.ConeGeometry(1.5, 3, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffea00 });

  gliderData.forEach(item => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(latLonToVector3(item.lat, item.lon));
    mesh.rotation.x = Math.PI / 2;
    mesh.userData = { ...item, type: 'glider' };
    gliderGroup.add(mesh);

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pinGroup.children);
  if (hits.length > 0) openArgoProfile(hits[0].object.userData);
});

async function loadArgoFloats() {
  try {
    console.log("Loading real Argo floats...");
    const response = await fetch("http://127.0.0.1:8000/api/argo-floats");

    if (!response.ok) {
      throw new Error(`Argo API failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.status !== "success") {
      throw new Error(result.message || "Argo API failed");
    }

    argoData = result.floats;
    console.log(`Loaded ${argoData.length} real Argo floats`, argoData);

    drawArgoFloats();

    if (argoData.length > 0) {
      openArgoProfile(argoData[0]);
    }

  } catch (error) {
    console.error("Could not load real Argo floats:", error);
  }
}

async function getOceanModelProfile(latitude, longitude, date) {
  try {
    const url = `http://127.0.0.1:8000/api/ocean-model?latitude=${latitude}&longitude=${longitude}&date=${date}`;
    console.log("Requesting Ocean Model:", url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Ocean Model API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("Ocean Model response:", data);
    return data;

  } catch (error) {
    console.error("Ocean Model request failed:", error);
    return null;
  }
}

function interpolateModelValues(modelProfiles, targetDepths) {
  console.log("MODEL PROFILES RECEIVED:", modelProfiles);
  console.log("ARGO TARGET DEPTHS:", targetDepths);

  const validProfiles = modelProfiles
    .map(p => ({
      depth: Number(p.depth),
      temperature: Number(p.temperature)
    }))
    .filter(p => Number.isFinite(p.depth) && Number.isFinite(p.temperature))
    .sort((a, b) => a.depth - b.depth);

  console.log("VALID MODEL PROFILES:", validProfiles);

  if (validProfiles.length === 0) return targetDepths.map(() => null);

  return targetDepths.map(d => {
    const targetDepth = Number(d);

    if (!Number.isFinite(targetDepth)) return null;

    // Clamp values if target depth goes beyond model limits
    if (targetDepth <= validProfiles[0].depth) {
      return validProfiles[0].temperature;
    }
    if (targetDepth >= validProfiles[validProfiles.length - 1].depth) {
      return validProfiles[validProfiles.length - 1].temperature;
    }

    for (let i = 0; i < validProfiles.length - 1; i++) {
      const p1 = validProfiles[i];
      const p2 = validProfiles[i + 1];

      if (targetDepth >= p1.depth && targetDepth <= p2.depth) {
        const ratio = (targetDepth - p1.depth) / (p2.depth - p1.depth);
        return p1.temperature + ratio * (p2.temperature - p1.temperature);
      }
    }

    return null;
  });
}

// --- 6. Chart.js In-situ vs Model Comparison ---
async function openArgoProfile(float) {
  const requestId = ++profileRequestId;
  activeFloatData = float;

  const detailPanel = document.getElementById("detail-panel");
  if (detailPanel) detailPanel.style.display = "block";

  const formatTimestamp = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toISOString().slice(0, 19).replace("T", " ");
  };

  const setMetadata = (metadata) => {
    if (!detailPanel) return;

    let metadataPanel = document.getElementById("profile-metadata");
    if (!metadataPanel) {
      metadataPanel = document.createElement("div");
      metadataPanel.id = "profile-metadata";
      const locationRow = document.getElementById("float-loc")?.closest(".meta-row");
      if (locationRow) locationRow.insertAdjacentElement("afterend", metadataPanel);
      else detailPanel.insertBefore(metadataPanel, detailPanel.querySelector(".divider"));
    }

    metadataPanel.innerHTML = "";
    Object.entries(metadata).forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "meta-row";
      row.innerHTML = "<span>" + label + ":</span> ";
      const valueElement = document.createElement("strong");
      valueElement.textContent = value;
      row.appendChild(valueElement);
      metadataPanel.appendChild(row);
    });
  };

  if (document.getElementById("float-name")) {
    document.getElementById("float-name").innerText = float.name || "Argo Float #" + float.id;
  }

  let depths = [];
  let observedValues = [];
  let modelValues = [];
  let differences = [];
  let unit = "°C";
  let argoTime = float.time || "—";
  let copernicusTime = "—";
  let errorMessage = null;

  try {
    const res = await fetch(`http://127.0.0.1:8000/api/argo-profile?platform_number=${float.id}`);
    if (!res.ok) {
      throw new Error(`Argo profile request failed: ${res.status}`);
    }

    const data = await res.json();
    console.log("REAL ARGO PROFILE:", data);
    if (data.status !== "success") {
      throw new Error(data.message || "Argo profile API failed");
    }

    depths = Array.isArray(data.depths) ? data.depths : [];
    observedValues = Array.isArray(data.observed_values)
      ? data.observed_values
      : (Array.isArray(data.temperatures) ? data.temperatures : []);

    argoTime = data.profile_time || float.time || "—";
    unit = data.unit || "°C";

    // ===============================
    // GET COPERNICUS OCEAN MODEL DATA
    // ===============================
    const modelLatitude = Number(float.lat);
    const modelLongitude = Number(float.lon);

    let modelDate;
    try {
      const parsedDate = new Date(argoTime);
      modelDate = !isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    } catch (e) {
      modelDate = new Date().toISOString().slice(0, 10);
    }

    console.log("Getting Ocean Model data for:", { modelLatitude, modelLongitude, modelDate });

    const oceanModelData = await getOceanModelProfile(modelLatitude, modelLongitude, modelDate);

    if (oceanModelData && Array.isArray(oceanModelData.profiles)) {
      console.log("========== COPERNICUS MODEL ==========");
      console.log("Model location:", oceanModelData.location);
      console.log("Model date:", oceanModelData.date);
      console.log("Model profiles:", oceanModelData.profiles);

      copernicusTime = oceanModelData.date || modelDate;

      modelValues = interpolateModelValues(oceanModelData.profiles, depths).map(value =>
        Number.isFinite(Number(value)) ? Number(value) : null
      );

      console.log("COPERNICUS TEMPERATURE VALUES:", modelValues);
    } else {
      console.warn("No Ocean Model data received");
      modelValues = depths.map(() => null);
    }

    // Fixed typo: was 'ddifferences'
    differences = depths.map((depth, index) => {
      const observed = Number(observedValues[index]);
      const model = Number(modelValues[index]);

      if (Number.isFinite(observed) && Number.isFinite(model)) {
        return observed - model;
      }
      return null;
    });

    console.log("ARGO VALUES:", observedValues);
    console.log("COPERNICUS VALUES:", modelValues);
    console.log("DIFFERENCES:", differences);

  } catch (error) {
    console.error("Could not load real Argo profile data:", error);
    errorMessage = "Could not load profile data";
  }

  if (requestId !== profileRequestId) return;

  setMetadata({
    "Float ID": String(float.id),
    "Latitude": `${float.lat}° N`,
    "Longitude": `${float.lon}° E`,
    "Argo Profile Time": formatTimestamp(argoTime),
    "Copernicus Model Time": copernicusTime,
    "Matched Observations": errorMessage ? "0 matched observations" : `${depths.length} matched observations`

  });
}

// Raycaster Marker Click Handler
function setupRaycaster() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const container = document.getElementById('globe-container');

  container.addEventListener('click', (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const selectableObjects = [...pinGroup.children, ...gliderGroup.children];
    const intersects = raycaster.intersectObjects(selectableObjects);

    if (intersects.length > 0) {
      const selected = intersects[0].object.userData;
      openProfilePanel(selected);
    }
  });
}

// Open Detail Modal & Generate Depth vs Temp / Depth vs Salinity Line Graphs
function openProfilePanel(data) {
  document.getElementById('detail-panel').style.display = 'block';
  document.getElementById('float-name').innerText = data.name;
  document.getElementById('float-loc').innerText = `${data.lat.toFixed(2)}°N, ${data.lon.toFixed(2)}°E`;

  // Sample Ocean Profile Data (Depth, Temperature, Salinity)
  const depths = [0, 5, 10, 20, 50, 90];
  const temps = data.type === 'glider' ? [29.1, 28.8, 27.5, 25.2, 21.0, 16.4] : [28.5, 28.2, 27.0, 24.8, 20.2, 15.8];
  const salinities = [34.5, 34.6, 34.8, 35.1, 35.4, 35.2];

  renderChart(depths, temps, salinities);
  renderTable(depths, temps, salinities);
}

// Chart.js Depth Profile Graph Rendering
function renderChart(depths, temps, salinities) {
  const ctx = document.getElementById('depthProfileChart').getContext('2d');

  if (depthChart) {
    depthChart.destroy();
  }


  depthChart = new Chart(ctx, {
    type: 'line',

  const canvas = document.getElementById("depthProfileChart");
  if (!canvas) {
    console.error("Canvas element #depthProfileChart not found in HTML!");
    return;
  }

  const ctxChart = canvas.getContext("2d");
  if (profileChart) profileChart.destroy();

  profileChart = new Chart(ctxChart, {
    type: "scatter",

    data: {
      labels: depths.map(d => `${d}m`),
      datasets: [
        {
          label: 'Temperature (°C)',
          data: temps,
          borderColor: '#ff5722',
          backgroundColor: 'rgba(255, 87, 34, 0.2)',
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Salinity (PSU)',
          data: salinities,
          borderColor: '#00bcd4',
          backgroundColor: 'rgba(0, 188, 212, 0.2)',
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Depth (m)', color: '#94a3b8' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Temp (°C)', color: '#ff5722' },
          ticks: { color: '#ff5722' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Salinity (PSU)', color: '#00bcd4' },
          ticks: { color: '#00bcd4' }
        }
      },
      plugins: {
        legend: { labels: { color: '#cfd8dc', boxWidth: 12 } }
      }
    }
  });
}

// Populate the Validation Table
function renderTable(depths, temps, salinities) {
  const tbody = document.getElementById('val-tbody');
  tbody.innerHTML = '';

  for (let i = 0; i < depths.length; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${depths[i]} m</td>
      <td style="color: #ff7043;">${temps[i]} °C</td>
      <td style="color: #26c6da;">${salinities[i]} PSU</td>
    `;
    tbody.appendChild(tr);
  }
}


// Checkbox Overlay Event Handlers
function toggleArgo(visible) {
  if (pinGroup) pinGroup.visible = visible;

async function setDepth(val, targetEl) {
  currentDepth = parseFloat(val);

  const slider = document.getElementById("depth-slider");
  const display = document.getElementById("depth-val-display");

  if (slider) slider.value = currentDepth;
  if (display) display.innerText = `${currentDepth} m`;

  if (targetEl) {
    document.querySelectorAll(".slice-card").forEach(el => el.classList.remove("active"));
    targetEl.classList.add("active");
  }

  await drawOceanField(currentDepth, currentVariable);
}

const sliderEl = document.getElementById("depth-slider");
if (sliderEl) {
  sliderEl.addEventListener("change", (e) => {
    setDepth(e.target.value);
  });
}

function setGlobeOrientation(rotY, rotX) {
  earthMesh.rotation.y = rotY;
  earthMesh.rotation.x = rotX;
  oceanOverlayMesh.rotation.y = rotY;
  oceanOverlayMesh.rotation.x = rotX;
  particleGroup.rotation.y = rotY;
  particleGroup.rotation.x = rotX;
  pinGroup.rotation.y = rotY;
  pinGroup.rotation.x = rotX;

}

function toggleGliders(visible) {
  if (gliderGroup) gliderGroup.visible = visible;
}

function toggleCurrents(visible) {
  if (particleGroup) particleGroup.visible = visible;
}

// Variable Switcher Handler
function switchVariable(type) {
  const buttons = document.querySelectorAll('.var-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (type === 'temp') document.getElementById('btn-temp').classList.add('active');
  if (type === 'salinity') document.getElementById('btn-salinity').classList.add('active');
  if (type === 'currents') document.getElementById('btn-currents').classList.add('active');
  if (type === 'ssh') document.getElementById('btn-ssh').classList.add('active');
}

// Bottom Depth Slice Handler
function setDepth(depth, element) {
  document.getElementById('depth-slider').value = depth;
  document.getElementById('depth-val-display').innerText = `${depth} m`;

  const buttons = document.querySelectorAll('.slice-card');
  buttons.forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
}

// Dynamic Viewport Resize Handler
function onWindowResize() {
  const container = document.getElementById('globe-container');
  if (!container || !renderer || !camera) return;

  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width === 0 || height === 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

// Main Rendering Loop
function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}


// Application Startup
window.addEventListener('resize', onWindowResize);
window.addEventListener('DOMContentLoaded', () => {
  initGlobe();
  onWindowResize();

window.addEventListener("resize", () => {
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

});