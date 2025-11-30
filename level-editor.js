class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Editor state
        this.currentTool = 'select';
        this.selectedObject = null;
        this.objects = [];
        this.portals = [];
        this.speedPortals = [];
        this.finishPortals = [];

        // View state
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.gridSize = 20;
        this.gridSnap = true;

        // Mouse state
        this.mouse = { x: 0, y: 0, down: false };
        this.isDragging = false;
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;

        // Current object properties
        this.currentObjectType = 'spike';
        this.currentGameMode = 'cube';
        this.currentSpeed = 1.0;
        this.objectWidth = 40;
        this.objectHeight = 40;
        this.objectRotation = 0;

        this.setupEventListeners();
        this.loadLevelFromLocalStorage();
        this.render();
    }

    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.tool-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.currentTool = e.target.dataset.tool;
                this.selectedObject = null;

                // Clear other button states when switching tools
                document.querySelectorAll('.portal-btn, .obstacle-btn, .speed-btn').forEach(b => b.classList.remove('active'));
            });
        });

        // Obstacle selection
        document.querySelectorAll('.obstacle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active state from all obstacle buttons
                document.querySelectorAll('.obstacle-btn').forEach(b => b.classList.remove('active'));
                // Add active state to clicked button
                e.target.classList.add('active');

                this.currentObjectType = e.target.dataset.type;
                this.currentTool = 'place';
                document.querySelector('.tool-btn.active').classList.remove('active');
                document.querySelector('[data-tool="place"]').classList.add('active');

                // Clear other button states
                document.querySelectorAll('.portal-btn, .speed-btn').forEach(b => b.classList.remove('active'));
            });
        });

        // Portal selection
        document.querySelectorAll('.portal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active state from all portal buttons
                document.querySelectorAll('.portal-btn').forEach(b => b.classList.remove('active'));
                // Add active state to clicked button
                e.target.classList.add('active');

                // Check if it's a finish portal
                if (e.target.dataset.type === 'finish') {
                    this.currentObjectType = 'finishPortal';
                } else {
                    this.currentGameMode = e.target.dataset.mode;
                    this.currentObjectType = 'portal';
                }

                this.currentTool = 'place';
                document.querySelector('.tool-btn.active').classList.remove('active');
                document.querySelector('[data-tool="place"]').classList.add('active');

                // Clear other button states
                document.querySelectorAll('.obstacle-btn, .speed-btn').forEach(b => b.classList.remove('active'));
            });
        });

        // Speed portal selection
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active state from all speed buttons
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                // Add active state to clicked button
                e.target.classList.add('active');

                this.currentSpeed = parseFloat(e.target.dataset.speed);
                this.currentTool = 'place';
                this.currentObjectType = 'speedPortal';
                document.querySelector('.tool-btn.active').classList.remove('active');
                document.querySelector('[data-tool="place"]').classList.add('active');

                // Clear other button states
                document.querySelectorAll('.obstacle-btn, .portal-btn').forEach(b => b.classList.remove('active'));
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Property controls
        document.getElementById('gridSnap').addEventListener('change', (e) => {
            this.gridSnap = e.target.checked;
        });

        document.getElementById('gridSize').addEventListener('input', (e) => {
            this.gridSize = parseInt(e.target.value);
        });

        document.getElementById('objectWidth').addEventListener('input', (e) => {
            this.objectWidth = parseInt(e.target.value);
        });

        document.getElementById('objectHeight').addEventListener('input', (e) => {
            this.objectHeight = parseInt(e.target.value);
        });

        document.getElementById('objectRotation').addEventListener('input', (e) => {
            this.objectRotation = parseInt(e.target.value);
            document.getElementById('rotationValue').textContent = this.objectRotation + '°';
        });

        document.getElementById('rotateLeft').addEventListener('click', () => {
            this.objectRotation = (this.objectRotation - 15 + 360) % 360;
            document.getElementById('objectRotation').value = this.objectRotation;
            document.getElementById('rotationValue').textContent = this.objectRotation + '°';
        });

        document.getElementById('rotateRight').addEventListener('click', () => {
            this.objectRotation = (this.objectRotation + 15) % 360;
            document.getElementById('objectRotation').value = this.objectRotation;
            document.getElementById('rotationValue').textContent = this.objectRotation + '°';
        });

        document.getElementById('resetRotation').addEventListener('click', () => {
            this.objectRotation = 0;
            document.getElementById('objectRotation').value = 0;
            document.getElementById('rotationValue').textContent = '0°';
        });

        // Viewport controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetView').addEventListener('click', () => this.resetView());

        // Header controls
        document.getElementById('playTestBtn').addEventListener('click', () => this.playTest());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveLevel());
        document.getElementById('loadBtn').addEventListener('click', () => this.loadLevel());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearLevel());
        document.getElementById('backToGameBtn').addEventListener('click', () => this.backToGame());

        // Modal events
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modalConfirm').addEventListener('click', () => this.confirmModal());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / this.zoom + this.camera.x;
        this.mouse.y = (e.clientY - rect.top) / this.zoom + this.camera.y;
        this.mouse.down = true;

        // Middle mouse button or right mouse button for panning
        if (e.button === 1 || e.button === 2) {
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (this.gridSnap) {
            this.mouse.x = Math.round(this.mouse.x / this.gridSize) * this.gridSize;
            this.mouse.y = Math.round(this.mouse.y / this.gridSize) * this.gridSize;
        }

        switch (this.currentTool) {
            case 'place':
                this.placeObject();
                break;
            case 'select':
                this.selectObject();
                break;
            case 'delete':
                this.deleteObject();
                break;
        }
    }

    onMouseMove(e) {
        // Handle panning
        if (this.isPanning) {
            const deltaX = e.clientX - this.lastPanX;
            const deltaY = e.clientY - this.lastPanY;

            this.camera.x -= deltaX / this.zoom;
            this.camera.y -= deltaY / this.zoom;

            // Prevent scrolling too far left
            this.camera.x = Math.max(0, this.camera.x);

            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;

            this.render();
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / this.zoom + this.camera.x;
        this.mouse.y = (e.clientY - rect.top) / this.zoom + this.camera.y;

        if (this.gridSnap) {
            this.mouse.x = Math.round(this.mouse.x / this.gridSize) * this.gridSize;
            this.mouse.y = Math.round(this.mouse.y / this.gridSize) * this.gridSize;
        }

        // Update mouse position display
        document.getElementById('mousePos').textContent = `${Math.round(this.mouse.x)}, ${Math.round(this.mouse.y)}`;

        if (this.mouse.down && this.selectedObject && this.currentTool === 'select') {
            this.selectedObject.x = this.mouse.x;
            this.selectedObject.y = this.mouse.y;
            this.isDragging = true;
        }

        this.render();
    }

    onMouseUp(e) {
        this.mouse.down = false;
        this.isDragging = false;

        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    onWheel(e) {
        e.preventDefault();

        if (e.ctrlKey) {
            // Zoom with Ctrl + wheel
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.1, Math.min(3, this.zoom * zoomFactor));
            document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
        } else {
            // Horizontal scroll without Ctrl
            const scrollAmount = e.deltaY * 2;
            this.camera.x += scrollAmount;
            // Prevent scrolling too far left
            this.camera.x = Math.max(0, this.camera.x);
        }

        this.render();
    }

    onKeyDown(e) {
        switch (e.key) {
            case 'Delete':
                if (this.selectedObject) {
                    this.deleteSelectedObject();
                }
                break;
            case 'Escape':
                this.selectedObject = null;
                break;
            case 'c':
                if (e.ctrlKey && this.selectedObject) {
                    this.copyObject();
                }
                break;
            case 'ArrowLeft':
                this.camera.x = Math.max(0, this.camera.x - 50);
                this.render();
                break;
            case 'ArrowRight':
                this.camera.x += 50;
                this.render();
                break;
            case 'ArrowUp':
                this.camera.y = Math.max(-200, this.camera.y - 50);
                this.render();
                break;
            case 'ArrowDown':
                this.camera.y = Math.min(200, this.camera.y + 50);
                this.render();
                break;
        }
    }

    placeObject() {
        const newObject = {
            x: this.mouse.x,
            y: this.mouse.y,
            width: this.objectWidth,
            height: this.objectHeight,
            type: this.currentObjectType,
            rotation: this.objectRotation
        };

        if (this.currentObjectType === 'portal') {
            newObject.mode = this.currentGameMode;
            // Make portals span the full height and wider to ensure they can't be avoided
            newObject.width = 60; // Make wider
            newObject.height = this.canvas.height - 50; // Full height minus ground
            newObject.y = 0; // Start from top
            this.portals.push(newObject);
        } else if (this.currentObjectType === 'speedPortal') {
            newObject.speed = this.currentSpeed;
            this.speedPortals.push(newObject);
        } else if (this.currentObjectType === 'finishPortal') {
            // Make finish portals span the full height and wider like regular portals
            newObject.width = 60; // Make wider
            newObject.height = this.canvas.height - 50; // Full height minus ground
            newObject.y = 0; // Start from top
            this.finishPortals.push(newObject);
        } else {
            this.objects.push(newObject);
        }

        this.updateStats();
    }

    selectObject() {
        this.selectedObject = null;

        // Check objects
        for (let obj of [...this.objects, ...this.portals, ...this.speedPortals, ...this.finishPortals]) {
            if (this.mouse.x >= obj.x && this.mouse.x <= obj.x + obj.width &&
                this.mouse.y >= obj.y && this.mouse.y <= obj.y + obj.height) {
                this.selectedObject = obj;
                break;
            }
        }
    }

    deleteObject() {
        // Check objects
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (this.mouse.x >= obj.x && this.mouse.x <= obj.x + obj.width &&
                this.mouse.y >= obj.y && this.mouse.y <= obj.y + obj.height) {
                this.objects.splice(i, 1);
                this.updateStats();
                return;
            }
        }

        // Check portals
        for (let i = this.portals.length - 1; i >= 0; i--) {
            const obj = this.portals[i];
            if (this.mouse.x >= obj.x && this.mouse.x <= obj.x + obj.width &&
                this.mouse.y >= obj.y && this.mouse.y <= obj.y + obj.height) {
                this.portals.splice(i, 1);
                this.updateStats();
                return;
            }
        }

        // Check speed portals
        for (let i = [].length - 1; i >= 0; i--) {
            const obj = [][i];
            if (this.mouse.x >= obj.x && this.mouse.x <= obj.x + obj.width &&
                this.mouse.y >= obj.y && this.mouse.y <= obj.y + obj.height) {
                [].splice(i, 1);
                this.updateStats();
                return;
            }
        }

        // Check finish portals
        for (let i = this.finishPortals.length - 1; i >= 0; i--) {
            const obj = this.finishPortals[i];
            if (this.mouse.x >= obj.x && this.mouse.x <= obj.x + obj.width &&
                this.mouse.y >= obj.y && this.mouse.y <= obj.y + obj.height) {
                this.finishPortals.splice(i, 1);
                this.updateStats();
                return;
            }
        }
    }

    deleteSelectedObject() {
        if (!this.selectedObject) return;

        // Remove from appropriate array
        let index = this.objects.indexOf(this.selectedObject);
        if (index !== -1) {
            this.objects.splice(index, 1);
        } else {
            index = this.portals.indexOf(this.selectedObject);
            if (index !== -1) {
                this.portals.splice(index, 1);
            } else {
                index = [].indexOf(this.selectedObject);
                if (index !== -1) {
                    [].splice(index, 1);
                } else {
                    index = this.finishPortals.indexOf(this.selectedObject);
                    if (index !== -1) {
                        this.finishPortals.splice(index, 1);
                    }
                }
            }
        }

        this.selectedObject = null;
        this.updateStats();
    }

    zoomIn() {
        this.zoom = Math.min(3, this.zoom * 1.2);
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(0.1, this.zoom * 0.8);
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    resetView() {
        this.zoom = 1;
        this.camera.x = 0;
        this.camera.y = 0;
        document.getElementById('zoomLevel').textContent = '100%';
        this.render();
    }

    updateStats() {
        const totalObjects = this.objects.length + this.portals.length + [].length;
        document.getElementById('objectCount').textContent = totalObjects;

        let maxX = 0;
        [...this.objects, ...this.portals, ...[]].forEach(obj => {
            maxX = Math.max(maxX, obj.x + obj.width);
        });
        document.getElementById('levelLength').textContent = maxX;
    }

    render() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera and zoom
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw grid
        if (this.gridSnap) {
            this.drawGrid();
        }

        // Draw ground - align to grid for consistent snapping
        // Account for the canvas transforms: scale and translate are applied
        // Game ground is at canvas.height - 50, but we need to position it in world space
        const gameGroundY = (this.canvas.height - 50) / this.zoom + this.camera.y;
        const gridAlignedGroundY = Math.round(gameGroundY / this.gridSize) * this.gridSize;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.camera.x, gridAlignedGroundY,
                         this.canvas.width / this.zoom, 50 / this.zoom);

        // Draw objects
        this.drawObjects();
        this.drawPortals();
        this.drawSpeedPortals();
        this.drawFinishPortals();

        // Draw preview object
        if (this.currentTool === 'place') {
            this.drawPreview();
        }

        // Draw selection
        if (this.selectedObject) {
            this.drawSelection();
        }

        this.ctx.restore();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
        this.ctx.lineWidth = 1;

        // Calculate ground position for proper alignment - exactly match game
        // Account for the canvas transforms: scale and translate are applied
        const gameGroundY = (this.canvas.height - 50) / this.zoom + this.camera.y;

        // Snap the baseline to the nearest grid line for proper alignment
        // This ensures both the visual grid and snapping work together
        const baselineY = Math.round(gameGroundY / this.gridSize) * this.gridSize;

        const startX = Math.floor(this.camera.x / this.gridSize) * this.gridSize;
        const endX = this.camera.x + this.canvas.width / this.zoom;
        const startY = Math.floor(this.camera.y / this.gridSize) * this.gridSize;
        const endY = this.camera.y + this.canvas.height / this.zoom;

        // Draw vertical grid lines
        for (let x = startX; x <= endX; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.camera.y);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }

        // Draw horizontal grid lines aligned to ground baseline
        for (let y = baselineY; y >= startY; y -= this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.camera.x, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }

        for (let y = baselineY + this.gridSize; y <= endY; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.camera.x, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }

    drawObjects() {
        this.objects.forEach(obj => {
            this.ctx.fillStyle = this.getObjectColor(obj.type);

            // Handle rotation if present
            if (obj.rotation && obj.rotation !== 0) {
                this.drawRotatedObject(obj);
            } else {
                // Draw slanted objects as triangles
                if (obj.type === 'slope-up' || obj.type === 'slope-down' ||
                    obj.type === 'steep-up' || obj.type === 'steep-down') {
                    this.drawSlopedObject(obj);
                } else {
                    this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                }

                if (obj.type === 'platform') {
                    this.ctx.strokeStyle = '#4CAF50';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                } else if (obj.type === 'jump-pad') {
                    // Draw jump pad with arrow indicator
                    this.ctx.strokeStyle = '#ffffff';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

                    // Draw upward arrow to indicate jump boost
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    const centerX = obj.x + obj.width / 2;
                    const centerY = obj.y + obj.height / 2;
                    const arrowSize = Math.min(obj.width, obj.height) * 0.3;

                    // Arrow body
                    this.ctx.fillRect(centerX - arrowSize * 0.2, centerY - arrowSize * 0.5, arrowSize * 0.4, arrowSize);

                    // Arrow head
                    this.ctx.moveTo(centerX, centerY - arrowSize * 0.7);
                    this.ctx.lineTo(centerX - arrowSize * 0.5, centerY - arrowSize * 0.1);
                    this.ctx.lineTo(centerX + arrowSize * 0.5, centerY - arrowSize * 0.1);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
            }
        });
    }

    drawSlopedObject(obj) {
        this.ctx.beginPath();

        switch (obj.type) {
            case 'slope-up': // 45° upward slope ↗
                this.ctx.moveTo(obj.x, obj.y + obj.height); // bottom-left
                this.ctx.lineTo(obj.x + obj.width, obj.y); // top-right
                this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height); // bottom-right
                break;
            case 'slope-down': // 45° downward slope ↘
                this.ctx.moveTo(obj.x, obj.y); // top-left
                this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height); // bottom-right
                this.ctx.lineTo(obj.x, obj.y + obj.height); // bottom-left
                break;
            case 'steep-up': // 60° upward slope
                this.ctx.moveTo(obj.x, obj.y + obj.height); // bottom-left
                this.ctx.lineTo(obj.x + obj.width * 0.7, obj.y); // top-right (steeper)
                this.ctx.lineTo(obj.x + obj.width, obj.y + obj.height); // bottom-right
                break;
            case 'steep-down': // 60° downward slope
                this.ctx.moveTo(obj.x, obj.y); // top-left
                this.ctx.lineTo(obj.x + obj.width * 0.7, obj.y + obj.height); // bottom-right (steeper)
                this.ctx.lineTo(obj.x + obj.width, obj.y); // top-right
                break;
        }

        this.ctx.closePath();
        this.ctx.fill();

        // Add stroke for better visibility
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawRotatedObject(obj) {
        this.ctx.save();

        // Calculate center point for rotation
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;

        // Move to center, rotate, then move back
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate((obj.rotation * Math.PI) / 180);
        this.ctx.translate(-centerX, -centerY);

        // Draw the object
        if (obj.type === 'slope-up' || obj.type === 'slope-down' ||
            obj.type === 'steep-up' || obj.type === 'steep-down') {
            this.drawSlopedObject(obj);
        } else {
            this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height);

            if (obj.type === 'platform') {
                this.ctx.strokeStyle = '#4CAF50';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            } else if (obj.type === 'jump-pad') {
                // Draw jump pad with arrow indicator
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

                // Draw upward arrow to indicate jump boost
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                const centerX = obj.x + obj.width / 2;
                const centerY = obj.y + obj.height / 2;
                const arrowSize = Math.min(obj.width, obj.height) * 0.3;

                // Arrow body
                this.ctx.fillRect(centerX - arrowSize * 0.2, centerY - arrowSize * 0.5, arrowSize * 0.4, arrowSize);

                // Arrow head
                this.ctx.moveTo(centerX, centerY - arrowSize * 0.7);
                this.ctx.lineTo(centerX - arrowSize * 0.5, centerY - arrowSize * 0.1);
                this.ctx.lineTo(centerX + arrowSize * 0.5, centerY - arrowSize * 0.1);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }

        this.ctx.restore();
    }

    drawPortals() {
        this.portals.forEach(portal => {
            this.ctx.fillStyle = this.getPortalColor(portal.mode);

            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.save();
                const centerX = portal.x + portal.width / 2;
                const centerY = portal.y + portal.height / 2;
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((portal.rotation * Math.PI) / 180);
                this.ctx.translate(-centerX, -centerY);
            }

            this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

            // Draw portal icon
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(portal.mode.toUpperCase(),
                            portal.x + portal.width/2,
                            portal.y + portal.height/2 + 4);

            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.restore();
            }
        });
    }

    drawSpeedPortals() {
        this.speedPortals.forEach(portal => {
            this.ctx.fillStyle = this.getSpeedColor(portal.speed);

            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.save();
                const centerX = portal.x + portal.width / 2;
                const centerY = portal.y + portal.height / 2;
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((portal.rotation * Math.PI) / 180);
                this.ctx.translate(-centerX, -centerY);
            }

            this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

            // Draw speed text
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${portal.speed}x`,
                            portal.x + portal.width/2,
                            portal.y + portal.height/2 + 3);

            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.restore();
            }
        });
    }

    drawFinishPortals() {
        this.finishPortals.forEach(portal => {
            this.ctx.fillStyle = '#FFD700'; // Gold color for finish portal

            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.save();
                const centerX = portal.x + portal.width / 2;
                const centerY = portal.y + portal.height / 2;
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((portal.rotation * Math.PI) / 180);
                this.ctx.translate(-centerX, -centerY);
            }

            this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

            // Draw finish text
            this.ctx.fillStyle = 'black';
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('FINISH',
                            portal.x + portal.width/2,
                            portal.y + portal.height/2 + 4);

            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.restore();
            }
        });
    }

    drawPreview() {
        this.ctx.globalAlpha = 0.5;

        const previewObj = {
            x: this.mouse.x,
            y: this.mouse.y,
            width: this.objectWidth,
            height: this.objectHeight,
            type: this.currentObjectType,
            rotation: this.objectRotation
        };

        if (this.currentObjectType === 'portal') {
            previewObj.mode = this.currentGameMode;
            this.ctx.fillStyle = this.getPortalColor(this.currentGameMode);
        } else if (this.currentObjectType === 'speedPortal') {
            previewObj.speed = this.currentSpeed;
            this.ctx.fillStyle = this.getSpeedColor(this.currentSpeed);
        } else if (this.currentObjectType === 'finishPortal') {
            this.ctx.fillStyle = '#FFD700'; // Gold color for finish portal
        } else {
            this.ctx.fillStyle = this.getObjectColor(this.currentObjectType);
        }

        // Draw preview with rotation
        if (this.objectRotation && this.objectRotation !== 0) {
            this.ctx.save();
            const centerX = this.mouse.x + this.objectWidth / 2;
            const centerY = this.mouse.y + this.objectHeight / 2;
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate((this.objectRotation * Math.PI) / 180);
            this.ctx.translate(-centerX, -centerY);
        }

        if (this.currentObjectType === 'portal') {
            this.ctx.fillRect(this.mouse.x, this.mouse.y, this.objectWidth, this.objectHeight);
        } else if (this.currentObjectType === '') {
            this.ctx.fillRect(this.mouse.x, this.mouse.y, this.objectWidth, this.objectHeight);
        } else {
            // Draw slanted object preview
            if (this.currentObjectType === 'slope-up' || this.currentObjectType === 'slope-down' ||
                this.currentObjectType === 'steep-up' || this.currentObjectType === 'steep-down') {
                this.drawSlopedObject(previewObj);
            } else {
                this.ctx.fillRect(this.mouse.x, this.mouse.y, this.objectWidth, this.objectHeight);

                // Add jump-pad arrow for preview
                if (this.currentObjectType === 'jump-pad') {
                    this.ctx.strokeStyle = '#ffffff';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(this.mouse.x, this.mouse.y, this.objectWidth, this.objectHeight);

                    // Draw upward arrow to indicate jump boost
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    const centerX = this.mouse.x + this.objectWidth / 2;
                    const centerY = this.mouse.y + this.objectHeight / 2;
                    const arrowSize = Math.min(this.objectWidth, this.objectHeight) * 0.3;

                    // Arrow body
                    this.ctx.fillRect(centerX - arrowSize * 0.2, centerY - arrowSize * 0.5, arrowSize * 0.4, arrowSize);

                    // Arrow head
                    this.ctx.moveTo(centerX, centerY - arrowSize * 0.7);
                    this.ctx.lineTo(centerX - arrowSize * 0.5, centerY - arrowSize * 0.1);
                    this.ctx.lineTo(centerX + arrowSize * 0.5, centerY - arrowSize * 0.1);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
            }
        }

        if (this.objectRotation && this.objectRotation !== 0) {
            this.ctx.restore();
        }

        this.ctx.globalAlpha = 1;
    }

    drawSelection() {
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(this.selectedObject.x - 2, this.selectedObject.y - 2,
                          this.selectedObject.width + 4, this.selectedObject.height + 4);
        this.ctx.setLineDash([]);
    }

    getObjectColor(type) {
        const colors = {
            'spike': '#ff4444',
            'platform': '#4CAF50',
            'jump-pad': '#00ff00',
            'wall-top': '#ff9800',
            'wall-bottom': '#ff9800',
            'slope-up': '#9C27B0',
            'slope-down': '#9C27B0',
            'steep-up': '#673AB7',
            'steep-down': '#673AB7'
        };
        return colors[type] || '#ffffff';
    }

    getPortalColor(mode) {
        const colors = {
            'cube': '#00ff88',
            'wave': '#2196F3',
            'ship': '#FF9800',
            'ball': '#9C27B0',
            'spider': '#00ffff'
        };
        return colors[mode] || '#ffffff';
    }

    getSpeedColor(speed) {
        const colors = {
            0.5: '#4CAF50',
            0.75: '#8BC34A',
            1.0: '#00ff88',
            1.5: '#FFC107',
            2.0: '#FF9800',
            3.0: '#F44336',
            4.0: '#9C27B0'
        };
        return colors[speed] || '#ffffff';
    }

    playTest() {
        // Save current level to localStorage for testing
        const levelData = this.exportLevel();
        localStorage.setItem('customLevel', levelData);

        // Open game in new tab/window with custom level
        window.open('geometry-dash.html?custom=true', '_blank');
    }

    saveLevel() {
        const levelData = this.exportLevel();
        document.getElementById('levelData').value = levelData;
        document.getElementById('modalTitle').textContent = 'Save Level';
        document.getElementById('levelModal').style.display = 'block';
    }

    loadLevel() {
        document.getElementById('levelData').value = '';
        document.getElementById('modalTitle').textContent = 'Load Level';
        document.getElementById('levelModal').style.display = 'block';
    }

    clearLevel() {
        if (confirm('Are you sure you want to clear all objects?')) {
            this.objects = [];
            this.portals = [];
                this.selectedObject = null;
            this.updateStats();
            this.render();
        }
    }

    backToGame() {
        window.location.href = 'geometry-dash.html';
    }

    closeModal() {
        document.getElementById('levelModal').style.display = 'none';
    }

    confirmModal() {
        const title = document.getElementById('modalTitle').textContent;
        const data = document.getElementById('levelData').value;

        if (title === 'Save Level') {
            // Copy to clipboard or download
            navigator.clipboard.writeText(data).then(() => {
                alert('Level data copied to clipboard!');
            }).catch(() => {
                // Fallback: create download
                const blob = new Blob([data], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${document.getElementById('levelName').value}.gd`;
                a.click();
            });
        } else if (title === 'Load Level') {
            try {
                this.importLevel(data);
                alert('Level loaded successfully!');
            } catch (e) {
                console.error('Error loading level:', e);
                alert('Invalid level data! Error: ' + e.message);
            }
        }

        this.closeModal();
    }

    compressLevel(levelData) {
        // Convert to compact JSON (no spaces)
        const jsonStr = JSON.stringify(levelData);

        // Simple compression: use shorter keys and remove unnecessary data
        const compressed = {
            v: 2, // Version 2 = compressed format
            n: levelData.name,
            d: levelData.difficulty,
            o: levelData.objects.map(obj => [
                Math.round(obj.x), Math.round(obj.y),
                Math.round(obj.width), Math.round(obj.height),
                obj.type, obj.rotation || 0, obj.gameMode || ''
            ]),
            p: levelData.portals.map(p => [
                Math.round(p.x), Math.round(p.y),
                Math.round(p.width), Math.round(p.height),
                p.mode, p.rotation || 0
            ]),
            sp: levelData.speedPortals.map(p => [
                Math.round(p.x), Math.round(p.y),
                Math.round(p.width), Math.round(p.height),
                p.speed, p.rotation || 0
            ]),
            fp: levelData.finishPortals.map(p => [
                Math.round(p.x), Math.round(p.y),
                Math.round(p.width), Math.round(p.height),
                p.rotation || 0
            ])
        };

        // Encode to base64 for further size reduction
        return btoa(JSON.stringify(compressed));
    }

    decompressLevel(compressedData) {
        try {
            // Trim whitespace
            compressedData = compressedData.trim();

            // Try to decode from base64
            const jsonStr = atob(compressedData);
            const data = JSON.parse(jsonStr);

            // Check if it's compressed format
            if (data.v === 2) {
                return {
                    name: data.n || 'Custom Level',
                    difficulty: data.d || 1,
                    objects: (data.o || []).map(o => ({
                        x: o[0], y: o[1], width: o[2], height: o[3],
                        type: o[4], rotation: o[5] || 0, gameMode: o[6] || ''
                    })),
                    portals: (data.p || []).map(p => ({
                        x: p[0], y: p[1], width: p[2], height: p[3],
                        mode: p[4], rotation: p[5] || 0
                    })),
                    speedPortals: (data.sp || []).map(p => ({
                        x: p[0], y: p[1], width: p[2], height: p[3],
                        speed: p[4], rotation: p[5] || 0
                    })),
                    finishPortals: (data.fp || []).map(p => ({
                        x: p[0], y: p[1], width: p[2], height: p[3],
                        rotation: p[4] || 0
                    }))
                };
            }

            // If not compressed, return as-is
            return data;
        } catch (e) {
            console.error('Base64 decode failed, trying regular JSON:', e);
            // If base64 decode fails, try parsing as regular JSON
            return JSON.parse(compressedData);
        }
    }

    exportLevel() {
        const levelData = {
            name: document.getElementById('levelName').value,
            difficulty: parseInt(document.getElementById('levelDifficulty').value),
            objects: this.objects,
            portals: this.portals,
            speedPortals: this.speedPortals,
            finishPortals: this.finishPortals,
            created: new Date().toISOString()
        };

        // Return compressed format
        return this.compressLevel(levelData);
    }

    importLevel(data) {
        const levelData = this.decompressLevel(data);

        this.objects = levelData.objects || [];
        this.portals = levelData.portals || [];
        this.speedPortals = levelData.speedPortals || [];
        this.finishPortals = levelData.finishPortals || [];

        document.getElementById('levelName').value = levelData.name || 'Custom Level';
        document.getElementById('levelDifficulty').value = levelData.difficulty || 1;

        this.selectedObject = null;
        this.updateStats();
        this.render();
    }

    loadLevelFromLocalStorage() {
        // Check if there's level data in localStorage (from editing a user level)
        const editLevelData = localStorage.getItem('editLevelData');
        if (editLevelData) {
            try {
                const levelData = JSON.parse(editLevelData);

                // Import the level data
                this.objects = levelData.objects || [];
                this.portals = levelData.portals || [];
                this.speedPortals = levelData.speedPortals || [];
                this.finishPortals = levelData.finishPortals || [];

                // Set metadata if available
                if (levelData.name) {
                    document.getElementById('levelName').value = levelData.name;
                }
                if (levelData.difficulty) {
                    document.getElementById('levelDifficulty').value = levelData.difficulty;
                }

                this.selectedObject = null;
                this.updateStats();

                // Clear the localStorage item after loading
                localStorage.removeItem('editLevelData');

                console.log('Loaded level from localStorage for editing');
            } catch (e) {
                console.error('Error loading level from localStorage:', e);
                localStorage.removeItem('editLevelData');
            }
        }
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LevelEditor();
});