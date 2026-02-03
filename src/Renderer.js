import * as THREE from 'three';

export class Renderer {
    constructor(containerId, maze) {
        this.container = document.getElementById(containerId);
        this.maze = maze;
        this.width = 640;
        this.height = 480;

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a); // Matches CSS bg
        // Fog removed to allow viewing the whole maze
        // this.scene.fog = new THREE.Fog(0x0f172a, 5, 20);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 2000); // Extended far plane
        this.camera.position.set(0, 10, 5);
        this.camera.lookAt(0, 0, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        // Materials
        this.wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.2,
            metalness: 0.5
        });
        this.floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.8
        });
        this.playerMaterial = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.5
        });
        this.exitMaterial = new THREE.MeshStandardMaterial({
            color: 0x10b981, // Emerald green
            emissive: 0x059669,
            emissiveIntensity: 0.5
        });

        // Object containers
        this.mazeGroup = new THREE.Group();
        this.scene.add(this.mazeGroup);

        this.playerMesh = null;
        this.exitMesh = null;

        // Path Visualization
        this.pathGroup = new THREE.Group();
        this.scene.add(this.pathGroup);
        this.pathMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.8
        });

        this.perspective = 'overhead'; // 'overhead' or 'firstPerson'
        this.zoomLevel = 1.0; // 1.0 = default height (8)
        this.minZoom = 0.5;
        this.maxZoom = 30.0; // Increased to allow seeing full 150x150 maze

        this.generateMazeMesh();
    }

    setPerspective(mode) {
        console.log(`Renderer: setPerspective called with ${mode}`);
        this.perspective = mode;
        // Immediate update to snap camera
        if (this.playerMesh) {
            // We need the player's last known position and facing to update correctly immediately
            // but updatePlayerPosition is called every frame anyway.
        }
    }

    generateMazeMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const floorGeo = new THREE.PlaneGeometry(this.maze.width, this.maze.height);

        // Create floor
        const floor = new THREE.Mesh(floorGeo, this.floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(this.maze.width / 2 - 0.5, -0.5, this.maze.height / 2 - 0.5);
        this.mazeGroup.add(floor);

        // Create walls (InstancedMesh for performance with 150x150 grid)
        // Max walls could be approx width * height
        const wallCount = this.maze.width * this.maze.height;
        const instancedMesh = new THREE.InstancedMesh(geometry, this.wallMaterial, wallCount);

        let i = 0;
        const dummy = new THREE.Object3D();

        for (let x = 0; x < this.maze.width; x++) {
            for (let y = 0; y < this.maze.height; y++) {
                if (this.maze.grid[x][y] === 1) {
                    dummy.position.set(x, 0, y);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i++, dummy.matrix);
                }
            }
        }

        instancedMesh.count = i;
        instancedMesh.instanceMatrix.needsUpdate = true;
        this.mazeGroup.add(instancedMesh);

        // Create Exit Marker
        const exitGeo = new THREE.CylinderGeometry(0.2, 0.2, 2, 32);
        this.exitMesh = new THREE.Mesh(exitGeo, this.exitMaterial);
        this.exitMesh.position.set(this.maze.end.x, 0.5, this.maze.end.y);
        this.mazeGroup.add(this.exitMesh);
    }

    createPlayer(startPos) {
        const geometry = new THREE.SphereGeometry(0.3, 32, 16);
        this.playerMesh = new THREE.Mesh(geometry, this.playerMaterial);
        this.playerMesh.position.set(startPos.x, 0, startPos.y);
        this.scene.add(this.playerMesh);
    }

    zoom(delta) {
        // Multiplicative zoom for better feel over large ranges
        // delta is usually +/- 0.1 from main.js
        // We use it as a percentage change: 1 + delta
        // e.g. 0.1 -> 1.1x (Zoom Out)
        // -0.1 -> 0.9x (Zoom In)

        const scale = 1 + delta;
        const newZoom = this.zoomLevel * scale;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

        // Update immediately if possible, or wait for next frame
        if (this.playerMesh) {
            // Force camera update?
            // We can just wait for next frame or trigger an update if we tracked last pos.
        }
        console.log(`Zoom Level: ${this.zoomLevel}`);
    }

    updatePathMarkers(path) {
        // Clear existing markers
        // Efficient clearance: remove children
        // Better: Object Pooling (but for simplicity, recreate for now, path length isn't huge maybe 200-500 nodes max)

        while (this.pathGroup.children.length > 0) {
            this.pathGroup.remove(this.pathGroup.children[0]);
        }

        if (!path || path.length === 0) return;

        // Skip start position (player pos) to avoid clutter? Or show all.
        // Let's show all from next step
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);

        // Use InstancedMesh for performance if path is long?
        // Let's stick to individual meshes for simplicity first or Instanced if path > 50?
        // 150x150 maze path can be long. InstancedMesh is safer.

        const count = path.length;
        const instancedMesh = new THREE.InstancedMesh(geometry, this.pathMaterial, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const node = path[i];
            // Position: (x, 0.5, y) - half wall height (wall is 1 high?)
            // Walls are BoxGeometry(1,1,1). Center is at 0 in scene? 
            // In generateMazeMesh: walls are at y=-0.5 but geometry is 1x1x1.
            // Wait, wall gen:
            // dummy.position.set(x, 0, y);
            // Height is 1. Center of box 0 means y goes from -0.5 to 0.5.
            // So top of wall is 0.5. Half height is 0.
            // Floor is at -0.5.
            // "half height of the wall" -> y = 0.
            // User said: "on the half height of the wall in the middle of the game field"
            // Let's place it at y=0.0 which is exactly mid-height if wall goes -0.5 to 0.5.

            dummy.position.set(node.x, 0.0, node.y);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        this.pathGroup.add(instancedMesh);
    }

    updatePlayerPosition(pos, facing) {
        if (this.playerMesh) {
            // Smoothly interpolate if needed, but for now direct set
            // In main loop we might animate
            this.playerMesh.position.copy(pos);

            if (this.perspective === 'firstPerson' && facing) {
                // First Person Camera
                // Position camera slightly above player
                this.camera.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));

                // Look at position + facing vector
                // We need to ensure we don't look at exactly the camera position
                const lookTarget = new THREE.Vector3().copy(pos).add(facing);
                this.camera.lookAt(lookTarget.x, 0.4, lookTarget.z);
            } else {
                // Overhead view slightly angled
                // Base coords:
                // x = pos.x
                // z = pos.z + 5 * zoomLevel
                // y = 8 * zoomLevel

                this.camera.position.x = pos.x;
                this.camera.position.z = pos.z + (5 * this.zoomLevel);
                this.camera.position.y = 8 * this.zoomLevel;
                this.camera.lookAt(pos.x, 0, pos.z);
            }
        }
    }

    render() {
        if (this.exitMesh) {
            this.exitMesh.rotation.y += 0.02; // Animate exit marker
            this.exitMesh.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.2;
        }
        this.renderer.render(this.scene, this.camera);
    }
}
