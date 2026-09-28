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
});