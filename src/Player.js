import * as THREE from 'three';

export class Player {
    constructor(maze, renderer) {
        this.maze = maze;
        this.renderer = renderer;

        // Logical Grid Position
        this.gridPos = { ...maze.start };

        // Visual Position (Three.js Vector3)
        this.worldPos = new THREE.Vector3(this.gridPos.x, 0, this.gridPos.y);
        this.targetPos = new THREE.Vector3(this.gridPos.x, 0, this.gridPos.y);
        this.facing = new THREE.Vector3(0, 0, 1); // Default facing (Grid +Y / World +Z)
        this.lastRotationTime = 0;

        this.isMoving = false;
        this.moveSpeed = 10.0; // Units per second

        this.setupInput();
        this.renderer.createPlayer(this.gridPos);
    }

    setupInput() {
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            w: false,
            a: false,
            s: false,
            d: false
        };

        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = false;
            }
        });
    }

    update(deltaTime) {
        if (this.isMoving) {
            // Animate towards target
            const direction = new THREE.Vector3().subVectors(this.targetPos, this.worldPos);
            const dist = direction.length();

            if (dist < 0.05) {
                // Arrived
                this.worldPos.copy(this.targetPos);
                this.isMoving = false;
                this.checkWinCondition();
            } else {
                direction.normalize();
                this.worldPos.add(direction.multiplyScalar(this.moveSpeed * deltaTime));
            }
        } else {
            // Check Input
            let dx = 0;
            let dy = 0;

            if (this.renderer.perspective === 'firstPerson') {
                // Tank Controls relative to facing
                // Facing is vector (x, z) basically. 

                // Rotate Left/Right (A/D or Arrows)
                // We use a cooldown or key down check to prevent spinning too fast? 
                // Grid movement is discrete steps. 
                // For rotation, let's make it instant but wait for keyup or delay? 
                // Or just on key press? update() runs every frame.
                // tryMove handles distinct steps. 
                // For rotation, we should just rotate facing and set isMoving = false (or immediate).
                // But tryMove is designed for Grid Position updates.

                // Let's separate Rotation from Movement.

                // Rotation (A/Left, D/Right)
                // We need to ensure we only rotate once per key press or have a delay.
                // But `this.keys` is continuous. 
                // Let's stick to standard behavior: if isMoving is false, we accept a command.

                if (this.keys.ArrowLeft || this.keys.a) {
                    this.rotate(-1); // Left
                    return; // Consumed input
                } else if (this.keys.ArrowRight || this.keys.d) {
                    this.rotate(1); // Right
                    return;
                }

                // Movement (W/Up, S/Down)
                let moveDir = 0; // 1 forward, -1 backward
                if (this.keys.ArrowUp || this.keys.w) moveDir = 1;
                else if (this.keys.ArrowDown || this.keys.s) moveDir = -1;

                if (moveDir !== 0) {
                    dx = this.facing.x * moveDir;
                    dy = this.facing.z * moveDir;
                    this.tryMove(dx, dy, false); // Tank controls: movement does not change facing
                }

            } else {
                // Overhead - Cardinal absolute movement
                if (this.keys.ArrowUp || this.keys.w) dy = -1;
                else if (this.keys.ArrowDown || this.keys.s) dy = 1;
                else if (this.keys.ArrowLeft || this.keys.a) dx = -1;
                else if (this.keys.ArrowRight || this.keys.d) dx = 1;

                if (dx !== 0 || dy !== 0) {
                    this.tryMove(dx, dy, true); // Overhead: movement updates facing
                }
            }
        }

        this.renderer.updatePlayerPosition(this.worldPos, this.facing);
    }

    tryMove(dx, dy) {
        // Can't move diagonally in one step logically here usually, but if simultaneous keys, pick one?
        // Let's just normalize if user presses both, but grid movement is usually axis aligned.
        // Simplest: Priority or cancel out.
        // If both dx and dy are set, prefer the one that was maybe pressed last? 
        // Or just allow diagonal? Maze logic usually implies 4 cardinal directions.
        // Let's enforce cardinal movement (no diagonal through walls).

        if (dx !== 0 && dy !== 0) {
            // Just move X for now if both? or ignore diagonal.
            dy = 0;
        }

        const nextX = this.gridPos.x + dx;
        const nextY = this.gridPos.y + dy;

        console.log(`tryMove: dx=${dx}, dy=${dy}, perspective=${this.renderer.perspective}, currentFacing=${this.facing.x},${this.facing.z}, valid=${this.isValidMove(nextX, nextY)}`);

        if (this.isValidMove(nextX, nextY)) {
            this.gridPos.x = nextX;
            this.gridPos.y = nextY;
            this.targetPos.set(nextX, 0, nextY);

            // Only update facing if NOT in first person mode (where facing is independent of movement direction)
            // Or only if we are moving forward/different logic?
            // Actually, in tank controls, rotation is explicit. Movement (forward/back) preserves facing.
            // So we should NOT update facing here if in firstPerson mode.
            if (this.renderer.perspective !== 'firstPerson') {
                this.facing.set(dx, 0, dy);
            }

            this.isMoving = true;
        }
    }

    isValidMove(x, y) {
        // Check bounds
        if (x < 0 || x >= this.maze.width || y < 0 || y >= this.maze.height) {
            return false;
        }
        // Check walls (1 is wall, 0 is path)
        if (this.maze.grid[x][y] === 1) {
            return false;
        }
        return true;
    }

    rotate(dir) {
        // dir: -1 for left (CCW), 1 for right (CW)
        const now = Date.now();
        if (now - this.lastRotationTime < 200) return; // Debounce rotation
        this.lastRotationTime = now;

        // Rotate facing vector around Y axis
        // In grid coords:
        // (0, 1) -> Rotate -90 (Left) -> (1, 0) ??
        // Let's visualize.
        // Facing (0, 1) [Down/South]. Left (-90 deg) should be Right/East (1, 0)? 
        // Standard Math: 0 deg is East (1,0). 90 is North (0, 1).
        // If we are (0,1) and rotate +90 (CCW), we get (-1, 0).
        // If we want tank controls:
        // "Left" key = Turn Left = CCW.
        // "Right" key = Turn Right = CW.

        const axis = new THREE.Vector3(0, 1, 0);
        // dir * -Math.PI/2 for 90 degrees?
        // Right (CW) is negative angle in standard math typically? 
        // Let's try: Right Key (dir=1) -> Rotate -90 deg (-PI/2).
        // Left Key (dir=-1) -> Rotate +90 deg (+PI/2).
        const angle = dir * -Math.PI / 2;

        this.facing.applyAxisAngle(axis, angle);

        // Round to nearest integer to avoid float drift
        this.facing.x = Math.round(this.facing.x);
        this.facing.z = Math.round(this.facing.z);

        // Update renderer immediately to show rotation
        this.renderer.updatePlayerPosition(this.worldPos, this.facing);
    }

    checkWinCondition() {
        if (this.gridPos.x === this.maze.end.x && this.gridPos.y === this.maze.end.y) {
            alert("You escaped the maze!");
            // Reset game?
            location.reload();
        }
    }
}
