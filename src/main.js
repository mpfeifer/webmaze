import * as THREE from 'three';
import { Maze } from './Maze.js';
import { Renderer } from './Renderer.js';
import { Player } from './Player.js';

class Game {
    constructor() {
        this.lastTime = 0;
        this.init();
    }

    init() {
        const loading = document.getElementById('loading');

        // 1. Generate Maze
        // Use a slight timeout to allow UI to show "Generating..." if it was heavy, 
        // but JS is single threaded so it blocks anyway unless we worker it. 
        // For 150x150 it should be fast enough.

        setTimeout(() => {
            this.maze = new Maze(150, 150);
            this.maze.generate();

            // 2. Setup Renderer
            loading.style.display = 'none';
            this.renderer = new Renderer('game-container', this.maze);

            // Wire up controls
            const toggle = document.getElementById('perspective-toggle');
            const hintToggle = document.getElementById('hint-toggle');
            const zoomIn = document.getElementById('zoom-in');
            const zoomOut = document.getElementById('zoom-out');

            const updateZoomButtons = (isFirstPerson) => {
                zoomIn.disabled = isFirstPerson;
                zoomOut.disabled = isFirstPerson;
            };

            toggle.addEventListener('change', (e) => {
                const isFirstPerson = e.target.checked;
                const mode = isFirstPerson ? 'firstPerson' : 'overhead';
                this.renderer.setPerspective(mode);
                updateZoomButtons(isFirstPerson);
            });

            hintToggle.addEventListener('change', (e) => {
                this.showHint = e.target.checked;
                if (this.showHint) {
                    this.updateHint();
                } else {
                    this.renderer.updatePathMarkers([]);
                }
            });

            zoomIn.addEventListener('click', () => {
                this.renderer.zoom(-0.1); // Zoom in (lower values)
            });

            zoomOut.addEventListener('click', () => {
                this.renderer.zoom(0.1); // Zoom out (higher values)
            });

            // 3. Setup Player
            this.player = new Player(this.maze, this.renderer);

            // 4. Start Loop
            requestAnimationFrame(this.loop.bind(this));
        }, 100);
    }

    loop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap deltaTime to prevent huge jumps if tab is backgrounded
        const safeDelta = Math.min(deltaTime, 0.1);

        this.player.update(safeDelta);
        this.renderer.render();

        // Update hint if player moved to a new grid cell
        if (this.showHint && !this.player.isMoving && (this.player.gridPos.x !== this.lastHintPos?.x || this.player.gridPos.y !== this.lastHintPos?.y)) {
            this.updateHint();
        }

        requestAnimationFrame(this.loop.bind(this));
    }

    updateHint() {
        const path = this.maze.solve(this.player.gridPos.x, this.player.gridPos.y);
        this.renderer.updatePathMarkers(path);
        this.lastHintPos = { ...this.player.gridPos };
    }
}

// Start Game
window.onload = () => {
    new Game();
};
