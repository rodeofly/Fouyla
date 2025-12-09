// main.js
// Choix: three.js pour sa simplicité WebGL et communauté. Le projet se lance en ouvrant index.html.
// Architecture: données voxel (chunks), rendu (meshes), input (FPS + pointer lock), UI (DOM overlays).

// --- Utilitaires bruit de Perlin (implémentation simple inline) ---
class Perlin {
  constructor() {
    this.p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    for (let i = 0; i < 256; i++) {
      const j = (Math.random() * 256) | 0;
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    for (let i = 0; i < 256; i++) this.p[256 + i] = this.p[i];
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + t * (b - a); }
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  noise(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x), v = this.fade(y), w = this.fade(z);
    const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
    return this.lerp(
      this.lerp(
        this.lerp(this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z), u),
        this.lerp(this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z), u), v
      ),
      this.lerp(
        this.lerp(this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1), u),
        this.lerp(this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1), u), v
      ), w
    );
  }
}

// --- Constantes de jeu ---
const CHUNK_SIZE = 16;
const WORLD_SIZE = 64;
const WORLD_HEIGHT = 32;
const BLOCK = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WATER: 4 };
const BLOCK_COLORS = {
  [BLOCK.GRASS]: 0x66cc66,
  [BLOCK.DIRT]: 0x9b7653,
  [BLOCK.STONE]: 0x9ea8b8,
  [BLOCK.WATER]: 0x4fc3f7,
};

// --- Monde voxel ---
class Chunk {
  constructor(cx, cz, data) {
    this.cx = cx; this.cz = cz;
    this.data = data; // Uint8Array
    this.mesh = null;
  }
  index(x, y, z) { return x + CHUNK_SIZE * (z + CHUNK_SIZE * y); }
  get(x, y, z) { return this.data[this.index(x, y, z)]; }
  set(x, y, z, v) { this.data[this.index(x, y, z)] = v; }
}

class World {
  constructor(seedNoise) {
    this.noise = seedNoise;
    this.chunks = new Map();
  }
  key(cx, cz) { return `${cx},${cz}`; }
  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const height = Math.floor(10 + this.noise.noise(wx * 0.08, wz * 0.08, 0) * 5 + this.noise.noise(wx * 0.01, wz * 0.01, 0) * 6);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let block = BLOCK.AIR;
          if (y <= height) {
            if (y === height) block = BLOCK.GRASS;
            else if (y >= height - 3) block = BLOCK.DIRT;
            else block = BLOCK.STONE;
          }
          if (y < 6) block = BLOCK.WATER;
          data[x + CHUNK_SIZE * (z + CHUNK_SIZE * y)] = block;
        }
      }
    }
    const chunk = new Chunk(cx, cz, data);
    this.chunks.set(this.key(cx, cz), chunk);
    return chunk;
  }
  getChunkAt(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = this.key(cx, cz);
    return this.chunks.get(key) || this.generateChunk(cx, cz);
  }
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;
    const chunk = this.getChunkAt(wx, wz);
    const x = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const z = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.get(x, wy, z);
  }
  setBlock(wx, wy, wz, block) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return;
    const chunk = this.getChunkAt(wx, wz);
    const x = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const z = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.set(x, wy, z, block);
    return chunk;
  }
}

// --- Meshing naïf avec culling des faces cachées ---
function buildChunkMesh(chunk, world) {
  if (chunk.mesh) chunk.mesh.geometry.dispose();
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const pushFace = (x, y, z, nx, ny, nz, color) => {
    const size = 1;
    const vertices = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0],
      [0, 0, 0], [1, 1, 0], [0, 1, 0]
    ];
    const basis = new THREE.Matrix4();
    const normal = new THREE.Vector3(nx, ny, nz);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    basis.makeRotationFromQuaternion(quaternion);
    const colorVec = new THREE.Color(color);
    vertices.forEach(v => {
      const vec = new THREE.Vector3(v[0] - 0.5, v[1] - 0.5, v[2] - 0.5).applyMatrix4(basis);
      positions.push(vec.x + x, vec.y + y, vec.z + z);
      colors.push(colorVec.r, colorVec.g, colorVec.b);
    });
  };

  const neighbors = [
    [1,0,0],[ -1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]
  ];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const block = chunk.get(x, y, z);
        if (block === BLOCK.AIR) continue;
        neighbors.forEach(([dx,dy,dz]) => {
          const nx = chunk.cx * CHUNK_SIZE + x + dx;
          const nz = chunk.cz * CHUNK_SIZE + z + dz;
          const nb = world.getBlock(nx, y + dy, nz);
          if (nb === BLOCK.AIR || (block === BLOCK.WATER && nb !== BLOCK.WATER)) {
            pushFace(chunk.cx * CHUNK_SIZE + x, y, chunk.cz * CHUNK_SIZE + z, dx, dy, dz, BLOCK_COLORS[block]);
          }
        });
      }
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.98 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = true;
  chunk.mesh = mesh;
  return mesh;
}

// --- Gestion joueur/caméra ---
class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(WORLD_SIZE/2, 20, WORLD_SIZE/2);
    this.pitch = 0; this.yaw = 0;
    this.speed = 8;
    this.grounded = false;
    this.walkTime = 0;
  }
  update(dt, input) {
    const accel = new THREE.Vector3();
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    if (input.keys['KeyW'] || input.keys['KeyZ']) accel.add(forward);
    if (input.keys['KeyS']) accel.sub(forward);
    if (input.keys['KeyA'] || input.keys['KeyQ']) accel.sub(right);
    if (input.keys['KeyD']) accel.add(right);
    accel.normalize().multiplyScalar(this.speed);

    this.velocity.x = accel.x;
    this.velocity.z = accel.z;
    this.velocity.y -= 20 * dt;

    if (this.position.y <= this.groundHeight() + 1.6) {
      this.position.y = this.groundHeight() + 1.6;
      this.velocity.y = 0;
      this.grounded = true;
    } else this.grounded = false;

    if (input.keys['Space'] && this.grounded) {
      this.velocity.y = 7; this.grounded = false;
    }

    this.position.addScaledVector(this.velocity, dt);

    // Oscillation de la caméra lors de la marche
    const moving = accel.lengthSq() > 0.1;
    if (moving) this.walkTime += dt * 8; else this.walkTime *= 0.9;
    const bob = Math.sin(this.walkTime) * 0.05;
    this.camera.position.set(this.position.x, this.position.y + bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  groundHeight() {
    const wx = Math.floor(this.position.x);
    const wz = Math.floor(this.position.z);
    for (let y = WORLD_HEIGHT -1; y >=0; y--) {
      if (this.world.getBlock(wx, y, wz) !== BLOCK.AIR) return y + 1e-3;
    }
    return 0;
  }
}

// --- Input FPS ---
class Input {
  constructor(renderer, domHud) {
    this.keys = {};
    this.pointerLocked = false;
    this.domHud = domHud;
    window.addEventListener('keydown', e => { if (!this.blocked) this.keys[e.code] = true; if (e.code === 'KeyE') this.toggleInventory(); });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    renderer.domElement.addEventListener('click', () => this.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === renderer.domElement;
      this.blocked = !this.pointerLocked;
    });
    this.pitch = 0; this.yaw = 0;
    document.addEventListener('mousemove', e => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.pitch));
    });
  }
  requestPointerLock() { document.getElementById('scene').requestPointerLock(); }
  toggleInventory() {
    const inv = document.getElementById('inventory');
    const isOpen = !inv.classList.contains('hidden');
    inv.classList.toggle('hidden');
    this.blocked = !isOpen ? true : false;
    if (!isOpen) document.exitPointerLock();
  }
}

// --- Raycast voxel simple ---
function voxelRaycast(origin, direction, maxDist, world) {
  const pos = origin.clone();
  const step = direction.clone().normalize().multiplyScalar(0.2);
  let last = null;
  for (let i = 0; i < maxDist / step.length(); i++) {
    const wx = Math.floor(pos.x);
    const wy = Math.floor(pos.y);
    const wz = Math.floor(pos.z);
    const block = world.getBlock(wx, wy, wz);
    if (block !== BLOCK.AIR) return { hit: true, wx, wy, wz, block, prev: last };
    last = { wx, wy, wz };
    pos.add(step);
  }
  return { hit: false };
}

// --- Initialisation scène ---
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xa0d5ff, 0.012);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const input = new Input(renderer, document.getElementById('hud'));
const perlin = new Perlin();
const world = new World(perlin);
const player = new Player(camera, world);

// Lumières & ciel
const hemi = new THREE.HemisphereLight(0xd9e7ff, 0x4e4a46, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(50, 100, 20);
sun.castShadow = true;
scene.add(sun);
const ambientGradient = new THREE.Color(0x87cefa);
scene.background = ambientGradient;

// Grille chunks (pré-génération petite zone)
const chunkMeshes = new Map();
function ensureChunkMesh(cx, cz) {
  const key = `${cx},${cz}`;
  const chunk = world.getChunkAt(cx * CHUNK_SIZE, cz * CHUNK_SIZE);
  if (!chunkMeshes.has(key)) {
    const mesh = buildChunkMesh(chunk, world);
    chunkMeshes.set(key, mesh);
    scene.add(mesh);
  }
}
for (let cx = 0; cx < WORLD_SIZE / CHUNK_SIZE; cx++) {
  for (let cz = 0; cz < WORLD_SIZE / CHUNK_SIZE; cz++) ensureChunkMesh(cx, cz);
}

// UI setup
const hud = document.getElementById('hud');
const hotbar = document.getElementById('hotbar');
const blockName = document.getElementById('block-name');
const help = document.getElementById('help');
const ambience = document.getElementById('ambience');
const fogToggle = document.getElementById('fog-toggle');
fogToggle.addEventListener('change', () => scene.fog.density = fogToggle.checked ? 0.012 : 0);
const blocksList = [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WATER, BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE];
let selected = 0;
blocksList.forEach((b, i) => {
  const div = document.createElement('div');
  div.className = 'hot-slot' + (i === selected ? ' selected' : '');
  div.style.borderColor = `#${BLOCK_COLORS[b].toString(16)}`;
  div.innerText = Object.keys(BLOCK).find(k => BLOCK[k] === b).toLowerCase();
  hotbar.appendChild(div);
});
function updateHotbar() {
  [...hotbar.children].forEach((c, i) => c.classList.toggle('selected', i === selected));
  const blockKey = Object.keys(BLOCK).find(k => BLOCK[k] === blocksList[selected]);
  blockName.innerText = blockKey.toLowerCase();
}
updateHotbar();

window.addEventListener('wheel', e => {
  selected = (selected + (e.deltaY > 0 ? 1 : -1) + blocksList.length) % blocksList.length;
  updateHotbar();
});

// Title screen interactions
const title = document.getElementById('title-screen');
document.getElementById('play-btn').onclick = () => {
  title.classList.add('fade-out');
  setTimeout(() => { title.style.display = 'none'; hud.classList.remove('hidden'); hud.classList.add('fade-in'); input.requestPointerLock(); }, 600);
  help.style.opacity = 1;
  setTimeout(() => help.style.opacity = 0, 8000);
  if (document.getElementById('music-toggle').checked) ambience.play();
};
document.getElementById('options-btn').onclick = () => document.getElementById('options-panel').classList.toggle('hidden');
document.getElementById('quit-btn').onclick = () => alert('Utilise Alt+F4 ou ferme l\'onglet.');

// Inventaire factice
const invGrid = document.getElementById('inventory-grid');
for (let i = 0; i < 16; i++) {
  const slot = document.createElement('div');
  slot.className = 'inv-slot';
  slot.innerText = i < blocksList.length ? 'Bloc' : '';
  invGrid.appendChild(slot);
}

// Sélection / interaction blocs
const raycaster = new THREE.Raycaster();
const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01,1.01,1.01)), new THREE.LineBasicMaterial({ color: 0xffffff }));
highlight.visible = false; scene.add(highlight);

function rebuildChunkAround(wx, wz) {
  const chunk = world.getChunkAt(wx, wz);
  const key = `${chunk.cx},${chunk.cz}`;
  const mesh = buildChunkMesh(chunk, world);
  scene.remove(chunkMeshes.get(key));
  chunkMeshes.set(key, mesh);
  scene.add(mesh);
}

window.addEventListener('mousedown', e => {
  if (!input.pointerLocked) return;
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const dir = raycaster.ray.direction.clone();
  const res = voxelRaycast(camera.position.clone(), dir, 8, world);
  if (!res.hit) return;
  if (e.button === 0) { // casser
    world.setBlock(res.wx, res.wy, res.wz, BLOCK.AIR);
    rebuildChunkAround(res.wx, res.wz);
  } else if (e.button === 2 && res.prev) { // placer
    const block = blocksList[selected];
    world.setBlock(res.prev.wx, res.prev.wy, res.prev.wz, block);
    rebuildChunkAround(res.prev.wx, res.prev.wz);
  }
});
window.addEventListener('contextmenu', e => e.preventDefault());

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boucle principale
let last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  player.yaw = input.yaw; player.pitch = input.pitch;
  player.update(dt, input);

  // highlight bloc ciblé
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const dir = raycaster.ray.direction.clone();
  const res = voxelRaycast(camera.position.clone(), dir, 8, world);
  if (res.hit) {
    highlight.visible = true;
    highlight.position.set(res.wx + 0.5, res.wy + 0.5, res.wz + 0.5);
  } else highlight.visible = false;

  renderer.render(scene, camera);
}
loop();
