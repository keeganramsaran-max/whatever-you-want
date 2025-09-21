class GeometryDash {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 400;

        this.gameState = 'menu';
        this.gameMode = 'mixed';
        this.currentGameMode = 'cube';
        this.currentLevel = 1;
        this.maxLevel = 5;
        this.score = 0;
        this.attempts = 1;

        this.audioContext = null;
        this.sounds = {
            jump: null,
            death: null,
            music: null
        };
        this.volumeLevel = 0.5;

        this.initAudio();

        this.player = {
            x: 100,
            y: 300,
            width: 30,
            height: 30,
            velocity: 0,
            jumpPower: 11,
            gravity: 0.4,
            onGround: false,
            color: '#00ff88',
            trail: [],
            persistentWaveTrail: [],
            waveVelocity: 0,
            waveHorizontalVelocity: 0,
            waveSpeed: 3,
            shipVelocity: 0,
            shipSpeed: 4,
            ballVelocity: 0,
            ballSpeed: 6,
            rotation: 0,
            gravityDirection: 1,
            canChangeGravity: true
        };

        // Hitbox offsets for more forgiving collision
        this.hitboxOffset = {
            player: 4,     // Player hitbox is 4px smaller on each side
            obstacle: 3    // Obstacle hitboxes are 3px smaller on each side
        };

        this.obstacles = [];
        this.particles = [];
        this.portals = [];
        this.camera = { x: 0 };
        this.baseSpeed = 3.75;
        this.speed = 3.75;
        this.speedMultiplier = 1;
        this.lastObstacle = 0;
        this.showHitboxes = false;

        this.keys = {};
        this.mousePressed = false;

        this.setupEventListeners();
        this.checkForCustomLevel();
        this.generateLevel();
        this.gameLoop();
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createSounds();
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    createSounds() {
        this.sounds.jump = this.createBeep(800, 0.1);
        this.sounds.death = this.createBeep(200, 0.3);
        this.sounds.music = this.createBackgroundMusic();
    }

    createBeep(frequency, duration) {
        return () => {
            if (!this.audioContext) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'square';

            gainNode.gain.setValueAtTime(this.volumeLevel * 0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }

    createBackgroundMusic() {
        return () => {
            if (!this.audioContext) return;

            const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77];
            let noteIndex = 0;

            const playNote = () => {
                if (this.gameState !== 'playing') return;

                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.setValueAtTime(notes[noteIndex], this.audioContext.currentTime);
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(this.volumeLevel * 0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.5);

                noteIndex = (noteIndex + 1) % notes.length;

                setTimeout(playNote, 600);
            };

            playNote();
        };
    }

    playSound(soundName) {
        if (this.sounds[soundName] && this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.sounds[soundName]();
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if ((e.code === 'Space' || e.code === 'ArrowUp') && this.gameState === 'playing') {
                e.preventDefault();
                this.jump();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousedown', () => {
            this.mousePressed = true;
            if (this.gameState === 'playing' && this.gameMode === 'cube') {
                this.jump();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mousePressed = false;
        });

        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('editorBtn').addEventListener('click', () => {
            window.location.href = 'level-editor.html';
        });

        document.getElementById('showHitboxesBtn').addEventListener('click', () => {
            this.showHitboxes = !this.showHitboxes;
            document.getElementById('showHitboxesBtn').textContent =
                this.showHitboxes ? 'Hide Hitboxes' : 'Show Hitboxes';
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('volume').addEventListener('input', (e) => {
            this.volumeLevel = e.target.value / 100;
        });

        document.getElementById('gameMode').addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            this.updateInstructions();
            this.resetPlayerPosition();
            this.generateLevel();
        });

        document.getElementById('levelSelect').addEventListener('change', (e) => {
            this.currentLevel = parseInt(e.target.value);
            this.generateLevel();
            document.getElementById('currentLevel').textContent = this.currentLevel;
        });
    }

    updateInstructions() {
        const instructionText = document.getElementById('instructionText');
        if (this.gameMode === 'mixed') {
            instructionText.textContent = 'Controls change with each gamemode! Watch for portals!';
        } else if (this.gameMode === 'wave' || this.currentGameMode === 'wave') {
            instructionText.textContent = 'Hold SPACE/UP ARROW or click to fly up, release to fly down!';
        } else if (this.gameMode === 'ship' || this.currentGameMode === 'ship') {
            instructionText.textContent = 'Hold SPACE/UP ARROW or click to fly up, release to fall down!';
        } else if (this.gameMode === 'ball' || this.currentGameMode === 'ball') {
            instructionText.textContent = 'Press SPACE/UP ARROW or click to change gravity direction!';
        } else {
            instructionText.textContent = 'Press SPACE/UP ARROW or click to jump!';
        }
    }

    resetPlayerPosition() {
        this.player.x = 100;
        if (this.gameMode === 'mixed') {
            this.currentGameMode = 'cube';
            this.player.y = 300;
        } else if (this.gameMode === 'wave' || this.gameMode === 'ship') {
            this.player.y = (this.canvas.height - 50) / 2 - this.player.height / 2;
        } else {
            this.player.y = 300;
        }
        this.player.velocity = 0;
        this.player.waveVelocity = 0;
        this.player.waveHorizontalVelocity = 0;
        this.player.shipVelocity = 0;
        this.player.ballVelocity = 0;
        this.player.rotation = 0;
        this.player.gravityDirection = 1;
        this.player.canChangeGravity = true;
        this.player.onGround = false;
        this.player.trail = [];
        this.player.persistentWaveTrail = [];
        this.camera.x = 0;
    }

    jump() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

        if (mode === 'wave' || mode === 'ship') {
            return;
        }

        if (mode === 'ball') {
            if (this.player.canChangeGravity) {
                this.player.gravityDirection *= -1;
                this.player.canChangeGravity = false;
                this.playSound('jump');
            }
            return;
        }

        if (this.player.onGround || this.player.y >= this.canvas.height - this.player.height - 50) {
            this.player.velocity = -this.player.jumpPower * this.speedMultiplier;
            this.player.onGround = false;
            this.playSound('jump');

            for (let i = 0; i < 5; i++) {
                this.particles.push({
                    x: this.player.x,
                    y: this.player.y + this.player.height,
                    vx: (Math.random() - 0.5) * 4,
                    vy: Math.random() * -3,
                    life: 1,
                    decay: 0.02
                });
            }
        }
    }

    handleWaveMovement() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (mode !== 'wave') return;

        const isPressed = this.keys['Space'] || this.keys['ArrowUp'] || this.mousePressed;

        // Calculate 45-degree movement components - diagonal movement
        // Wave should move diagonally at constant speed, not add to base speed
        const totalSpeed = this.player.waveSpeed * this.speedMultiplier * 1.5;
        const diagonalVertical = totalSpeed * 0.707; // sin(45°) = 0.707
        const diagonalHorizontal = totalSpeed * 0.707; // cos(45°) = 0.707

        if (isPressed) {
            // Move up-right at 45-degree angle
            this.player.waveVelocity = -diagonalVertical; // Up movement
            this.player.waveHorizontalVelocity = diagonalHorizontal; // Right movement
        } else {
            // Move down-right at 45-degree angle
            this.player.waveVelocity = diagonalVertical; // Down movement
            this.player.waveHorizontalVelocity = diagonalHorizontal; // Right movement
        }

        this.player.y += this.player.waveVelocity;

        // Apply horizontal movement - wave always moves forward like slopes
        this.player.x += this.player.waveHorizontalVelocity;

        if (this.player.y <= 0) {
            this.player.y = 0;
        }
        if (this.player.y >= this.canvas.height - 50 - this.player.height) {
            this.player.y = this.canvas.height - 50 - this.player.height;
        }

        for (let i = 0; i < 2; i++) {
            this.particles.push({
                x: this.player.x - 10,
                y: this.player.y + this.player.height/2 + (Math.random() - 0.5) * 10,
                vx: -2 - Math.random() * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 0.8,
                decay: 0.02
            });
        }
    }

    handleShipMovement() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (mode !== 'ship') return;

        const isPressed = this.keys['Space'] || this.keys['ArrowUp'] || this.mousePressed;
        const acceleration = 0.8 * this.speedMultiplier;
        const deceleration = 0.6 * this.speedMultiplier;
        const maxSpeed = this.player.shipSpeed * this.speedMultiplier;

        if (isPressed) {
            this.player.shipVelocity = Math.max(this.player.shipVelocity - acceleration, -maxSpeed);
        } else {
            this.player.shipVelocity = Math.min(this.player.shipVelocity + deceleration, maxSpeed);
        }

        this.player.y += this.player.shipVelocity;

        if (this.player.y <= 0) {
            this.player.y = 0;
            this.player.shipVelocity = 0;
        }
        if (this.player.y >= this.canvas.height - 50 - this.player.height) {
            this.player.y = this.canvas.height - 50 - this.player.height;
            this.player.shipVelocity = 0;
        }

        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x: this.player.x - 15,
                y: this.player.y + this.player.height + Math.random() * 5,
                vx: -3 - Math.random() * 3,
                vy: Math.random() * 2,
                life: 1,
                decay: 0.03
            });
        }
    }

    handleBallMovement() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (mode !== 'ball') return;

        const adjustedGravity = this.player.gravity * this.speedMultiplier;
        this.player.velocity += adjustedGravity * this.player.gravityDirection;
        this.player.y += this.player.velocity;

        this.player.rotation += this.player.velocity * 0.1;

        const ground = this.canvas.height - 50;
        const ceiling = 0;

        if (this.player.gravityDirection > 0) {
            if (this.player.y + this.player.height >= ground) {
                this.player.y = ground - this.player.height;
                this.player.velocity = 0;
                this.player.onGround = true;
                this.player.canChangeGravity = true;

                for (let i = 0; i < 3; i++) {
                    this.particles.push({
                        x: this.player.x + Math.random() * this.player.width,
                        y: this.player.y + this.player.height,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -Math.random() * 3,
                        life: 0.8,
                        decay: 0.03
                    });
                }
            } else {
                this.player.onGround = false;
            }
        } else {
            if (this.player.y <= ceiling) {
                this.player.y = ceiling;
                this.player.velocity = 0;
                this.player.onGround = true;
                this.player.canChangeGravity = true;

                for (let i = 0; i < 3; i++) {
                    this.particles.push({
                        x: this.player.x + Math.random() * this.player.width,
                        y: this.player.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: Math.random() * 3,
                        life: 0.8,
                        decay: 0.03
                    });
                }
            } else {
                this.player.onGround = false;
            }
        }
    }

    checkForCustomLevel() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('custom') === 'true') {
            const customLevel = localStorage.getItem('customLevel');
            if (customLevel) {
                try {
                    this.customLevelData = JSON.parse(customLevel);
                    this.isCustomLevel = true;
                } catch (e) {
                    console.error('Invalid custom level data');
                    this.isCustomLevel = false;
                }
            }
        }
    }

    generateLevel() {
        this.obstacles = [];
        this.portals = [];
        this.speed = this.baseSpeed;
        this.speedMultiplier = 1;

        console.log('=== GENERATING NEW LEVEL ===');
        console.log('Game mode:', this.gameMode);

        if (this.isCustomLevel && this.customLevelData) {
            this.loadCustomLevel();
        } else if (this.gameMode === 'mixed') {
            this.generateMixedLevel();
        } else {
            this.generateLevelByDifficulty();
        }

        if (!this.isCustomLevel) {
            this.generateSpeedPortals();
        }

        // Debug: Check what obstacles were generated
        console.log('=== LEVEL GENERATION COMPLETE ===');
        console.log('Total obstacles:', this.obstacles.length);
        const obstacleTypes = {};
        this.obstacles.forEach(obs => {
            obstacleTypes[obs.type] = (obstacleTypes[obs.type] || 0) + 1;
        });
        console.log('Obstacle types:', obstacleTypes);

        // Check for any wall obstacles
        const wallObstacles = this.obstacles.filter(obs =>
            obs.type === 'wall' || obs.type === 'wall-top' || obs.type === 'wall-bottom'
        );
        if (wallObstacles.length > 0) {
            console.log('🚨 WARNING: Found wall/pillar obstacles:', wallObstacles.length);
            console.log('Wall obstacles:', wallObstacles);
        }
    }

    loadCustomLevel() {
        // Load obstacles
        this.obstacles = this.customLevelData.objects.map(obj => ({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            type: obj.type,
            rotation: obj.rotation || 0
        }));

        // Load portals
        this.portals = this.customLevelData.portals.map(portal => ({
            x: portal.x,
            y: portal.y,
            width: portal.width,
            height: portal.height,
            fromMode: 'cube',
            toMode: portal.mode,
            rotation: portal.rotation || 0
        }));

        // Load speed portals
        [] = this.customLevelData.speedPortals.map(portal => ({
            x: portal.x,
            y: portal.y,
            width: portal.width,
            height: portal.height,
            speed: portal.speed,
            color: this.getSpeedPortalColor(portal.speed),
            rotation: portal.rotation || 0
        }));
    }

    getSpeedPortalColor(speed) {
        const colors = {
            0.5: '#4CAF50',
            0.75: '#8BC34A',
            1.0: '#00ff88',
            1.5: '#FFC107',
            2.0: '#FF9800',
            3.0: '#F44336',
            4.0: '#9C27B0'
        };
        return colors[speed] || '#00ff88';
    }

    generateLevelByDifficulty() {
        const levelTemplate = this.getLevelTemplate();

        for (let section of levelTemplate) {
            this.generateLevelSection(section);
        }
    }

    getLevelTemplate() {
        const baseObjects = 15;
        const objectsPerLevel = baseObjects + (this.currentLevel - 1) * 10;

        return [
            { type: 'standard_jumps', mode: 'cube', x: 400, length: 1000, maxObjects: Math.floor(objectsPerLevel * 0.4) },
            { type: 'standard_flight', mode: 'wave', x: 1400, length: 800, maxObjects: Math.floor(objectsPerLevel * 0.3) },
            { type: 'standard_ship', mode: 'ship', x: 2200, length: 800, maxObjects: Math.floor(objectsPerLevel * 0.3) }
            // { type: 'standard_ball', mode: 'ball', x: 3000, length: 600, maxObjects: Math.floor(objectsPerLevel * 0.1) } // Commented out ball mode
        ];
    }

    generateLevelSection(section) {
        const spacing = this.getDifficultySpacing(section.type);
        const endX = section.x + section.length;

        if (this.gameMode !== 'mixed') {
            this.addGameModeTransition(section.x - 100, section.mode);
        }

        let objectCount = 0;
        const maxObjects = section.maxObjects || 10;

        for (let x = section.x; x < endX && objectCount < maxObjects; x += spacing.min + Math.random() * spacing.variance) {
            this.generateObstacleByDifficulty(x, section.type, section.mode);
            objectCount++;
        }
    }

    getDifficultySpacing(sectionType) {
        const spacings = {
            standard_jumps: { min: 160, variance: 60 },
            standard_flight: { min: 220, variance: 80 },
            standard_ship: { min: 240, variance: 80 },
            standard_ball: { min: 140, variance: 60 }
        };

        return spacings[sectionType] || { min: 150, variance: 50 };
    }

    generateObstacleByDifficulty(x, sectionType, mode) {
        if (mode === 'cube') {
            this.generateCubeObstacle(x, sectionType);
        } else if (mode === 'wave') {
            this.generateWaveObstacle(x, sectionType);
        } else if (mode === 'ship') {
            this.generateShipObstacle(x, sectionType);
        } else if (mode === 'ball') {
            this.generateBallObstacle(x, sectionType);
        }
    }

    generateCubeObstacle(x, difficulty) {
        const type = Math.random();
        const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);

        if (type < 0.4 * difficultyMultiplier) {
            this.obstacles.push({
                x: x, y: this.canvas.height - 50 - 40,
                width: 40, height: 40, type: 'spike'
            });
        } else if (type < 0.7) {
            const platformHeight = 60 + Math.random() * (80 * difficultyMultiplier);
            const platformWidth = Math.max(40, 60 - (difficultyMultiplier - 1) * 15);
            this.obstacles.push({
                x: x, y: this.canvas.height - 50 - platformHeight,
                width: platformWidth, height: 15, type: 'platform'
            });
        } else {
            const floatingY = 150 + Math.random() * 80;
            const platformWidth = Math.max(35, 50 - (difficultyMultiplier - 1) * 10);
            this.obstacles.push({
                x: x, y: floatingY,
                width: platformWidth, height: 15, type: 'platform'
            });
        }
    }

    generateWaveObstacle(x, difficulty) {
        console.log('🚨 generateWaveObstacle called! x:', x, 'difficulty:', difficulty);
        const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
        const gapSize = Math.max(60, 120 - (difficultyMultiplier - 1) * 20);
        const gapPosition = 80 + Math.random() * (this.canvas.height - 200);

        this.obstacles.push({
            x: x, y: 0, width: 30,
            height: gapPosition - gapSize/2, type: 'wall-top'
        });
        this.obstacles.push({
            x: x, y: gapPosition + gapSize/2, width: 30,
            height: this.canvas.height - 50 - (gapPosition + gapSize/2), type: 'wall-bottom'
        });
    }

    generateShipObstacle(x, difficulty) {
        console.log('🚨 generateShipObstacle called! x:', x, 'difficulty:', difficulty);
        const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
        const gapSize = Math.max(80, 140 - (difficultyMultiplier - 1) * 20);
        const gapPosition = 80 + Math.random() * (this.canvas.height - 250);

        this.obstacles.push({
            x: x, y: 0, width: 25,
            height: gapPosition - gapSize/2, type: 'wall-top'
        });
        this.obstacles.push({
            x: x, y: gapPosition + gapSize/2, width: 25,
            height: this.canvas.height - 50 - (gapPosition + gapSize/2), type: 'wall-bottom'
        });
    }

    generateBallObstacle(x, difficulty) {
        const type = Math.random();
        const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);

        if (type < 0.4 * difficultyMultiplier) {
            this.obstacles.push({
                x: x, y: this.canvas.height - 50 - 40,
                width: 40, height: 40, type: 'spike'
            });
        } else if (type < 0.7) {
            const platformHeight = 60 + Math.random() * (60 * difficultyMultiplier);
            const platformWidth = Math.max(35, 50 - (difficultyMultiplier - 1) * 10);
            this.obstacles.push({
                x: x, y: this.canvas.height - 50 - platformHeight,
                width: platformWidth, height: 15, type: 'platform'
            });
        } else {
            const floatingY = 100 + Math.random() * 120;
            this.obstacles.push({
                x: x, y: floatingY,
                width: 40, height: 15, type: 'platform'
            });
        }
    }

    getDifficultyMultiplier(sectionType) {
        const multipliers = {
            standard_jumps: 1.2,
            standard_flight: 1.2,
            standard_ship: 1.2,
            standard_ball: 1.2
        };

        return multipliers[sectionType] || 1.0;
    }

    addGameModeTransition(x, mode) {
        if (this.gameMode === 'mixed') return;
        if (this.currentLevel === 1) return;

        this.portals.push({
            x: x, y: 0,
            width: 60, height: this.canvas.height - 50,
            fromMode: this.currentGameMode || 'cube',
            toMode: mode
        });
    }

    generateSpeedPortals() {
        if (this.currentLevel === 1) {
            return;
        }

        const levelLength = this.getLevelLength();
        let speedMultipliers = [];

        if (this.currentLevel === 2) {
            speedMultipliers = [0.5, 2.0];
        } else if (this.currentLevel === 3) {
            speedMultipliers = [0.5, 2.0, 3.0];
        } else if (this.currentLevel >= 4) {
            speedMultipliers = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];
        }

        const speedColors = {
            0.5: '#4CAF50',    // Green - Slow
            0.75: '#8BC34A',   // Light Green - Slower
            1.0: '#00ff88',    // Default Green - Normal
            1.5: '#FFC107',    // Yellow - Fast
            2.0: '#FF9800',    // Orange - Faster
            3.0: '#F44336',    // Red - Very Fast
            4.0: '#9C27B0'     // Purple - Insane
        };

        for (let x = 800; x < levelLength - 400; x += 600 + Math.random() * 400) {
            const speedMultiplier = speedMultipliers[Math.floor(Math.random() * speedMultipliers.length)];

            [].push({
                x: x,
                y: this.canvas.height - 120,
                width: 25,
                height: 70,
                speedMultiplier: speedMultiplier,
                color: speedColors[speedMultiplier],
                used: false
            });
        }
    }

    generateCubeLevel() {
        for (let x = 400; x < 10000; x += 120 + Math.random() * 60) {
            const type = Math.random();
            const nextObstacleDistance = 120 + Math.random() * 60;

            if (type < 0.4) {
                this.obstacles.push({
                    x: x,
                    y: this.canvas.height - 50 - 40,
                    width: 40,
                    height: 40,
                    type: 'spike'
                });
            } else if (type < 0.7) {
                const platformHeight = 80 + Math.random() * 80;
                this.obstacles.push({
                    x: x,
                    y: this.canvas.height - 50 - platformHeight,
                    width: 60,
                    height: 20,
                    type: 'platform'
                });

                if (Math.random() < 0.3) {
                    this.obstacles.push({
                        x: x + 80,
                        y: this.canvas.height - 50 - 40,
                        width: 30,
                        height: 40,
                        type: 'spike'
                    });
                }
            } else {
                const floatingY = 150 + Math.random() * 80;
                this.obstacles.push({
                    x: x,
                    y: floatingY,
                    width: 50,
                    height: 15,
                    type: 'platform'
                });

                if (nextObstacleDistance > 140) {
                    this.obstacles.push({
                        x: x + 80,
                        y: floatingY + 60,
                        width: 40,
                        height: 15,
                        type: 'platform'
                    });
                }
            }
        }
    }

    generateWaveLevel() {
        for (let x = 400; x < 10000; x += 200 + Math.random() * 150) {
            const type = Math.random();
            const gapSize = 80 + Math.random() * 40;
            const gapPosition = 80 + Math.random() * (this.canvas.height - 200);

            if (type < 0.6) {
                this.obstacles.push({
                    x: x,
                    y: 0,
                    width: 30,
                    height: gapPosition - gapSize/2,
                    type: 'wall-top'
                });

                this.obstacles.push({
                    x: x,
                    y: gapPosition + gapSize/2,
                    width: 30,
                    height: this.canvas.height - 50 - (gapPosition + gapSize/2),
                    type: 'wall-bottom'
                });
            } else {
                const centerY = 100 + Math.random() * 150;
                for (let i = 0; i < 3; i++) {
                    this.obstacles.push({
                        x: x + i * 50,
                        y: centerY + Math.sin(i * 0.5) * 30,
                        width: 25,
                        height: 25,
                        type: 'wave-block'
                    });
                }
            }
        }
    }

    generateShipLevel() {
        for (let x = 400; x < 10000; x += 200 + Math.random() * 150) {
            const type = Math.random();
            const gapSize = 100 + Math.random() * 50;
            const gapPosition = 80 + Math.random() * (this.canvas.height - 250);

            this.obstacles.push({
                x: x,
                y: 0,
                width: 25,
                height: gapPosition - gapSize/2,
                type: 'wall-top'
            });

            this.obstacles.push({
                x: x,
                y: gapPosition + gapSize/2,
                width: 25,
                height: this.canvas.height - 50 - (gapPosition + gapSize/2),
                type: 'wall-bottom'
            });
        }
    }

    generateBallLevel() {
        console.log('generateBallLevel: ONLY creating spikes');
        for (let x = 400; x < 10000; x += 120 + Math.random() * 80) {
            // ONLY bottom spikes for testing
            this.obstacles.push({
                x: x,
                y: this.canvas.height - 50 - 40,
                width: 40,
                height: 40,
                type: 'spike'
            });
        }
    }

    generateMixedLevel() {
        let currentMode = 'cube';
        let sectionLength = 800;

        for (let section = 0; section < 10; section++) {
            const startX = 400 + section * sectionLength;
            const endX = startX + sectionLength - 200;

            if (section > 0) {
                // Determine what mode the NEXT section will need
                let portalToMode;
                if (section % 3 === 0) {
                    portalToMode = 'cube'; // Next section is cube-only
                } else if (section % 3 === 1) {
                    portalToMode = 'wave'; // Next section is wave
                } else {
                    portalToMode = 'ship'; // Next section is ship
                }

                console.log(`Portal at x${startX - 100}: ${currentMode} → ${portalToMode} (for section ${section})`);

                this.portals.push({
                    x: startX - 100,
                    y: 0,
                    width: 60,
                    height: this.canvas.height - 50,
                    fromMode: currentMode,
                    toMode: portalToMode
                });
            }

            // Generate obstacles for the intended mode sequence (for level design)
            console.log(`Section ${section}: x${startX}-${endX}, planned mode: ${currentMode}`);

            // FORCE cube sections to only have cube obstacles (no pillars ever)
            if (section % 3 === 0) { // Sections 0, 3, 6, 9 should be cube-only
                console.log(`🎯 FORCING section ${section} to be cube-only (no pillars)`);
                this.generateSectionObstacles(startX, endX, 'cube');
            } else {
                this.generateSectionObstacles(startX, endX, currentMode);
            }
            currentMode = this.getNextGameMode(currentMode);
        }
    }

    getNextGameMode(currentMode) {
        const modes = ['cube', 'wave', 'ship']; // Removed 'ball' temporarily
        // const modes = ['cube', 'wave', 'ship', 'ball']; // Original with ball mode
        const currentIndex = modes.indexOf(currentMode);
        return modes[(currentIndex + 1) % modes.length];
    }

    generateSectionObstacles(startX, endX, mode) {
        for (let x = startX; x < endX; x += 150 + Math.random() * 50) { // More consistent spacing: 150-200px apart
            const type = Math.random();

            if (mode === 'cube') {
                console.log('Cube mode: generating obstacles at x:', x);
                if (type < 0.4) {
                    console.log('Adding cube spike');
                    this.obstacles.push({
                        x: x, y: this.canvas.height - 50 - 40,
                        width: 40, height: 40, type: 'spike'
                    });
                } else if (type < 0.7) {
                    console.log('Adding cube platform (raised)');
                    const platformHeight = 80 + Math.random() * 60;
                    this.obstacles.push({
                        x: x, y: this.canvas.height - 50 - platformHeight,
                        width: 50, height: 15, type: 'platform'
                    });
                } else {
                    console.log('Adding cube platform (floating)');
                    const floatingY = 150 + Math.random() * 80;
                    this.obstacles.push({
                        x: x, y: floatingY,
                        width: 45, height: 15, type: 'platform'
                    });
                }
            } else if (mode === 'wave' || mode === 'ship') {
                console.log(`${mode} mode: generating pillars at x:`, x);
                const gapSize = mode === 'wave' ? 80 + Math.random() * 40 : 100 + Math.random() * 50;
                const gapPosition = 80 + Math.random() * (this.canvas.height - 200);

                console.log('Adding wall-top');
                this.obstacles.push({
                    x: x, y: 0, width: 30,
                    height: gapPosition - gapSize/2, type: 'wall-top'
                });
                console.log('Adding wall-bottom');
                this.obstacles.push({
                    x: x, y: gapPosition + gapSize/2, width: 30,
                    height: this.canvas.height - 50 - (gapPosition + gapSize/2), type: 'wall-bottom'
                });
            } else if (mode === 'ball') {
                console.log('Ball mode: ONLY generating spikes');
                // ONLY bottom spikes for testing
                this.obstacles.push({
                    x: x, y: this.canvas.height - 50 - 40,
                    width: 40, height: 40, type: 'spike'
                });
            }
        }
    }

    getPlayerHitbox() {
        const offset = this.hitboxOffset.player;
        return {
            x: this.player.x + offset,
            y: this.player.y + offset,
            width: this.player.width - (offset * 2),
            height: this.player.height - (offset * 2)
        };
    }

    rotatePoint(point, centerX, centerY, angle) {
        // Convert angle to radians
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Translate point to origin
        const translatedX = point.x - centerX;
        const translatedY = point.y - centerY;

        // Rotate point
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;

        // Translate back
        return {
            x: rotatedX + centerX,
            y: rotatedY + centerY
        };
    }

    getRotatedHitboxCorners(obstacle) {
        // Get base hitbox
        const hitbox = this.getObstacleHitbox(obstacle);

        if (!obstacle.rotation || obstacle.rotation === 0) {
            // No rotation, return regular corners
            return [
                { x: hitbox.x, y: hitbox.y }, // top-left
                { x: hitbox.x + hitbox.width, y: hitbox.y }, // top-right
                { x: hitbox.x + hitbox.width, y: hitbox.y + hitbox.height }, // bottom-right
                { x: hitbox.x, y: hitbox.y + hitbox.height } // bottom-left
            ];
        }

        // Calculate rotation center
        const centerX = obstacle.x + obstacle.width / 2;
        const centerY = obstacle.y + obstacle.height / 2;

        // Get hitbox corners and rotate them
        const corners = [
            { x: hitbox.x, y: hitbox.y }, // top-left
            { x: hitbox.x + hitbox.width, y: hitbox.y }, // top-right
            { x: hitbox.x + hitbox.width, y: hitbox.y + hitbox.height }, // bottom-right
            { x: hitbox.x, y: hitbox.y + hitbox.height } // bottom-left
        ];

        return corners.map(corner =>
            this.rotatePoint(corner, centerX, centerY, obstacle.rotation)
        );
    }

    getObstacleHitbox(obstacle) {
        // Platforms should have full hitbox for landing, but smaller for deadly collision
        if (obstacle.type === 'platform') {
            return {
                x: obstacle.x,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            };
        }

        // Deadly obstacles have smaller hitboxes
        const offset = this.hitboxOffset.obstacle;
        return {
            x: obstacle.x + offset,
            y: obstacle.y + offset,
            width: obstacle.width - (offset * 2),
            height: obstacle.height - (offset * 2)
        };
    }

    checkHitboxCollision(hitbox1, hitbox2) {
        return hitbox1.x < hitbox2.x + hitbox2.width &&
               hitbox1.x + hitbox1.width > hitbox2.x &&
               hitbox1.y < hitbox2.y + hitbox2.height &&
               hitbox1.y + hitbox1.height > hitbox2.y;
    }

    checkRotatedRectangleCollision(playerHitbox, obstacle) {
        // Get rotated corners of the obstacle
        const obstacleCorners = this.getRotatedHitboxCorners(obstacle);

        // Get player corners
        const playerCorners = [
            { x: playerHitbox.x, y: playerHitbox.y }, // top-left
            { x: playerHitbox.x + playerHitbox.width, y: playerHitbox.y }, // top-right
            { x: playerHitbox.x + playerHitbox.width, y: playerHitbox.y + playerHitbox.height }, // bottom-right
            { x: playerHitbox.x, y: playerHitbox.y + playerHitbox.height } // bottom-left
        ];

        // Check if any player corner is inside the rotated obstacle
        for (let corner of playerCorners) {
            if (this.isPointInRotatedRectangle(corner, obstacleCorners)) {
                return true;
            }
        }

        // Check if any obstacle corner is inside the player rectangle
        for (let corner of obstacleCorners) {
            if (corner.x >= playerHitbox.x && corner.x <= playerHitbox.x + playerHitbox.width &&
                corner.y >= playerHitbox.y && corner.y <= playerHitbox.y + playerHitbox.height) {
                return true;
            }
        }

        return false;
    }

    isPointInRotatedRectangle(point, corners) {
        // Use the "winding number" algorithm to check if point is inside polygon
        let windingNumber = 0;

        for (let i = 0; i < corners.length; i++) {
            const current = corners[i];
            const next = corners[(i + 1) % corners.length];

            if (current.y <= point.y) {
                if (next.y > point.y) { // upward crossing
                    if (this.isLeft(current, next, point) > 0) {
                        windingNumber++;
                    }
                }
            } else {
                if (next.y <= point.y) { // downward crossing
                    if (this.isLeft(current, next, point) < 0) {
                        windingNumber--;
                    }
                }
            }
        }

        return windingNumber !== 0;
    }

    isLeft(p0, p1, p2) {
        // Test if point p2 is left|on|right of an infinite line p0p1
        return ((p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y));
    }

    checkSpikeCollision(playerHitbox, obstacle) {
        // Get the triangle points for the spike
        const trianglePoints = this.getSpikeTrianglePoints(obstacle);

        // Check if any corner of the player's hitbox is inside the triangle
        const playerCorners = [
            { x: playerHitbox.x, y: playerHitbox.y }, // top-left
            { x: playerHitbox.x + playerHitbox.width, y: playerHitbox.y }, // top-right
            { x: playerHitbox.x, y: playerHitbox.y + playerHitbox.height }, // bottom-left
            { x: playerHitbox.x + playerHitbox.width, y: playerHitbox.y + playerHitbox.height } // bottom-right
        ];

        for (let corner of playerCorners) {
            if (this.isPointInTriangle(corner, trianglePoints[0], trianglePoints[1], trianglePoints[2])) {
                return true;
            }
        }

        return false;
    }

    checkSlopedCollision(playerHitbox, obstacle) {
        // Get the triangle points for the slanted obstacle
        const trianglePoints = this.getSlopeTrianglePoints(obstacle);

        // Check if any corner of the player's hitbox is inside the triangle
        const playerCorners = [
            { x: playerHitbox.x, y: playerHitbox.y }, // top-left
            { x: playerHitbox.x + playerHitbox.width, y: playerHitbox.y }, // top-right
            { x: playerHitbox.x, y: playerHitbox.y + playerHitbox.height }, // bottom-left
            { x: playerHitbox.x + playerHitbox.width, y: playerHitbox.y + playerHitbox.height } // bottom-right
        ];

        for (let corner of playerCorners) {
            if (this.isPointInTriangle(corner, trianglePoints[0], trianglePoints[1], trianglePoints[2])) {
                return true;
            }
        }

        return false;
    }

    getSpikeTrianglePoints(obstacle) {
        // Add inset margin to make spike hitbox smaller than visual shape
        const inset = 6; // 6 pixels smaller on each side for spikes

        // Spike triangle: top point in center, base at bottom
        const points = [
            { x: obstacle.x + obstacle.width/2, y: obstacle.y + inset }, // top point (inset from top)
            { x: obstacle.x + inset, y: obstacle.y + obstacle.height - inset }, // bottom-left (inset)
            { x: obstacle.x + obstacle.width - inset, y: obstacle.y + obstacle.height - inset } // bottom-right (inset)
        ];

        // Apply rotation if present
        if (obstacle.rotation && obstacle.rotation !== 0) {
            const centerX = obstacle.x + obstacle.width / 2;
            const centerY = obstacle.y + obstacle.height / 2;
            return points.map(point =>
                this.rotatePoint(point, centerX, centerY, obstacle.rotation)
            );
        }

        return points;
    }

    getSlopeTrianglePoints(obstacle) {
        // Add inset margin to make hitbox smaller than visual shape
        const inset = 8; // 8 pixels smaller on each side

        let points;
        switch (obstacle.type) {
            case 'slope-up': // 45° upward slope ↗
                points = [
                    { x: obstacle.x + inset, y: obstacle.y + obstacle.height - inset }, // bottom-left (inset)
                    { x: obstacle.x + obstacle.width - inset, y: obstacle.y + inset }, // top-right (inset)
                    { x: obstacle.x + obstacle.width - inset, y: obstacle.y + obstacle.height - inset } // bottom-right (inset)
                ];
                break;
            case 'slope-down': // 45° downward slope ↘
                points = [
                    { x: obstacle.x + inset, y: obstacle.y + inset }, // top-left (inset)
                    { x: obstacle.x + obstacle.width - inset, y: obstacle.y + obstacle.height - inset }, // bottom-right (inset)
                    { x: obstacle.x + inset, y: obstacle.y + obstacle.height - inset } // bottom-left (inset)
                ];
                break;
            case 'steep-up': // 60° upward slope
                points = [
                    { x: obstacle.x + inset, y: obstacle.y + obstacle.height - inset }, // bottom-left (inset)
                    { x: obstacle.x + (obstacle.width * 0.7) - inset, y: obstacle.y + inset }, // top-right (steeper, inset)
                    { x: obstacle.x + obstacle.width - inset, y: obstacle.y + obstacle.height - inset } // bottom-right (inset)
                ];
                break;
            case 'steep-down': // 60° downward slope
                points = [
                    { x: obstacle.x + inset, y: obstacle.y + inset }, // top-left (inset)
                    { x: obstacle.x + (obstacle.width * 0.7) - inset, y: obstacle.y + obstacle.height - inset }, // bottom-right (steeper, inset)
                    { x: obstacle.x + obstacle.width - inset, y: obstacle.y + inset } // top-right (inset)
                ];
                break;
        }

        // Apply rotation if present
        if (obstacle.rotation && obstacle.rotation !== 0) {
            const centerX = obstacle.x + obstacle.width / 2;
            const centerY = obstacle.y + obstacle.height / 2;
            return points.map(point =>
                this.rotatePoint(point, centerX, centerY, obstacle.rotation)
            );
        }

        return points;
    }

    isPointInTriangle(point, v1, v2, v3) {
        // Use barycentric coordinates to check if point is inside triangle
        const denominator = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y);
        const a = ((v2.y - v3.y) * (point.x - v3.x) + (v3.x - v2.x) * (point.y - v3.y)) / denominator;
        const b = ((v3.y - v1.y) * (point.x - v3.x) + (v1.x - v3.x) * (point.y - v3.y)) / denominator;
        const c = 1 - a - b;

        return a >= 0 && b >= 0 && c >= 0;
    }

    checkCollisions() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

        if (mode === 'cube') {
            this.checkCubeCollisions();
        } else if (mode === 'ball') {
            this.checkBallCollisions();
        } else {
            this.checkWaveCollisions();
        }
    }

    checkCubeCollisions() {
        const ground = this.canvas.height - 50;

        if (this.player.y + this.player.height >= ground) {
            this.player.y = ground - this.player.height;
            this.player.velocity = 0;
            this.player.onGround = true;
        }

        if (this.player.y <= 0) {
            this.player.y = 0;
            this.player.velocity = 0;
        }

        this.player.onGround = this.player.y + this.player.height >= ground;

        const playerHitbox = this.getPlayerHitbox();

        for (let obstacle of this.obstacles) {
            if (obstacle.type === 'platform') {
                // Use full collision for platform landing detection
                if (this.player.x < obstacle.x + obstacle.width &&
                    this.player.x + this.player.width > obstacle.x &&
                    this.player.y < obstacle.y + obstacle.height &&
                    this.player.y + this.player.height > obstacle.y) {

                    const playerBottom = this.player.y + this.player.height;
                    const playerPrevBottom = playerBottom - this.player.velocity;
                    const platformTop = obstacle.y;

                    if (this.player.velocity > 0 &&
                        playerPrevBottom <= platformTop &&
                        playerBottom >= platformTop &&
                        this.player.x + this.player.width > obstacle.x + 5 &&
                        this.player.x < obstacle.x + obstacle.width - 5) {

                        this.player.y = platformTop - this.player.height;
                        this.player.velocity = 0;
                        this.player.onGround = true;
                        continue;
                    }
                }
            } else {
                // Check for spike collision (triangular)
                if (obstacle.type === 'spike') {
                    if (this.checkSpikeCollision(playerHitbox, obstacle)) {
                        this.gameOver();
                        return;
                    }
                } else if (obstacle.type === 'slope-up' || obstacle.type === 'slope-down' ||
                           obstacle.type === 'steep-up' || obstacle.type === 'steep-down') {
                    // Check for slanted obstacle collision
                    if (this.checkSlopedCollision(playerHitbox, obstacle)) {
                        this.gameOver();
                        return;
                    }
                } else {
                    // Use smaller hitbox for regular deadly obstacles
                    if (obstacle.rotation && obstacle.rotation !== 0) {
                        // Use rotated rectangle collision for rotated objects
                        if (this.checkRotatedRectangleCollision(playerHitbox, obstacle)) {
                            this.gameOver();
                            return;
                        }
                    } else {
                        // Use regular collision for non-rotated objects
                        const obstacleHitbox = this.getObstacleHitbox(obstacle);
                        if (this.checkHitboxCollision(playerHitbox, obstacleHitbox)) {
                            this.gameOver();
                            return;
                        }
                    }
                }
            }
        }
    }

    checkBallCollisions() {
        const playerHitbox = this.getPlayerHitbox();

        for (let obstacle of this.obstacles) {
            if (obstacle.type === 'platform') {
                // Use full collision for platform bouncing
                if (this.player.x < obstacle.x + obstacle.width &&
                    this.player.x + this.player.width > obstacle.x &&
                    this.player.y < obstacle.y + obstacle.height &&
                    this.player.y + this.player.height > obstacle.y) {

                    if (this.player.gravityDirection > 0) {
                        const playerBottom = this.player.y + this.player.height;
                        const playerPrevBottom = playerBottom - this.player.velocity;
                        const platformTop = obstacle.y;

                        if (this.player.velocity > 0 &&
                            playerPrevBottom <= platformTop &&
                            playerBottom >= platformTop &&
                            this.player.x + this.player.width > obstacle.x + 5 &&
                            this.player.x < obstacle.x + obstacle.width - 5) {

                            this.player.y = platformTop - this.player.height;
                            this.player.velocity = -Math.abs(this.player.velocity) * 0.7;
                            continue;
                        }
                    } else {
                        const playerTop = this.player.y;
                        const playerPrevTop = playerTop - this.player.velocity;
                        const platformBottom = obstacle.y + obstacle.height;

                        if (this.player.velocity < 0 &&
                            playerPrevTop >= platformBottom &&
                            playerTop <= platformBottom &&
                            this.player.x + this.player.width > obstacle.x + 5 &&
                            this.player.x < obstacle.x + obstacle.width - 5) {

                            this.player.y = platformBottom;
                            this.player.velocity = Math.abs(this.player.velocity) * 0.7;
                            continue;
                        }
                    }
                }
            } else {
                // Check for spike collision (triangular)
                if (obstacle.type === 'spike') {
                    if (this.checkSpikeCollision(playerHitbox, obstacle)) {
                        this.gameOver();
                        return;
                    }
                } else if (obstacle.type === 'slope-up' || obstacle.type === 'slope-down' ||
                           obstacle.type === 'steep-up' || obstacle.type === 'steep-down') {
                    // Check for slanted obstacle collision
                    if (this.checkSlopedCollision(playerHitbox, obstacle)) {
                        this.gameOver();
                        return;
                    }
                } else {
                    // Use smaller hitbox for regular deadly obstacles
                    if (obstacle.rotation && obstacle.rotation !== 0) {
                        // Use rotated rectangle collision for rotated objects
                        if (this.checkRotatedRectangleCollision(playerHitbox, obstacle)) {
                            this.gameOver();
                            return;
                        }
                    } else {
                        // Use regular collision for non-rotated objects
                        const obstacleHitbox = this.getObstacleHitbox(obstacle);
                        if (this.checkHitboxCollision(playerHitbox, obstacleHitbox)) {
                            this.gameOver();
                            return;
                        }
                    }
                }
            }
        }
    }

    checkWaveCollisions() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

        if (mode === 'wave' || mode === 'ship') {
            if (this.player.y <= 0) {
                this.player.y = 0;
                this.player.waveVelocity = 0;
                this.player.waveHorizontalVelocity = 0;
                this.player.shipVelocity = 0;
            }
            if (this.player.y + this.player.height >= this.canvas.height - 50) {
                this.player.y = this.canvas.height - 50 - this.player.height;
                this.player.waveVelocity = 0;
                this.player.waveHorizontalVelocity = 0;
                this.player.shipVelocity = 0;
            }

            // For wave mode, only check left boundary (prevent going backward)
            if (mode === 'wave') {
                if (this.player.x <= 0) {
                    this.player.x = 0;
                    this.player.waveHorizontalVelocity = 0;
                }
                // Remove right boundary check - wave should be able to move forward indefinitely
            }
        }

        const playerHitbox = this.getPlayerHitbox();

        for (let obstacle of this.obstacles) {
            // Check for spike collision (triangular)
            if (obstacle.type === 'spike') {
                if (this.checkSpikeCollision(playerHitbox, obstacle)) {
                    this.gameOver();
                    return;
                }
            } else if (obstacle.type === 'slope-up' || obstacle.type === 'slope-down' ||
                       obstacle.type === 'steep-up' || obstacle.type === 'steep-down') {
                // Check for slanted obstacle collision
                if (this.checkSlopedCollision(playerHitbox, obstacle)) {
                    this.gameOver();
                    return;
                }
            } else {
                const obstacleHitbox = this.getObstacleHitbox(obstacle);
                if (this.checkHitboxCollision(playerHitbox, obstacleHitbox)) {
                    this.gameOver();
                    return;
                }
            }
        }
    }

    updatePlayer() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

        switch (mode) {
            case 'wave':
                this.handleWaveMovement();
                break;
            case 'ship':
                this.handleShipMovement();
                break;
            case 'ball':
                this.handleBallMovement();
                break;
            default:
                const adjustedGravity = this.player.gravity * this.speedMultiplier;
                this.player.velocity += adjustedGravity;
                this.player.y += this.player.velocity;
                break;
        }

        this.player.trail.push({
            x: this.player.x,
            y: this.player.y,
            alpha: 1
        });

        if (this.player.trail.length > 10) {
            this.player.trail.shift();
        }

        this.player.trail.forEach((point, index) => {
            point.alpha = index / this.player.trail.length;
        });

        // Add to persistent wave trail when in wave mode
        const currentMode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (currentMode === 'wave') {
            this.player.persistentWaveTrail.push({
                x: this.player.x + this.player.width / 2,
                y: this.player.y + this.player.height / 2
            });
        }
    }

    updateCamera() {
        this.camera.x = this.player.x - 200;
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.3;
            particle.life -= particle.decay;

            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    drawBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#0a1929');
        gradient.addColorStop(0.5, '#1a237e');
        gradient.addColorStop(1, '#3949ab');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#00ff88';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);

        for (let x = -this.camera.x % 100; x < this.canvas.width; x += 100) {
            this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
    }

    drawPlayer() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

        // Draw persistent wave trail
        if (this.player.persistentWaveTrail.length > 1) {
            this.ctx.strokeStyle = 'rgba(144, 238, 144, 0.8)';
            this.ctx.lineWidth = 8;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();

            for (let i = 0; i < this.player.persistentWaveTrail.length; i++) {
                const point = this.player.persistentWaveTrail[i];
                if (i === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            }
            this.ctx.stroke();
        }

        this.player.trail.forEach(point => {
            if (mode === 'wave') {
                this.ctx.fillStyle = `rgba(144, 238, 144, ${point.alpha * 0.4})`;
            } else {
                this.ctx.fillStyle = `rgba(0, 255, 136, ${point.alpha * 0.3})`;
            }
            this.ctx.fillRect(point.x, point.y, this.player.width, this.player.height);
        });
        this.ctx.fillStyle = this.player.color;

        const centerX = this.player.x + this.player.width / 2;
        const centerY = this.player.y + this.player.height / 2;

        if (mode === 'wave') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y + this.player.height/2);
            this.ctx.lineTo(this.player.x + this.player.width, this.player.y);
            this.ctx.lineTo(this.player.x + this.player.width, this.player.y + this.player.height);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (mode === 'ship') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y + this.player.height);
            this.ctx.lineTo(this.player.x + this.player.width * 0.7, this.player.y);
            this.ctx.lineTo(this.player.x + this.player.width, this.player.y + this.player.height * 0.5);
            this.ctx.lineTo(this.player.x + this.player.width * 0.3, this.player.y + this.player.height);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (mode === 'ball') {
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(this.player.rotation);

            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.player.width / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(-this.player.width / 2, 0);
            this.ctx.lineTo(this.player.width / 2, 0);
            this.ctx.moveTo(0, -this.player.width / 2);
            this.ctx.lineTo(0, this.player.width / 2);
            this.ctx.stroke();

            this.ctx.restore();
        } else {
            this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);
        }

        this.ctx.restore();
    }

    drawObstacles() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        for (let obstacle of this.obstacles) {
            if (obstacle.x + obstacle.width < this.camera.x - 100 ||
                obstacle.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            // Handle rotation if present
            if (obstacle.rotation && obstacle.rotation !== 0) {
                this.ctx.save();
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((obstacle.rotation * Math.PI) / 180);
                this.ctx.translate(-centerX, -centerY);
            }

            if (obstacle.type === 'spike') {
                this.ctx.fillStyle = '#ff4444';
                this.ctx.beginPath();
                this.ctx.moveTo(obstacle.x + obstacle.width/2, obstacle.y);
                this.ctx.lineTo(obstacle.x, obstacle.y + obstacle.height);
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else if (obstacle.type === 'wall' || obstacle.type === 'wall-top' || obstacle.type === 'wall-bottom') {
                this.ctx.fillStyle = '#ff6600';
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            } else if (obstacle.type === 'floating') {
                this.ctx.fillStyle = '#ffff00';
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            } else if (obstacle.type === 'wave-block') {
                this.ctx.fillStyle = '#ff00ff';
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            } else if (obstacle.type === 'platform') {
                this.ctx.fillStyle = '#00aaff';
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, 3);
                this.ctx.fillRect(obstacle.x + 2, obstacle.y + obstacle.height - 5, obstacle.width - 4, 3);
            } else if (obstacle.type === 'slope-up' || obstacle.type === 'slope-down' ||
                       obstacle.type === 'steep-up' || obstacle.type === 'steep-down') {
                this.drawSlopedObstacle(obstacle);
            }

            // Restore rotation if applied
            if (obstacle.rotation && obstacle.rotation !== 0) {
                this.ctx.restore();
            }
        }

        this.ctx.restore();
    }

    drawSlopedObstacle(obstacle) {
        // Set colors based on obstacle type
        const colors = {
            'slope-up': '#9C27B0',
            'slope-down': '#9C27B0',
            'steep-up': '#673AB7',
            'steep-down': '#673AB7'
        };

        this.ctx.fillStyle = colors[obstacle.type] || '#ffffff';
        this.ctx.beginPath();

        switch (obstacle.type) {
            case 'slope-up': // 45° upward slope ↗
                this.ctx.moveTo(obstacle.x, obstacle.y + obstacle.height); // bottom-left
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y); // top-right
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height); // bottom-right
                break;
            case 'slope-down': // 45° downward slope ↘
                this.ctx.moveTo(obstacle.x, obstacle.y); // top-left
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height); // bottom-right
                this.ctx.lineTo(obstacle.x, obstacle.y + obstacle.height); // bottom-left
                break;
            case 'steep-up': // 60° upward slope
                this.ctx.moveTo(obstacle.x, obstacle.y + obstacle.height); // bottom-left
                this.ctx.lineTo(obstacle.x + obstacle.width * 0.7, obstacle.y); // top-right (steeper)
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height); // bottom-right
                break;
            case 'steep-down': // 60° downward slope
                this.ctx.moveTo(obstacle.x, obstacle.y); // top-left
                this.ctx.lineTo(obstacle.x + obstacle.width * 0.7, obstacle.y + obstacle.height); // bottom-right (steeper)
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y); // top-right
                break;
        }

        this.ctx.closePath();
        this.ctx.fill();

        // Add stroke for better visibility
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawParticles() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        for (let particle of this.particles) {
            if (particle.color) {
                const hex = particle.color.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.life})`;
            } else {
                this.ctx.fillStyle = `rgba(0, 255, 136, ${particle.life})`;
            }
            this.ctx.fillRect(particle.x, particle.y, 4, 4);
        }

        this.ctx.restore();
    }

    checkPortalCollisions() {
        if (this.gameMode !== 'mixed') return;

        const playerHitbox = this.getPlayerHitbox();

        for (let portal of this.portals) {
            if (portal.used) continue;

            // Use hitbox that fits inside the portal visual boundaries
            const portalHitbox = {
                x: portal.x + 2,
                y: portal.y + 2,
                width: portal.width - 4,
                height: portal.height - 4
            };

            if (this.checkHitboxCollision(playerHitbox, portalHitbox)) {
                console.log(`🌀 Portal hit! ${portal.fromMode} → ${portal.toMode} at x: ${portal.x}`);

                // Clear persistent wave trail when switching away from wave mode
                if (this.currentGameMode === 'wave' && portal.toMode !== 'wave') {
                    this.player.persistentWaveTrail = [];
                }

                this.currentGameMode = portal.toMode;
                this.updateInstructions();

                if (portal.toMode === 'wave' || portal.toMode === 'ship') {
                    this.player.y = (this.canvas.height - 50) / 2 - this.player.height / 2;
                    this.player.velocity = 0;
                    this.player.waveVelocity = 0;
                    this.player.waveHorizontalVelocity = 0;
                    this.player.shipVelocity = 0;
                }

                if (portal.toMode === 'ball') {
                    this.player.velocity = 0;
                }

                this.playSound('jump');

                for (let i = 0; i < 10; i++) {
                    this.particles.push({
                        x: portal.x + portal.width/2,
                        y: portal.y + portal.height/2,
                        vx: (Math.random() - 0.5) * 8,
                        vy: (Math.random() - 0.5) * 8,
                        life: 1,
                        decay: 0.02
                    });
                }

                portal.used = true;
                break;
            }
        }
    }

    drawPortals() {
        if (this.gameMode !== 'mixed') return;

        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        for (let portal of this.portals) {
            if (portal.used) continue;

            if (portal.x + portal.width < this.camera.x - 100 ||
                portal.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            const colors = {
                cube: '#00ff88',
                wave: '#ff4444',
                ship: '#ffff00',
                ball: '#ff00ff'
            };

            // Handle rotation if present
            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.save();
                const centerX = portal.x + portal.width / 2;
                const centerY = portal.y + portal.height / 2;
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((portal.rotation * Math.PI) / 180);
                this.ctx.translate(-centerX, -centerY);
            }

            this.ctx.fillStyle = colors[portal.toMode] || '#ffffff';
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 1;
            this.ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                portal.toMode.toUpperCase(),
                portal.x + portal.width/2,
                portal.y + portal.height/2 + 4
            );

            // Restore rotation if applied
            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.restore();
            }
        }

        this.ctx.restore();
    }

    drawSpeedPortals() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        for (let portal of []) {
            if (portal.used) continue;

            if (portal.x + portal.width < this.camera.x - 100 ||
                portal.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            // Handle rotation if present
            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.save();
                const centerX = portal.x + portal.width / 2;
                const centerY = portal.y + portal.height / 2;
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((portal.rotation * Math.PI) / 180);
                this.ctx.translate(-centerX, -centerY);
            }

            this.ctx.fillStyle = portal.color;
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 1;
            this.ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `${portal.speed}x`,
                portal.x + portal.width/2,
                portal.y + portal.height/2 + 4
            );

            // Restore rotation if applied
            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.restore();
            }

            const time = Date.now() * 0.005;
            this.ctx.globalAlpha = 0.3 + Math.sin(time + portal.x * 0.01) * 0.3;
            this.ctx.fillStyle = portal.color;
            this.ctx.fillRect(portal.x - 5, portal.y - 5, portal.width + 10, portal.height + 10);
        }

        this.ctx.restore();
    }


    checkLevelCompletion() {
        const levelLength = this.getLevelLength();

        if (this.player.x >= levelLength) {
            this.levelComplete();
        }
    }

    getLevelLength() {
        const template = this.getLevelTemplate();
        let maxX = 0;

        for (let section of template) {
            const sectionEnd = section.x + section.length;
            if (sectionEnd > maxX) {
                maxX = sectionEnd;
            }
        }

        return maxX + 200;
    }

    levelComplete() {
        this.gameState = 'levelComplete';
        this.playSound('jump');

        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: this.player.x + Math.random() * 100,
                y: this.player.y + Math.random() * 100,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 2,
                decay: 0.01
            });
        }

        setTimeout(() => {
            this.showLevelCompleteUI();
        }, 1000);
    }

    showLevelCompleteUI() {
        const gameOverDiv = document.getElementById('gameOver');
        gameOverDiv.innerHTML = `
            <h2>Level Complete!</h2>
            <p>Level ${this.currentLevel} - Score: ${this.score}</p>
            <p>Attempts: ${this.attempts}</p>
            <button id="nextLevelBtn">Next Level</button>
            <button id="restartLevelBtn">Restart Level</button>
        `;
        gameOverDiv.style.display = 'block';

        // Use onclick to avoid duplicate listeners
        document.getElementById('nextLevelBtn').onclick = () => {
            this.nextLevel();
        };

        document.getElementById('restartLevelBtn').onclick = () => {
            this.restartGame();
        };
    }

    nextLevel() {
        if (this.currentLevel < this.maxLevel) {
            this.currentLevel++;
            document.getElementById('levelSelect').value = this.currentLevel;
            document.getElementById('currentLevel').textContent = this.currentLevel;
            this.attempts = 0; // Reset to 0 because restartGame() will increment to 1
            this.restartGame();
        } else {
            this.showGameComplete();
        }
    }

    showGameComplete() {
        const gameOverDiv = document.getElementById('gameOver');
        gameOverDiv.innerHTML = `
            <h2>🎉 Congratulations! 🎉</h2>
            <p>You've completed all levels!</p>
            <p>Final Score: ${this.score}</p>
            <button id="playAgainBtn">Play Again</button>
        `;
        gameOverDiv.style.display = 'block';

        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.currentLevel = 1;
            document.getElementById('levelSelect').value = 1;
            document.getElementById('currentLevel').textContent = 1;
            this.restartGame();
        });
    }

    update() {
        if (this.gameState !== 'playing') return;

        // For wave mode, horizontal movement is handled in handleWaveMovement
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (mode !== 'wave') {
            this.player.x += this.speed;
        }
        this.score = Math.floor(this.player.x / 10);

        this.updatePlayer();
        this.updateCamera();
        this.updateParticles();
        this.checkCollisions();
        this.checkPortalCollisions();
        this.checkLevelCompletion();

        document.getElementById('score').textContent = this.score;
    }

    drawHitboxes() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        // Draw player hitbox
        const playerHitbox = this.getPlayerHitbox();
        this.ctx.strokeStyle = '#00FF00'; // Green for player
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(playerHitbox.x, playerHitbox.y, playerHitbox.width, playerHitbox.height);

        // Draw obstacle hitboxes
        for (let obstacle of this.obstacles) {
            if (obstacle.x + obstacle.width < this.camera.x - 100 ||
                obstacle.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            if (obstacle.type === 'spike') {
                // Draw spike triangle hitbox
                const trianglePoints = this.getSpikeTrianglePoints(obstacle);
                this.ctx.strokeStyle = '#FF0000'; // Red for deadly spikes
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(trianglePoints[0].x, trianglePoints[0].y);
                this.ctx.lineTo(trianglePoints[1].x, trianglePoints[1].y);
                this.ctx.lineTo(trianglePoints[2].x, trianglePoints[2].y);
                this.ctx.closePath();
                this.ctx.stroke();
            } else if (obstacle.type === 'slope-up' || obstacle.type === 'slope-down' ||
                       obstacle.type === 'steep-up' || obstacle.type === 'steep-down') {
                // Draw sloped obstacle triangle hitbox
                const trianglePoints = this.getSlopeTrianglePoints(obstacle);
                this.ctx.strokeStyle = '#FF0000'; // Red for deadly obstacles
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(trianglePoints[0].x, trianglePoints[0].y);
                this.ctx.lineTo(trianglePoints[1].x, trianglePoints[1].y);
                this.ctx.lineTo(trianglePoints[2].x, trianglePoints[2].y);
                this.ctx.closePath();
                this.ctx.stroke();
            } else {
                // Draw regular obstacle hitbox
                if (obstacle.rotation && obstacle.rotation !== 0) {
                    // Draw rotated rectangle hitbox
                    const corners = this.getRotatedHitboxCorners(obstacle);
                    if (obstacle.type === 'platform') {
                        this.ctx.strokeStyle = '#0088FF'; // Blue for platforms
                    } else {
                        this.ctx.strokeStyle = '#FF0000'; // Red for deadly obstacles
                    }
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([3, 3]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(corners[0].x, corners[0].y);
                    this.ctx.lineTo(corners[1].x, corners[1].y);
                    this.ctx.lineTo(corners[2].x, corners[2].y);
                    this.ctx.lineTo(corners[3].x, corners[3].y);
                    this.ctx.closePath();
                    this.ctx.stroke();
                } else {
                    // Draw regular non-rotated hitbox
                    const obstacleHitbox = this.getObstacleHitbox(obstacle);
                    if (obstacle.type === 'platform') {
                        this.ctx.strokeStyle = '#0088FF'; // Blue for platforms
                    } else {
                        this.ctx.strokeStyle = '#FF0000'; // Red for deadly obstacles
                    }
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([3, 3]);
                    this.ctx.strokeRect(obstacleHitbox.x, obstacleHitbox.y, obstacleHitbox.width, obstacleHitbox.height);
                }
            }
        }

        // Draw portal hitboxes
        for (let portal of this.portals) {
            if (portal.used) continue;
            if (portal.x + portal.width < this.camera.x - 100 ||
                portal.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            this.ctx.strokeStyle = '#FFFF00'; // Yellow for portals
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(portal.x + 2, portal.y + 2, portal.width - 4, portal.height - 4);
        }

        // Draw speed portal hitboxes
        for (let portal of []) {
            if (portal.used) continue;
            if (portal.x + portal.width < this.camera.x - 100 ||
                portal.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            this.ctx.strokeStyle = '#FF00FF'; // Magenta for speed portals
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(portal.x + 2, portal.y + 2, portal.width - 4, portal.height - 4);
        }

        this.ctx.setLineDash([]); // Reset line dash
        this.ctx.restore();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackground();
        this.drawObstacles();
        this.drawPortals();
        this.drawSpeedPortals();
        this.drawParticles();
        this.drawPlayer();

        if (this.showHitboxes) {
            this.drawHitboxes();
        }
    }

    startGame() {
        this.resetPlayerPosition();
        this.gameState = 'playing';
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        this.playSound('music');
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseBtn').textContent = 'Resume';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseBtn').textContent = 'Pause';
        }
    }

    gameOver() {
        this.gameState = 'gameOver';

        // Set game over content for death
        const gameOverDiv = document.getElementById('gameOver');
        gameOverDiv.innerHTML = `
            <h2>Game Over</h2>
            <p>Level ${this.currentLevel} - Score: <span id="finalScore">${this.score}</span></p>
            <p>Attempts: ${this.attempts}</p>
            <button id="restartBtn">Restart</button>
        `;
        gameOverDiv.style.display = 'block';

        // Re-attach restart event listener
        document.getElementById('restartBtn').onclick = () => {
            this.restartGame();
        };

        document.getElementById('pauseBtn').disabled = true;
        this.playSound('death');

        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: this.player.x + this.player.width/2,
                y: this.player.y + this.player.height/2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                decay: 0.01
            });
        }
    }

    restartGame() {
        this.attempts++;
        document.getElementById('attempts').textContent = this.attempts;

        // Reset game mode to starting mode for mixed levels
        if (this.gameMode === 'mixed') {
            this.currentGameMode = 'cube';
        }

        this.resetPlayerPosition();
        this.speed = this.baseSpeed;
        this.speedMultiplier = 1;
        this.camera.x = 0;
        this.score = 0;
        this.particles = [];

        this.generateLevel();
        this.updateInstructions(); // Update instructions to match reset game mode

        this.gameState = 'playing';
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('pauseBtn').textContent = 'Pause';
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GeometryDash();
});