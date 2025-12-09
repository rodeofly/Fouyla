import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BLOCKS } from './Constants.js';

export class MobManager {
    constructor(scene, world, physics) {
        this.scene = scene;
        this.world = world;
        this.physics = physics;
        this.mobs = [];
        
        // --- TEXTURE COCHON ---
        const canvas = document.createElement('canvas'); 
        canvas.width = 64; 
        canvas.height = 64; 
        const ctx = canvas.getContext('2d'); 
        
        // Peau
        ctx.fillStyle = '#ffaaaa'; ctx.fillRect(0, 0, 64, 64); 
        // Yeux
        ctx.fillStyle = 'white'; ctx.fillRect(8, 20, 16, 8); ctx.fillRect(40, 20, 16, 8); 
        ctx.fillStyle = 'black'; ctx.fillRect(12, 22, 4, 4); ctx.fillRect(44, 22, 4, 4); 
        // Groin
        ctx.fillStyle = '#cc8888'; ctx.fillRect(20, 36, 24, 12); 
        ctx.fillStyle = '#884444'; ctx.fillRect(24, 40, 4, 4); ctx.fillRect(36, 40, 4, 4);
        
        const matBody = new THREE.MeshLambertMaterial({ color: 0xffaaaa }); 
        const matFace = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(canvas) });
        
        this.geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        this.material = [matBody, matBody, matBody, matBody, matBody, matFace];
    }

    // On passe worldLimit pour ne pas spawner hors map
    spawn(count, worldLimit) {
        // Limite de sécurité (on spawn un peu en retrait du bord)
        const range = worldLimit - 4;

        for(let i=0; i<count; i++) {
            let attempts = 0;
            let foundSpot = false;
            let x, y, z;

            // On essaie 50 fois de trouver une place pour CE cochon
            while(attempts < 50) {
                attempts++;
                
                // Coordonnées aléatoires DANS les limites du monde
                x = Math.floor((Math.random() - 0.5) * 2 * range);
                z = Math.floor((Math.random() - 0.5) * 2 * range);
                
                // On cherche la hauteur du sol à cet endroit
                const groundY = this.world.getTerrainHeight(x, z);
                
                // Vérification du bloc au sol
                const groundBlock = this.world.getBlock(x, groundY - 1, z);
                
                // Condition : Solide et PAS de l'eau
                if (groundBlock !== BLOCKS.WATER && groundBlock !== BLOCKS.AIR && groundBlock !== BLOCKS.LEAVES) {
                    y = groundY;
                    foundSpot = true;
                    break; // Trouvé !
                }
            }

            if (foundSpot) {
                // On ajoute un petit offset aléatoire pour éviter l'empilement parfait
                const offsetX = (Math.random() - 0.5) * 0.5;
                const offsetZ = (Math.random() - 0.5) * 0.5;
                this.createMob(x + 0.5 + offsetX, y + 2, z + 0.5 + offsetZ);
            }
        }
    }

    createMob(x, y, z) {
        const mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(mesh);

        const body = new CANNON.Body({
            mass: 20,
            shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4)),
            position: new CANNON.Vec3(x, y, z),
            fixedRotation: true,
            material: this.physics.playerMaterial,
            ccdSpeedThreshold: 1,
            ccdIterations: 5
        });
        
        this.physics.world.addBody(body);
        this.physics.bodies.push({ mesh: mesh, body: body, offset: 0 });
        this.mobs.push({ body: body, timer: Math.random() * 100 });
    }
    
    update(dt) {
        this.mobs.forEach(mob => {
            mob.timer += dt;
            const pos = mob.body.position;
            const blockBody = this.world.getBlock(pos.x, pos.y, pos.z);
            
            if (blockBody === BLOCKS.WATER) {
                // Nage
                mob.body.velocity.y *= 0.8;
                mob.body.velocity.y += 15 * dt; 
                mob.body.velocity.x *= 0.9;
                mob.body.velocity.z *= 0.9;
            } else {
                // Terre
                if(Math.random() < 0.015 && Math.abs(mob.body.velocity.y) < 0.1) {
                     mob.body.velocity.y = 5;
                     mob.body.velocity.x = (Math.random() - 0.5) * 4;
                     mob.body.velocity.z = (Math.random() - 0.5) * 4;
                     // Rotation visuelle vers le saut (Astuce Three.js)
                     meshLookAt(mob.mesh, pos.x + mob.body.velocity.x, pos.y, pos.z + mob.body.velocity.z);
                }
            }

            // Respawn sécurité
            if(pos.y < -20) {
                // On le remet au spawn joueur pour le sauver
                mob.body.position.set(0, 40, 0);
                mob.body.velocity.set(0, 0, 0);
            }
        });
    }
}

// Helper pour tourner le mesh sans toucher au body physique
function meshLookAt(mesh, x, y, z) {
    const dummy = new THREE.Object3D();
    dummy.position.copy(mesh.position);
    dummy.lookAt(x, y, z);
    mesh.quaternion.copy(dummy.quaternion);
}