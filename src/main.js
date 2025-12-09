import * as THREE from 'three';
import GUI from 'lil-gui';
import { World } from './World.js';
import { Player } from './Player.js';
import { MobManager } from './Mobs.js';
import { UIManager } from './UI.js';
import { PhysicsWorld } from './Physics.js';
import { BLOCKS, TOOLS } from './Constants.js';

window.addEventListener('contextmenu', (e) => e.preventDefault());

// --- 1. SCÈNE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(50, 100, 50);
sun.castShadow = true;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
scene.add(sun);

// --- 2. MOTEURS ---
const physics = new PhysicsWorld(scene);
const world = new World(scene, physics);
import 'https://cdnjs.cloudflare.com/ajax/libs/simplex-noise/2.4.0/simplex-noise.min.js';
const simplex = new SimplexNoise();

const player = new Player(camera, document.body, world, physics);
const mobs = new MobManager(scene, world, physics);
const ui = new UIManager(player);

const titleScreen = document.getElementById('title-screen');
const hud = document.getElementById('hud');
const clock = new THREE.Clock();

let isWorldGenerated = false; // Drapeau pour savoir si on a généré

// Caméra Menu
camera.position.set(0, 30, 40);
camera.lookAt(0, 0, 0);

// --- GESTION ETATS ---
player.controls.addEventListener('lock', () => { 
    titleScreen.style.display = 'none'; 
    hud.style.display = 'block'; 
});
player.controls.addEventListener('unlock', () => { 
    if(!ui.isOpen) { 
        titleScreen.style.display = 'flex'; 
        hud.style.display = 'none'; 
    }
});

// BOUTON 1 : GÉNÉRER
const btnGen = document.getElementById('btn-gen');
const btnPlay = document.getElementById('btn-play');

btnGen.onclick = () => {
    btnGen.innerText = "GÉNÉRATION...";
    btnGen.disabled = true;

    setTimeout(() => {
        // On limite la taille pour éviter le lag (32 max conseillé en JS)
        let sizeVal = parseInt(document.getElementById('opt-size').value) || 32;
        const biome = document.getElementById('opt-biome').value || 'forest';
        
        world.generate(simplex, sizeVal, biome);
        
        // Placement initial
        const spawnY = world.getTerrainHeight(0, 0);
        player.body.position.set(0, spawnY + 2, 0);
        player.body.velocity.set(0, 0, 0);
        
        world.updatePhysicsBubble(player.body.position);
        mobs.spawn(5);

        // UI Update
        btnPlay.disabled = false;
        btnPlay.style.opacity = "1";
        btnPlay.style.cursor = "pointer";
        btnGen.innerText = "GÉNÉRER À NOUVEAU";
        btnGen.disabled = false;
        
        isWorldGenerated = true;
    }, 50);
};

// BOUTON 2 : JOUER
btnPlay.onclick = () => {
    clock.getDelta(); // Reset temps
    
    // Placement final de sécurité
    const spawnY = world.getTerrainHeight(0, 0);
    player.body.position.set(0, spawnY + 2, 0);
    player.body.velocity.set(0,0,0);
    
    world.updatePhysicsBubble(player.body.position);
    player.controls.lock();
    ui.updateHUD();
};

// Options
const gui = new GUI({ title: 'Options' });
const envParams = { time: 'Jour', reset: () => { 
    const y = world.getTerrainHeight(0,0);
    player.body.position.set(0, y + 5, 0); 
    player.body.velocity.set(0,0,0); 
}};
function updateEnvironment(val) {
    let sunHeight, skyColorHex, lightIntensity;
    if(val === 'Jour') { sunHeight = 1.0; skyColorHex = 0x87CEEB; lightIntensity = 1.2; ambient.intensity = 0.6; }
    else if (val === 'Coucher') { sunHeight = 0.2; skyColorHex = 0xFF6600; lightIntensity = 0.6; ambient.intensity = 0.4; }
    else { sunHeight = -1.0; skyColorHex = 0x050510; lightIntensity = 0.0; ambient.intensity = 0.1; }
    sun.position.set(50, sunHeight * 100, 50);
    sun.intensity = Math.max(0, lightIntensity);
    const col = new THREE.Color(skyColorHex);
    scene.background = col; scene.fog.color = col;
}
gui.add(envParams, 'time', ['Jour', 'Coucher', 'Nuit']).name('Moment').onChange(updateEnvironment);
gui.add(envParams, 'reset').name('Respawn (R)');
updateEnvironment('Jour');

// Raycast
const raycaster = new THREE.Raycaster(); 
const center = new THREE.Vector2(0,0);
const highlight = new THREE.Mesh(
    new THREE.BoxGeometry(1.005, 1.005, 1.005), 
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, depthTest: false, opacity: 0.8, transparent: true })
);
highlight.renderOrder = 999; 
scene.add(highlight);
let targetBlock = null;

// Boucle
const timeStep = 1 / 60;
let accumulator = 0;

function animate() {
    requestAnimationFrame(animate);
    let frameTime = clock.getDelta();
    if(frameTime > 0.1) frameTime = 0.1;

    // --- LOGIQUE MENU VS JEU ---
    const isPlaying = (titleScreen.style.display === 'none' || ui.isOpen);

    if (isWorldGenerated) {
        
        // 1. PHYSIQUE (Tourne toujours)
        world.updatePhysicsBubble(player.body.position);

        accumulator += frameTime;
        while(accumulator >= timeStep) {
            physics.step(timeStep); 
            accumulator -= timeStep;
        }
        physics.sync();
        
        mobs.update(frameTime);

        // 2. COMPORTEMENT JOUEUR
        if (isPlaying) {
            // EN JEU : Le joueur contrôle
            player.update(frameTime);
            
            // Visée
            raycaster.setFromCamera(center, camera);
            const meshes = Object.values(world.meshes);
            const intersects = raycaster.intersectObjects(meshes);
            
            if(intersects.length > 0 && intersects[0].distance < 6) {
                const hit = intersects[0];
                const x = Math.floor(hit.point.x - hit.face.normal.x * 0.1);
                const y = Math.floor(hit.point.y - hit.face.normal.y * 0.1);
                const z = Math.floor(hit.point.z - hit.face.normal.z * 0.1);
                highlight.position.set(x + 0.5, y + 0.5, z + 0.5);
                highlight.visible = true;
                targetBlock = { x: x, y: y, z: z, face: hit.face };
            } else { 
                highlight.visible = false; 
                targetBlock = null; 
            }

        } else {
            // DANS LE MENU : Le joueur est FIGÉ au spawn (Anti-Chute)
            const spawnY = world.getTerrainHeight(0, 0);
            
            // On force la position pour que la caméra de prévisu ait un point fixe
            player.body.position.set(0, spawnY + 2, 0);
            player.body.velocity.set(0, 0, 0);
            
            // Caméra Spectateur (Tourne autour du spawn)
            const camTime = Date.now() * 0.0002;
            camera.position.x = Math.sin(camTime) * 30;
            camera.position.z = Math.cos(camTime) * 30;
            camera.position.y = spawnY + 15;
            camera.lookAt(0, spawnY, 0);
        }
    }

    renderer.render(scene, camera);
}

document.addEventListener('mousedown', (e) => {
    if(ui.isOpen || titleScreen.style.display !== 'none') return;
    if(document.pointerLockElement !== document.body) { player.controls.lock(); if(e.button === 0) return; }
    
    if(targetBlock) {
        if(e.button === 0) { // Casser
            player.swing();
            const type = world.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
            if(type !== BLOCKS.BEDROCK && type !== BLOCKS.AIR) {
                world.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, BLOCKS.AIR);
                world.lastPlayerChunk = { x: 9999, z: 9999 }; // Refresh
                player.inventory[type] = (player.inventory[type] || 0) + 1;
                world.update();
                ui.updateHUD();
            }
        } else if(e.button === 2) { // Poser
            const item = player.hotbar[player.selectedSlot];
            if(item === TOOLS.PICKAXE) return;
            if(item && item !== 0 && player.inventory[item] > 0) {
                const tx = targetBlock.x + targetBlock.face.normal.x;
                const ty = targetBlock.y + targetBlock.face.normal.y;
                const tz = targetBlock.z + targetBlock.face.normal.z;
                
                const dist = player.body.position.distanceTo(new THREE.Vector3(tx, ty, tz)); // Manuel check ok ici car Vector3 Three
                if(dist < 1.0) return; 

                world.setBlock(tx, ty, tz, item);
                world.lastPlayerChunk = { x: 9999, z: 9999 };
                player.inventory[item]--;
                world.update();
                ui.updateHUD();
            }
        }
    } else if(e.button === 0) player.swing();
});

document.addEventListener('keydown', (e) => { if(e.code === 'KeyR') params.reset(); });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();