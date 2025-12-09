import * as THREE from 'three';
import { BLOCKS, BLOCK_PROPS } from './Constants.js';

export class World {
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
        this.voxels = new Map();
        this.meshes = {};
        this.dummy = new THREE.Object3D();
        this.colorHelper = new THREE.Color();
        this.activePhysicsKeys = new Set();
        
        // --- CORRECTIF : Initialisation des variables de suivi ---
        this.lastBubbleUpdatePos = new THREE.Vector3(9999, 9999, 9999);
        this.lastPlayerChunk = { x: 9999, y: 9999, z: 9999 };
        
        this.initMeshes();
    }

    createTexture(type) {
        const size = 64; 
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const props = BLOCK_PROPS[type];
        ctx.fillStyle = '#' + props.color.toString(16);
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 400; i++) { ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
        if (type === BLOCKS.GRASS) { ctx.fillStyle = 'rgba(50, 200, 50, 0.3)'; for(let i=0; i<50; i++) ctx.fillRect(Math.random()*size, Math.random()*size, 2, 6); }
        else if (type === BLOCKS.WOOD) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; for(let i=0; i<8; i++) ctx.fillRect(0, i*(size/8), size, 2); }
        else if (type === BLOCKS.BRICK) { ctx.fillStyle = 'rgba(200,200,200,0.3)'; for(let y=0; y<size; y+=16) { ctx.fillRect(0, y, size, 2); for(let x=0; x<size; x+=32) ctx.fillRect(x + (y%32===0?0:16), y, 2, 16); } }
        else if (type === BLOCKS.LEAVES) { ctx.fillStyle = 'rgba(0,50,0,0.3)'; for(let i=0; i<100; i++) ctx.fillRect(Math.random()*size, Math.random()*size, 4, 4); }
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, size, size);
        const texture = new THREE.CanvasTexture(canvas); texture.magFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace; return texture;
    }

    initMeshes() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity); // Vital pour clics
        Object.keys(BLOCKS).forEach(key => {
            const type = BLOCKS[key];
            if (type === BLOCKS.AIR) return;
            const props = BLOCK_PROPS[type] || { color: 0xff00ff };
            const material = new THREE.MeshStandardMaterial({ map: this.createTexture(type), transparent: props.transparent || false, opacity: props.opacity || 1.0, roughness: 0.8, metalness: 0.1 });
            const mesh = new THREE.InstancedMesh(geometry, material, 40000); 
            if(!props.transparent) { mesh.castShadow = false; mesh.receiveShadow = true; }
            mesh.frustumCulled = false;
            this.scene.add(mesh);
            this.meshes[type] = mesh;
        });
    }

    getKey(x, y, z) { return `${x},${y},${z}`; }

    setBlock(x, y, z, type) {
        if (y <= 0) return; 
        const key = this.getKey(Math.floor(x), Math.floor(y), Math.floor(z));
        const oldBlock = this.voxels.get(key);
        if (oldBlock && oldBlock.t === BLOCKS.BEDROCK) return;
        if (type === BLOCKS.AIR) this.voxels.delete(key);
        else this.voxels.set(key, { t: type, x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
        
        // Force refresh physique
        this.lastBubbleUpdatePos.set(9999, 9999, 9999);
    }

    getBlock(x, y, z) {
        const b = this.voxels.get(this.getKey(Math.floor(x), Math.floor(y), Math.floor(z)));
        return b ? b.t : BLOCKS.AIR;
    }

    isSolidBlock(type) { return type !== BLOCKS.AIR && type !== BLOCKS.WATER; }
    isSolid(x, y, z) { return this.isSolidBlock(this.getBlock(x, y, z)); }

    updatePhysicsBubble(playerPos) {
        // Optimisation : Seulement si bougé de 2m
        if (playerPos.distanceTo(this.lastBubbleUpdatePos) < 2) return;
        this.lastBubbleUpdatePos.copy(playerPos);

        const range = 15; // Portée réduite pour la performance (suffisant pour le gameplay)
        const rangeSq = range * range;
        const neededKeys = new Set();

        // Scan des blocs existants (Optimisation "Data-Driven")
        for (const block of this.voxels.values()) {
            const dx = block.x - playerPos.x;
            const dz = block.z - playerPos.z;
            const distSq = dx*dx + dz*dz;

            if (distSq < rangeSq) {
                if (Math.abs(block.y - playerPos.y) < 20) {
                    if (this.isSolidBlock(block.t) && this.isExposed(block.x, block.y, block.z)) {
                        neededKeys.add(this.getKey(block.x, block.y, block.z));
                    }
                }
            }
        }

        // Nettoyage corps lointains
        for (const key of this.activePhysicsKeys) {
            if (!neededKeys.has(key)) {
                const [x, y, z] = key.split(',').map(Number);
                this.physics.removeBodyAt(x, y, z);
                this.activePhysicsKeys.delete(key);
            }
        }

        // Ajout nouveaux corps
        for (const key of neededKeys) {
            if (!this.activePhysicsKeys.has(key)) {
                const [x, y, z] = key.split(',').map(Number);
                this.physics.addStaticBox(x, y, z);
                this.activePhysicsKeys.add(key);
            }
        }
    }

    isExposed(x, y, z) {
        return !this.isSolid(x+1, y, z) || !this.isSolid(x-1, y, z) || !this.isSolid(x, y+1, z) || !this.isSolid(x, y-1, z) || !this.isSolid(x, y, z+1) || !this.isSolid(x, y, z-1);
    }

    update() {
        for(let t in this.meshes) this.meshes[t].count = 0;
        for (const block of this.voxels.values()) {
            const type = block.t;
            const isTrans = BLOCK_PROPS[type]?.transparent;
            if (!isTrans && !this.isExposed(block.x, block.y, block.z)) continue;
            const mesh = this.meshes[type];
            if (mesh && mesh.count < 40000) {
                this.dummy.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
                this.dummy.updateMatrix();
                mesh.setMatrixAt(mesh.count, this.dummy.matrix);
                this.colorHelper.setHex(BLOCK_PROPS[type].color);
                mesh.setColorAt(mesh.count, this.colorHelper);
                mesh.count++;
            }
        }
        for(let t in this.meshes) {
            this.meshes[t].instanceMatrix.needsUpdate = true;
            if (this.meshes[t].instanceColor) this.meshes[t].instanceColor.needsUpdate = true;
        }
    }
    
    getTerrainHeight(x, z) { for(let y=64; y>=0; y--) if(this.isSolid(x,y,z)) return y + 1; return 5; }

    buildTree(x, y, z) {
        const height = Math.floor(Math.random() * 3) + 4;
        for (let i = 0; i < height; i++) this.setBlock(x, y + i, z, BLOCKS.WOOD);
        const top = y + height;
        for (let ly = top - 2; ly <= top - 1; ly++) {
            for (let lx = -2; lx <= 2; lx++) {
                for (let lz = -2; lz <= 2; lz++) {
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                    if (lx === 0 && lz === 0) continue;
                    this.setBlock(x + lx, ly, z + lz, BLOCKS.LEAVES);
                }
            }
        }
        for (let lx = -1; lx <= 1; lx++) {
            for (let lz = -1; lz <= 1; lz++) {
                if (Math.abs(lx) === 1 && Math.abs(lz) === 1) continue;
                this.setBlock(x + lx, top, z + lz, BLOCKS.LEAVES);
            }
        }
        this.setBlock(x, top + 1, z, BLOCKS.LEAVES);
    }

    generate(simplex, size, biome) {
        this.voxels.clear();
        this.activePhysicsKeys.clear();
        this.physics.staticBodies.forEach(b => this.physics.world.removeBody(b));
        this.physics.staticBodies.clear();
        this.lastBubbleUpdatePos.set(9999, 9999, 9999);

        const waterLevel = 6;
        let heightScale = 8;
        let scaleNoise = 35;
        let treeDensity = 0.05;

        if (biome === 'mountains') { heightScale = 20; scaleNoise = 25; }
        if (biome === 'forest') { treeDensity = 0.15; }

        for (let x = -size; x < size; x++) {
            for (let z = -size; z < size; z++) {
                this.voxels.set(this.getKey(x,0,z), {t: BLOCKS.BEDROCK, x, y:0, z});
                const n = simplex.noise2D(x/scaleNoise, z/scaleNoise);
                const h = Math.floor(n * heightScale + 6);

                for(let y=1; y<=h; y++) {
                    let t = BLOCKS.STONE;
                    if(y===h) t = (y <= waterLevel+1) ? BLOCKS.SAND : BLOCKS.GRASS;
                    else if(y>h-3) t = BLOCKS.DIRT;
                    this.voxels.set(this.getKey(x,y,z), {t, x, y, z});
                }
                for(let y=h+1; y<=waterLevel; y++) this.voxels.set(this.getKey(x,y,z), {t: BLOCKS.WATER, x, y, z});

                if (x > -size+2 && x < size-2 && z > -size+2 && z < size-2) {
                    if (this.getBlock(x, h, z) === BLOCKS.GRASS) {
                        const treeRnd = Math.abs(simplex.noise2D(x*2.5, z*2.5));
                        if(treeRnd < treeDensity) this.buildTree(x, h + 1, z);
                    }
                }
            }
        }
        this.update();
    }
}