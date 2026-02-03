export class Maze {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.cellSize = 1; // Logical size
        this.start = { x: 0, y: 0 };
        this.end = { x: width - 1, y: height - 1 };

        // Initialize grid with walls
        // 1 = Wall, 0 = Path
        this.initGrid();
    }

    initGrid() {
        for (let x = 0; x < this.width; x++) {
            this.grid[x] = [];
            for (let y = 0; y < this.height; y++) {
                this.grid[x][y] = 1;
            }
        }
    }

    generate() {
        console.log(`Generating ${this.width}x${this.height} maze...`);
        // Randomized Prim's or Recursive Backtracker
        // Using Recursive Backtracker for long winding paths

        const stack = [];
        // Start at random point or 1,1 to ensure walls around edge?
        // Let's use 1,1 as start for generation to leave a border wall if desired,
        // but for this game we want the player to just be in the maze.
        // Let's strictly use odd coordinates for cells to ensure walls between them.

        // Pick a random starting cell (must be odd coordinates to align with wall grid logic)
        let current = {
            x: 1 + 2 * Math.floor(Math.random() * ((this.width - 1) / 2)),
            y: 1 + 2 * Math.floor(Math.random() * ((this.height - 1) / 2))
        };

        this.grid[current.x][current.y] = 0; // Mark as path
        stack.push(current);

        while (stack.length > 0) {
            current = stack[stack.length - 1]; // Peek
            const neighbors = this.getUnvisitedNeighbors(current);

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];

                // Remove wall between current and next
                const wallX = (current.x + next.x) / 2;
                const wallY = (current.y + next.y) / 2;
                this.grid[wallX][wallY] = 0;

                // Mark next as visited/path
                this.grid[next.x][next.y] = 0;

                stack.push(next);
            } else {
                stack.pop();
            }
        }

        // Ensure we pick a random start and end point that are actually on a path (0)
        this.findSpawnPoints();
    }

    getUnvisitedNeighbors(cell) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -2 }, // Up
            { x: 2, y: 0 },  // Right
            { x: 0, y: 2 },  // Down
            { x: -2, y: 0 }  // Left
        ];

        for (const dir of directions) {
            const nx = cell.x + dir.x;
            const ny = cell.y + dir.y;

            // Check bounds (leave 1 cell margin for border walls)
            if (nx > 0 && nx < this.width - 1 && ny > 0 && ny < this.height - 1) {
                if (this.grid[nx][ny] === 1) { // If it's a wall (unvisited in this context means still a wall)
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }

        return neighbors;
    }

    solve(startX, startY) {
        // BFS to find shortest path from (startX, startY) to this.end
        const queue = [{ x: startX, y: startY, path: [] }];
        const visited = new Set();
        visited.add(`${startX},${startY}`);

        while (queue.length > 0) {
            const { x, y, path } = queue.shift();

            // Calculate current path including this step
            const currentPath = [...path, { x, y }];

            if (x === this.end.x && y === this.end.y) {
                return currentPath;
            }

            // Get valid neighbors
            const neighbors = [
                { x: x, y: y - 1 }, // Up/North
                { x: x, y: y + 1 }, // Down/South
                { x: x - 1, y: y }, // Left/West
                { x: x + 1, y: y }  // Right/East
            ];

            for (const n of neighbors) {
                // Check bounds
                if (n.x >= 0 && n.x < this.width && n.y >= 0 && n.y < this.height) {
                    // Check walls (1 is wall)
                    if (this.grid[n.x][n.y] === 0) {
                        const key = `${n.x},${n.y}`;
                        if (!visited.has(key)) {
                            visited.add(key);
                            queue.push({ x: n.x, y: n.y, path: currentPath });
                        }
                    }
                }
            }
        }
        return []; // No path found
    }

    findSpawnPoints() {
        // Collect all navigable cells
        const openCells = [];
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (this.grid[x][y] === 0) {
                    openCells.push({ x, y });
                }
            }
        }

        if (openCells.length === 0) {
            console.error("Maze generation failed: No open cells.");
            return;
        }

        // Pick random start
        const startIdx = Math.floor(Math.random() * openCells.length);
        this.start = openCells[startIdx];

        // Pick random end (maybe ensure min distance?)
        let endIdx = Math.floor(Math.random() * openCells.length);
        while (endIdx === startIdx) {
            endIdx = Math.floor(Math.random() * openCells.length);
        }
        this.end = openCells[endIdx];
    }
}
