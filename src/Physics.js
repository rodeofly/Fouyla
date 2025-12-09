import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsWorld {
    constructor(scene) {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -30, 0); 
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        
        // MATERIAUX (Glisse parfaite)
        this.worldMaterial = new CANNON.Material('worldMat');
        this.playerMaterial = new CANNON.Material('playerMat');
        
        const contactMat = new CANNON.ContactMaterial(this.worldMaterial, this.playerMaterial, {
            friction: 0.0, 
            restitution: 0.0,
            contactEquationStiffness: 1e8, 
            contactEquationRelaxation: 3
        });
        
        this.world.addContactMaterial(contactMat);
        
        this.bodies = []; 
        this.staticBodies = new Map();
        this.scene = scene;
    }

    // --- CORRECTION CRITIQUE ---
    // On retire 'dt' et 'maxSubSteps'. 
    // On force un pas de temps fixe unique.
    step(fixedTimeStep) {
        this.world.step(fixedTimeStep);
    }

    sync() {
        this.bodies.forEach(obj => {
            obj.mesh.position.copy(obj.body.position);
            if(!obj.fixedRotation) obj.mesh.quaternion.copy(obj.body.quaternion);
            if(obj.offset) obj.mesh.position.y -= obj.offset;
        });
    }

    addStaticBox(x, y, z) {
        const key = `${x},${y},${z}`;
        if(this.staticBodies.has(key)) return; 

        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        const body = new CANNON.Body({ 
            mass: 0,
            material: this.worldMaterial 
        });
        
        body.addShape(shape);
        body.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.world.addBody(body);
        
        this.staticBodies.set(key, body);
        return body;
    }

    removeBodyAt(x, y, z) {
        const key = `${x},${y},${z}`;
        const body = this.staticBodies.get(key);
        if(body) {
            this.world.removeBody(body);
            this.staticBodies.delete(key);
        }
    }

    hasBodyAt(x, y, z) { return this.staticBodies.has(`${x},${y},${z}`); }
}