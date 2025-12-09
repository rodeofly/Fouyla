import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { BLOCKS, TOOLS } from './Constants.js';

export class Player {
    constructor(camera, domElement, world, physics) {
        this.camera = camera;
        this.world = world;
        this.physics = physics;
        this.controls = new PointerLockControls(camera, domElement);
        
        // Sphere un peu plus fine pour ne pas frotter les murs
        const shape = new CANNON.Sphere(0.3); 
        this.body = new CANNON.Body({
            mass: 5, 
            shape: shape,
            position: new CANNON.Vec3(0, 40, 0),
            fixedRotation: true,
            linearDamping: 0.0,
            angularDamping: 1.0,
            material: this.physics.playerMaterial,
            ccdSpeedThreshold: 1,
            ccdIterations: 10
        });
        
        this.physics.world.addBody(this.body);

        this.inventory = {};
        Object.values(BLOCKS).forEach(b => this.inventory[b] = 0);
        this.inventory[BLOCKS.WOOD] = 64;
        this.hotbar = [TOOLS.PICKAXE, BLOCKS.STONE, BLOCKS.WOOD, BLOCKS.WATER, BLOCKS.PLANKS];
        this.selectedSlot = 0;
        
        this.handGroup = new THREE.Group();
        this.camera.add(this.handGroup);
        this.pickaxeMesh = this.createPickaxeModel();
        this.handGroup.position.set(0.4, -0.3, -0.5);
        this.handGroup.add(this.pickaxeMesh);
        
        this.keys = { w:false, a:false, s:false, d:false, space:false, shift:false };
        this.isCrouching = false;
        
        this.bindInput();
    }
    
    createPickaxeModel() { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), new THREE.MeshLambertMaterial({color:0x5D4037})); g.add(h); const hd = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.06), new THREE.MeshLambertMaterial({color:0x555})); hd.position.y=0.18; g.add(hd); g.rotation.set(Math.PI/8, -Math.PI/4, 0); return g; }
    updateHandVisual() { this.pickaxeMesh.visible = (this.hotbar[this.selectedSlot] === TOOLS.PICKAXE); }
    swing() { if(!this.isSwinging && this.hotbar[this.selectedSlot] === TOOLS.PICKAXE) { this.isSwinging = true; this.swingTimer = 0; } }
    updateAnimation(dt) { if(this.isSwinging) { this.swingTimer+=dt*15; this.handGroup.rotation.x = -Math.sin(this.swingTimer)*1.2; if(this.swingTimer>Math.PI) { this.isSwinging=false; this.handGroup.rotation.x=0; } } }

    bindInput() {
        const onKey = (e, v) => {
            const k = e.code;
            if(k==='KeyW') this.keys.w=v; if(k==='KeyS') this.keys.s=v;
            if(k==='KeyA') this.keys.a=v; if(k==='KeyD') this.keys.d=v;
            if(k==='Space') this.keys.space=v; 
            if(k==='ShiftLeft') this.keys.shift=v;
            if(k==='KeyF' && v) this.flashlight.visible = !this.flashlight.visible;
            if(k==='KeyC') this.isCrouching = v;
        };
        document.addEventListener('keydown', e => onKey(e, true));
        document.addEventListener('keyup', e => onKey(e, false));
        document.addEventListener('wheel', (e) => {
            if(this.controls.isLocked) {
                this.selectedSlot = (e.deltaY > 0) ? (this.selectedSlot+1)%5 : (this.selectedSlot-1+5)%5;
                window.dispatchEvent(new CustomEvent('update-hotbar'));
                this.updateHandVisual();
            }
        });
    }

    update(dt) {
        this.updateAnimation(dt);

        let speed = 5.0; 
        if (this.keys.shift) speed = 9.0;
        if (this.isCrouching) speed = 2.5; 
        
        const inputVector = new THREE.Vector3(
            Number(this.keys.d) - Number(this.keys.a),
            0,
            Number(this.keys.s) - Number(this.keys.w)
        );

        if(this.controls.isLocked) {
            const direction = new THREE.Vector3();
            direction.copy(inputVector).applyQuaternion(this.camera.quaternion);
            direction.y = 0; 
            if(direction.length() > 0) direction.normalize().multiplyScalar(speed);
            this.body.velocity.x = direction.x;
            this.body.velocity.z = direction.z;
        } else {
             this.body.velocity.x = 0;
             this.body.velocity.z = 0;
        }

        const headBlock = this.world.getBlock(this.body.position.x, this.body.position.y + 0.8, this.body.position.z);
        const footBlock = this.world.getBlock(this.body.position.x, this.body.position.y - 0.4, this.body.position.z);
        this.inWater = (headBlock === BLOCKS.WATER || footBlock === BLOCKS.WATER);

        if(this.inWater) {
            this.body.velocity.y *= 0.9; 
            if(this.keys.space) this.body.velocity.y = 3; 
        } else {
            const isGrounded = Math.abs(this.body.velocity.y) < 0.1;
            if (this.keys.space && isGrounded) this.body.velocity.y = 8; 
        }
        
        if(this.body.position.y < -20) {
            this.body.position.set(0, 40, 0);
            this.body.velocity.set(0,0,0);
        }

        if(!this.flashlight) {
             this.flashlight = new THREE.SpotLight(0xffffff, 2, 40, 0.5, 0.5, 1);
             this.flashlight.position.set(0.5, 0, 0);
             this.flashlight.target.position.set(0, 0, -5);
             this.camera.add(this.flashlight);
             this.camera.add(this.flashlight.target);
             this.flashlight.visible = false;
        }

        // --- LISSAGE CAMERA COMPLET (X, Y, Z) ---
        // C'est ce qui supprime le tremblement du sol
        const currentPos = this.controls.getObject().position;
        const targetPos = this.body.position.clone();
        targetPos.y += (this.isCrouching ? 0.4 : 0.8);

        // Facteur de lissage (Plus c'est haut, plus c'est réactif mais potentiellement tremblant)
        // 25 est un bon compromis pour suivre sans délai mais filtrer le jitter
        const smoothFactor = 25; 
        
        currentPos.x = THREE.MathUtils.damp(currentPos.x, targetPos.x, smoothFactor, dt);
        currentPos.y = THREE.MathUtils.damp(currentPos.y, targetPos.y, smoothFactor, dt);
        currentPos.z = THREE.MathUtils.damp(currentPos.z, targetPos.z, smoothFactor, dt);
    }
}