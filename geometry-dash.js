class GeometryDash {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();

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
            jumpPower: 11.25,
            gravity: 0.6,
            onGround: false,
            color: '#00ff88',
            trail: [],
            persistentWaveTrail: [],
            waveVelocity: 0,
            waveHorizontalVelocity: 0,
            waveSpeed: 3.75 * 1.25 * 1.25 * 1.25,
            shipVelocity: 0,
            shipSpeed: 3.75 * 1.25 * 1.25 * 1.25,
            ballVelocity: 0,
            ballSpeed: (5.625 / 1.25 / 1.25) * 1.25 * 1.25 * 1.25,
            spiderVelocity: 0,
            spiderSpeed: 5,
            rotation: 0,
            gravityDirection: 1,
            canChangeGravity: true,
            gravityFlash: 0
        };

        // Hitbox offsets for more forgiving collision
        // Smart Help System - Failure Analytics
        this.failureAnalytics = {
            enabled: true,
            sessionData: {
                totalDeaths: 0,
                levelDeaths: {},
                failureHotspots: [],
                timeSpentOnSections: {},
                inputPatterns: [],
                lastFailureTime: null
            },
            patterns: {
                earlyJump: 0,
                lateReaction: 0,
                wrongModeTransition: 0,
                timingIssues: 0,
                gravityConfusion: 0
            },
            suggestions: [],
            lastSuggestionTime: 0,
            suggestionCooldown: 10000 // 10 seconds
        };

        // Load existing analytics data
        this.loadAnalyticsData();

        // Track section entry times for analytics
        this.sectionTracker = {
            currentSection: null,
            entryTime: null,
            lastPosition: 0
        };

        // Flag to track if analytics event listeners are attached
        this.analyticsListenersAttached = false;
        this.tutorialListenersAttached = false;
        this.leaderboardListenersAttached = false;

        // Tutorial System
        this.tutorialSystem = {
            active: false,
            currentStep: 0,
            steps: [],
            completed: this.loadTutorialProgress(),
            paused: false
        };

        // Leaderboard System
        this.leaderboard = {
            currentPlayer: this.loadPlayerName(),
            scores: this.loadLeaderboardData(),
            enabled: true
        };

        // Custom Level Project System
        this.levelProjects = {
            projects: this.loadLevelProjects(),
            currentProject: null,
            currentProjectName: null
        };

        // Custom Levels Storage System
        this.customLevels = {
            slots: this.loadCustomLevels(),
            maxSlots: 10,
            currentSlot: null
        };

        this.hitboxOffset = {
            player: 4,     // Player hitbox is 4px smaller on each side
            obstacle: 3    // Obstacle hitboxes are 3px smaller on each side
        };

        this.obstacles = [];
        this.particles = [];
        this.portals = [];
        this.speedPortals = [];
        this.finishPortals = [];
        this.camera = { x: 0 };
        this.baseSpeed = (7.03125 / 1.25 / 1.25 / 1.5) * 1.25 * 1.25 * 1.25;
        this.speed = (7.03125 / 1.25 / 1.25 / 1.5) * 1.25 * 1.25 * 1.25;
        this.speedMultiplier = 1;
        this.gameSpeedMultiplier = 1;
        this.lastTime = 0;
        this.targetFPS = 60;
        this.deltaTime = 0;
        this.lastObstacle = 0;
        this.showHitboxes = false;
        this.autoPlay = false;
        this.autoPlayClickTimer = 0;
        this.autoPlayClickInterval = 3;
        this.lastJumpTime = 0;
        this.jumpSpamTimer = 0;
        this.jumpSpamInterval = 100; // 100ms between spam jumps
        this.lastWaveAction = 0;

        // Practice mode variables
        this.practiceMode = false;
        this.checkpoints = [];
        this.lastCheckpoint = null;
        this.lastShipAction = 0;
        this.currentWaveDirection = null; // 'up', 'down', or null
        this.lastJumpedObstacle = null; // Track which obstacle we last jumped for

        this.keys = {};
        this.mousePressed = false;

        this.setupEventListeners();
        this.updateLevelSelector(); // Initialize custom levels in dropdown
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

    showLevelNotification(title, message, onContinue, onCancel) {
        const normalInstructions = document.getElementById('normalInstructions');
        const warningBox = document.getElementById('warningBox');
        const titleElement = document.getElementById('warningTitle');
        const messageElement = document.getElementById('warningMessage');
        const continueBtn = document.getElementById('continueBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        // Hide normal instructions and show warning
        normalInstructions.style.display = 'none';
        warningBox.style.display = 'block';

        titleElement.textContent = title;
        messageElement.textContent = message;

        // Remove any existing event listeners
        const newContinueBtn = continueBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Add new event listeners
        newContinueBtn.addEventListener('click', () => {
            warningBox.style.display = 'none';
            normalInstructions.style.display = 'block';
            onContinue();
        });

        newCancelBtn.addEventListener('click', () => {
            warningBox.style.display = 'none';
            normalInstructions.style.display = 'block';
            onCancel();
        });
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Escape') {
                const helpMenu = document.getElementById('helpMenu');
                if (helpMenu.style.display === 'flex') {
                    this.hideHelpMenu();
                    e.preventDefault();
                    return;
                }
            }
            if ((e.code === 'Space' || e.code === 'ArrowUp') && this.gameState === 'playing') {
                e.preventDefault();
                this.jump();
            } else if (e.code === 'Space' && this.gameState === 'gameOver') {
                e.preventDefault();
                this.restartGame();
            } else if (e.code === 'KeyZ' && this.practiceMode && this.gameState === 'playing') {
                e.preventDefault();
                this.placeCheckpoint();
            } else if (e.code === 'KeyX' && this.practiceMode && this.gameState === 'playing') {
                e.preventDefault();
                this.deleteCheckpoint();
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

        // Touch controls for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.mousePressed = true;
            if (this.gameState === 'playing') {
                this.jump();
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mousePressed = false;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
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

        document.getElementById('backToEditorBtn').addEventListener('click', () => {
            this.returnToEditor();
        });

        document.getElementById('showHitboxesBtn').addEventListener('click', () => {
            this.showHitboxes = !this.showHitboxes;
            document.getElementById('showHitboxesBtn').textContent =
                this.showHitboxes ? 'Hide Hitboxes' : 'Show Hitboxes';
        });

        const helpBtn = document.getElementById('helpBtn');
        const closeHelpBtn = document.getElementById('closeHelpBtn');
        const helpMenu = document.getElementById('helpMenu');

        console.log('Help menu elements found:', {
            helpBtn: !!helpBtn,
            closeHelpBtn: !!closeHelpBtn,
            helpMenu: !!helpMenu
        });

        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                console.log('Help button clicked');
                this.showHelpMenu();
            });
        } else {
            console.error('Help button not found');
        }

        const tutorialBtn = document.getElementById('tutorialBtn');
        if (tutorialBtn) {
            tutorialBtn.addEventListener('click', () => {
                console.log('Tutorial button clicked');
                this.startTutorial('basic');
            });
        } else {
            console.error('Tutorial button not found');
        }

        const userLevelsBtn = document.getElementById('userLevelsBtn');
        if (userLevelsBtn) {
            userLevelsBtn.addEventListener('click', () => {
                console.log('User Levels button clicked');
                this.showUserLevelsPage();
            });
        } else {
            console.error('User Levels button not found');
        }

        const uploadLevelBtn = document.getElementById('uploadLevelBtn');
        console.log('Upload Level button element:', uploadLevelBtn);
        console.log('Button style display:', uploadLevelBtn?.style.display);
        console.log('Button computed style:', window.getComputedStyle(uploadLevelBtn));
        if (uploadLevelBtn) {
            console.log('Adding event listener to Upload Level button');

            // Test basic click
            uploadLevelBtn.onclick = (e) => {
                console.log('Upload Level button ONCLICK triggered!', e);
                alert('Upload button clicked via onclick!');
            };

            uploadLevelBtn.addEventListener('click', (e) => {
                console.log('Upload Level button clicked via addEventListener!', e);
                e.preventDefault();
                e.stopPropagation();
                this.showLevelUploadModal();
            });

            // Test if button is disabled
            console.log('Button disabled:', uploadLevelBtn.disabled);
            console.log('Button style pointer-events:', uploadLevelBtn.style.pointerEvents);
            console.log('Event listener added successfully');
        } else {
            console.error('Upload Level button not found');
        }

        if (closeHelpBtn) {
            closeHelpBtn.addEventListener('click', () => {
                console.log('Close help button clicked');
                this.hideHelpMenu();
            });
        } else {
            console.error('Close help button not found');
        }

        if (helpMenu) {
            helpMenu.addEventListener('click', (e) => {
                // Only close if clicking the background overlay, not the content
                if (e.target === helpMenu) {
                    this.hideHelpMenu();
                }
            });
        } else {
            console.error('Help menu not found');
        }

        document.getElementById('autoPlayBtn').addEventListener('click', () => {
            this.toggleAutoPlay();
        });

        document.getElementById('practiceBtn').addEventListener('click', () => {
            this.togglePracticeMode();
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('volume').addEventListener('input', (e) => {
            this.volumeLevel = e.target.value / 100;
        });

        document.getElementById('gameSpeed').addEventListener('input', (e) => {
            this.gameSpeedMultiplier = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = e.target.value + 'x';
        });

        document.getElementById('gameMode').addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            this.updateInstructions();
            this.resetPlayerPosition();
            this.generateLevel();
        });

        document.getElementById('levelSelect').addEventListener('change', (e) => {
            if (e.target.value === 'developer') {
                this.currentLevel = 'developer';
                this.loadDeveloperChallenge();
                document.getElementById('currentLevel').textContent = "Developer's Challenge";
                if (this.gameState === 'playing' || this.gameState === 'levelComplete') {
                    this.restartGame();
                }
            } else if (e.target.value === 'impossible') {
                console.log('Impossible level selected, showing notification...');
                this.showLevelNotification(
                    "Warning: Impossible Level Selected",
                    "The developer's way to vent pent up rage",
                    () => {
                        console.log('Impossible level confirmed, loading...');
                        this.currentLevel = 'impossible';
                        this.loadImpossibleChallenge();
                        document.getElementById('currentLevel').textContent = "Impossible";
                        // Always restart to ensure level loads properly
                        this.restartGame();
                    },
                    () => {
                        console.log('Impossible level cancelled');
                        // Reset to previous level if cancelled
                        document.getElementById('levelSelect').value = '1';
                        this.currentLevel = 1;
                        this.isCustomLevel = false;
                        this.customLevelData = null;

                        // Clear custom level from localStorage
                        localStorage.removeItem('customLevel');

                        // Remove ?custom=true from URL if present
                        const url = new URL(window.location);
                        if (url.searchParams.has('custom')) {
                            url.searchParams.delete('custom');
                            window.history.replaceState({}, '', url);
                        }

                        this.generateLevel();
                        document.getElementById('currentLevel').textContent = "1";
                        if (this.gameState === 'playing' || this.gameState === 'levelComplete') {
                            this.restartGame();
                        }
                    }
                );
            } else if (e.target.value.startsWith('project_')) {
                // Handle project level selection
                const projectName = e.target.value.replace('project_', '');
                this.loadProjectLevel(projectName);
            } else {
                // Regular level selected - clear custom level flags
                this.isCustomLevel = false;
                this.customLevelData = null;

                // Clear custom level from localStorage
                localStorage.removeItem('customLevel');

                // Remove ?custom=true from URL if present
                const url = new URL(window.location);
                if (url.searchParams.has('custom')) {
                    url.searchParams.delete('custom');
                    window.history.replaceState({}, '', url);
                }

                this.currentLevel = parseInt(e.target.value);
                this.generateLevel();
                document.getElementById('currentLevel').textContent = this.currentLevel;
                if (this.gameState === 'playing' || this.gameState === 'levelComplete') {
                    this.restartGame();
                }
            }
            this.updateBackToEditorButton();
        });
    }

    updateInstructions() {
        const instructionText = document.getElementById('instructionText');
        let baseText = '';

        if (this.gameMode === 'mixed') {
            baseText = 'Controls change with each gamemode! Watch for portals!';
        } else if (this.gameMode === 'wave' || this.currentGameMode === 'wave') {
            baseText = 'Hold SPACE/UP ARROW or click to fly up, release to fly down!';
        } else if (this.gameMode === 'ship' || this.currentGameMode === 'ship') {
            baseText = 'Hold SPACE/UP ARROW or click to fly up, release to fall down!';
        } else if (this.gameMode === 'ball' || this.currentGameMode === 'ball') {
            baseText = 'Press SPACE/UP ARROW or click to change gravity direction!';
        } else {
            baseText = 'Press SPACE/UP ARROW or click to jump!';
        }

        if (this.practiceMode) {
            instructionText.textContent = baseText + ' | Practice: Z = Checkpoint, X = Delete';
        } else {
            instructionText.textContent = baseText;
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
        this.player.spiderVelocity = 0;
        this.player.rotation = 0;
        this.player.gravityDirection = 1;
        this.player.canChangeGravity = true;
        this.player.gravityFlash = 0;
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

        if (mode === 'spider') {
            if (this.player.canChangeGravity) {
                // Instantly flip gravity
                this.player.gravityDirection *= -1;
                this.player.canChangeGravity = false;
                // Trigger flash animation
                this.player.gravityFlash = 1;
                this.playSound('jump');
            }
            return;
        }

        if (this.player.onGround || this.player.y >= this.canvas.height - this.player.height - 50) {
            this.player.velocity = -this.player.jumpPower;
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
        const totalSpeed = this.player.waveSpeed * 1.5;
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

        this.player.y += this.player.waveVelocity * this.deltaTime * this.gameSpeedMultiplier;

        // Apply horizontal movement - wave always moves forward like slopes
        this.player.x += this.player.waveHorizontalVelocity * this.gameSpeedMultiplier * this.deltaTime;

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
        const acceleration = 0.8;
        const deceleration = 0.6;
        const maxSpeed = this.player.shipSpeed;

        if (isPressed) {
            this.player.shipVelocity = Math.max(this.player.shipVelocity - acceleration * this.deltaTime * this.gameSpeedMultiplier, -maxSpeed);
        } else {
            this.player.shipVelocity = Math.min(this.player.shipVelocity + deceleration * this.deltaTime * this.gameSpeedMultiplier, maxSpeed);
        }

        this.player.y += this.player.shipVelocity * this.deltaTime * this.gameSpeedMultiplier;

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

        this.player.velocity += this.player.gravity * this.player.gravityDirection * this.deltaTime * this.gameSpeedMultiplier;
        this.player.y += this.player.velocity * this.deltaTime * this.gameSpeedMultiplier;

        this.player.rotation += this.player.velocity * 0.1;

        const ground = this.canvas.height - 50;
        const ceiling = 0;

        if (this.player.gravityDirection > 0) {
            if (this.player.y + this.player.height >= ground) {
                this.player.y = ground - this.player.height;
                this.player.onGround = true;
                this.player.canChangeGravity = true;
                // Clamp velocity to prevent going through ground
                if (this.player.velocity > 0) {
                    this.player.velocity = 0;
                }
            } else {
                this.player.onGround = false;
            }
        } else {
            if (this.player.y <= ceiling) {
                this.player.y = ceiling;
                this.player.onGround = true;
                this.player.canChangeGravity = true;
                // Clamp velocity to prevent going through ceiling
                if (this.player.velocity < 0) {
                    this.player.velocity = 0;
                }
            } else {
                this.player.onGround = false;
            }
        }
    }

    handleSpiderMovement() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (mode !== 'spider') return;

        // Spider moves at constant speed on surfaces
        const ground = this.canvas.height - 50;
        const ceiling = 0;

        // Apply gravity
        if (this.player.gravityDirection > 0) {
            // Normal gravity - stick to ground
            this.player.y = ground - this.player.height;
            this.player.onGround = true;
            this.player.canChangeGravity = true;
            this.player.velocity = 0;
        } else {
            // Inverted gravity - stick to ceiling
            this.player.y = ceiling;
            this.player.onGround = true;
            this.player.canChangeGravity = true;
            this.player.velocity = 0;
        }

        // Decay flash effect
        if (this.player.gravityFlash > 0) {
            this.player.gravityFlash -= this.deltaTime * 5;
            if (this.player.gravityFlash < 0) this.player.gravityFlash = 0;
        }
    }

    checkForCustomLevel() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('custom') === 'true') {
            const customLevel = localStorage.getItem('customLevel');
            if (customLevel) {
                try {
                    this.customLevelData = this.decompressLevel(customLevel);
                    this.isCustomLevel = true;
                    this.updateBackToEditorButton();
                } catch (e) {
                    console.error('Invalid custom level data:', e);
                    this.isCustomLevel = false;
                    this.updateBackToEditorButton();
                }
            }
        }
    }

    generateLevel() {
        this.obstacles = [];
        this.portals = [];
        this.speedPortals = [];
        this.finishPortals = [];
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
        this.speedPortals = this.customLevelData.speedPortals ? this.customLevelData.speedPortals.map(portal => ({
            x: portal.x,
            y: portal.y,
            width: portal.width,
            height: portal.height,
            speed: portal.speed,
            color: this.getSpeedPortalColor(portal.speed),
            rotation: portal.rotation || 0
        })) : [];

        // Load finish portals
        this.finishPortals = this.customLevelData.finishPortals ? this.customLevelData.finishPortals.map(portal => ({
            x: portal.x,
            y: portal.y,
            width: portal.width,
            height: portal.height,
            rotation: portal.rotation || 0
        })) : [];

        // Assign game modes to obstacles based on portal positions
        this.assignGameModesToObstacles();
    }

    assignGameModesToObstacles() {
        // Sort portals by x position to ensure correct order
        const sortedPortals = [...this.portals].sort((a, b) => a.x - b.x);

        // Assign game modes to each obstacle based on which portal section it's in
        for (let obstacle of this.obstacles) {
            // Skip if obstacle already has a game mode
            if (obstacle.gameMode) continue;

            // Default to cube mode (before first portal)
            let assignedMode = 'cube';

            // Find which portal section this obstacle is in
            for (let portal of sortedPortals) {
                if (obstacle.x >= portal.x) {
                    // Obstacle is past this portal, so it belongs to this portal's mode
                    assignedMode = portal.toMode;
                } else {
                    // Obstacle is before this portal, stop checking
                    break;
                }
            }

            // Assign the determined game mode
            obstacle.gameMode = assignedMode;
        }

        console.log('Assigned game modes to obstacles based on portal positions');
    }

    decompressLevel(compressedData) {
        try {
            // Trim whitespace
            compressedData = compressedData.trim();

            // Try to decode from base64
            const jsonStr = atob(compressedData);
            const data = JSON.parse(jsonStr);

            // Check if it's compressed format (version 2)
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

            // If not compressed, return as-is (backward compatibility)
            return data;
        } catch (e) {
            console.error('Base64 decode failed, trying regular JSON:', e);
            // If base64 decode fails, try parsing as regular JSON (old format)
            return JSON.parse(compressedData);
        }
    }

    loadDeveloperChallenge() {
        // Developer's Challenge level data
        const developerLevelData = {
            "name": "Developer's Challenge",
            "difficulty": 4,
            "objects": [
                {"x": 580, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 620, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 660, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 700, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 740, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 780, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 820, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 860, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 900, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 940, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 980, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1020, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1060, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1100, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 820, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 780, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 740, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 700, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 660, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 620, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 580, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 540, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 860, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 900, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 940, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 980, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1020, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1060, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1100, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1140, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1180, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1220, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1260, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1300, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1340, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1380, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1420, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1460, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1500, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1540, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1580, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1620, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1660, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1700, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1740, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1220, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1260, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1300, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1340, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1380, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1420, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1460, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1500, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1540, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1580, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1620, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1660, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1700, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1740, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1980, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 1980, "y": 200, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 1980, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2180, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2180, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2180, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2420, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2420, "y": 180, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2420, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2700, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2700, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2740, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2700, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2740, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2780, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2820, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2860, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2900, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2780, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2820, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2860, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 2900, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3320, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3320, "y": 180, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3320, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3520, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3520, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3520, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3720, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3720, "y": 180, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3720, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3980, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3980, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3980, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4020, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4060, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4100, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4140, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4180, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4220, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4020, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4060, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4100, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4140, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4180, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4220, "y": 60, "width": 40, "height": 100, "type": "wall-top", "rotation": 0}
            ],
            "portals": [
                {"x": 200, "y": 0, "width": 60, "height": 350, "type": "portal", "rotation": 0, "mode": "wave"},
                {"x": 3060, "y": 0, "width": 60, "height": 350, "type": "portal", "rotation": 0, "mode": "ship"}
            ],
            "speedPortals": [],
            "finishPortals": [
                {"x": 4440, "y": 0, "width": 60, "height": 350, "type": "finishPortal", "rotation": 0}
            ]
        };

        // Set up as custom level
        this.isCustomLevel = true;
        this.customLevelData = developerLevelData;

        // Reset level state
        this.obstacles = [];
        this.portals = [];
        this.speedPortals = [];
        this.finishPortals = [];
        this.speed = this.baseSpeed;

        // Load the level data
        this.loadCustomLevel();
    }

    loadImpossibleChallenge() {
        // Impossible Challenge - The developer's way to vent pent up rage
        const impossibleLevelData = {
            "name": "Custom Level",
            "difficulty": 1,
            "objects": [
                {"x": 340, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 380, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 420, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 460, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 500, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 540, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 580, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 620, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 660, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 700, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 740, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 780, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 820, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 860, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 900, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 940, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 980, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1020, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1060, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1100, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1140, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1180, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1220, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1260, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1300, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1340, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1380, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 340, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 380, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 420, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 460, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 500, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 540, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 580, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 620, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 660, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 700, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 740, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 780, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 820, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 860, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 900, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 940, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 980, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1020, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1060, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1100, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1140, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1180, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1220, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1260, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1300, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1340, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1380, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1680, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 1680, "y": 0, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 1680, "y": 100, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 1920, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 1920, "y": 160, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 1920, "y": 0, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2100, "y": 0, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2100, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2100, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2320, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2320, "y": 120, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2320, "y": 0, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2320, "y": 20, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2640, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2640, "y": 0, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2640, "y": 60, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2680, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2720, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2760, "y": 260, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2680, "y": 60, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2720, "y": 60, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2760, "y": 60, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2800, "y": 240, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2840, "y": 240, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2880, "y": 240, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2920, "y": 240, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2800, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2820, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2840, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2880, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2920, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2960, "y": 220, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 2960, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 3000, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 3040, "y": 80, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 3000, "y": 220, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 3040, "y": 220, "width": 40, "height": 100, "type": "wall-bottom", "rotation": 0},
                {"x": 3360, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3360, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3360, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3580, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3580, "y": 160, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3580, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3800, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3800, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 3800, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4000, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4000, "y": 180, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4000, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4000, "y": 40, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4200, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4200, "y": 0, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4200, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4240, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4240, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4280, "y": 80, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4280, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4320, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4360, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4400, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4440, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4480, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4520, "y": 260, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4320, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4360, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4400, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4440, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4480, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4520, "y": 100, "width": 40, "height": 100, "type": "wall-top", "rotation": 0},
                {"x": 4820, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 4860, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 4900, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 4980, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 4940, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5060, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5020, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 6300, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6340, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6380, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6420, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6460, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6500, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6540, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6580, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6620, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6660, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6700, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6740, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6780, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6820, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6860, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6900, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6940, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6980, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7020, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7060, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7100, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7140, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7180, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7220, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7260, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7300, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7340, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7380, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7420, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7460, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7500, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7540, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7580, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7620, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7660, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7740, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7820, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7900, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7700, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7780, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7860, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6300, "y": 260, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6340, "y": 220, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6380, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6420, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6460, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6500, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6540, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6580, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6620, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6660, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6700, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6740, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6780, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6820, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6860, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6900, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6940, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6980, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7020, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7060, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7100, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7140, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7180, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7220, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7260, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7300, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7340, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7380, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7420, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7460, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7500, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7540, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7580, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7620, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7700, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7780, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7860, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7660, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7740, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7820, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7900, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 300, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 340, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 380, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 420, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 460, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 500, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 660, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 700, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 740, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 780, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 980, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1020, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1180, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1220, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1340, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 1380, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 540, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 580, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 620, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 900, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 940, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1060, "y": 0, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1100, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1140, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1260, "y": 40, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 1300, "y": 80, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 380, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 420, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 460, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 500, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 820, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 780, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 740, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 700, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 660, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1020, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 980, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1220, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1180, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1380, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 1340, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 540, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 580, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 620, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 860, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 900, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 940, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1060, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1100, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1140, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1260, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 1300, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6580, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6620, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6660, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6780, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6820, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6860, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6940, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 6980, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7060, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7180, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7300, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7340, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7380, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7580, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7660, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7740, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7820, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7900, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 270},
                {"x": 7860, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7780, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7700, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7620, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7540, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7500, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7460, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7420, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7260, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7220, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7140, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7100, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 7020, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6900, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6540, "y": 120, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6500, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6460, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6420, "y": 240, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6380, "y": 280, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6340, "y": 320, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6620, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6660, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6780, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6820, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6860, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6940, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6980, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7060, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7180, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7140, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7100, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7020, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6900, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6740, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6700, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7220, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7260, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7300, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7340, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7380, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7420, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7460, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7500, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7540, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7620, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7700, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7780, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7860, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 7580, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7660, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7740, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7820, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 7900, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6260, "y": 260, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6300, "y": 220, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6340, "y": 180, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6380, "y": 140, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6420, "y": 100, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6460, "y": 60, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6500, "y": 20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 820, "y": -40, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 860, "y": -40, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6580, "y": -20, "width": 40, "height": 40, "type": "slope-up", "rotation": 90},
                {"x": 6540, "y": -20, "width": 40, "height": 40, "type": "slope-up", "rotation": 0},
                {"x": 6700, "y": 200, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 6740, "y": 160, "width": 40, "height": 40, "type": "slope-up", "rotation": 180},
                {"x": 5060, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5100, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5140, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5180, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5220, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5260, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5300, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5340, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5380, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5380, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5420, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5460, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5500, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5540, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5580, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5620, "y": 320, "width": 40, "height": 40, "type": "spike", "rotation": 0},
                {"x": 5620, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5660, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5700, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5740, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5780, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180},
                {"x": 5820, "y": 0, "width": 40, "height": 40, "type": "spike", "rotation": 180}
            ],
            "portals": [
                {"x": 3120, "y": 0, "width": 60, "height": 350, "type": "portal", "rotation": 0, "mode": "ship"},
                {"x": 4680, "y": 0, "width": 60, "height": 350, "type": "portal", "rotation": 0, "mode": "ball"},
                {"x": 6000, "y": 0, "width": 60, "height": 350, "type": "portal", "rotation": 0, "mode": "wave"},
                {"x": 160, "y": 0, "width": 60, "height": 350, "type": "portal", "rotation": 0, "mode": "wave"}
            ],
            "speedPortals": [],
            "finishPortals": [
                {"x": 8020, "y": 0, "width": 60, "height": 350, "type": "finishPortal", "rotation": 0}
            ]
        };

        // Clear existing obstacles and set up for custom level
        this.obstacles = [];
        this.portals = [];
        this.speedPortals = [];
        this.finishPortals = [];
        this.speed = this.baseSpeed;

        // Add a test jump pad for debugging
        impossibleLevelData.objects.push({
            x: 800, y: 305, width: 50, height: 15, type: 'jump-pad', rotation: 0
        });

        // Store the level data for loading
        this.customLevelData = impossibleLevelData;
        this.isCustomLevel = true;

        // Load the level data
        this.loadCustomLevel();
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

        // Increase level length based on difficulty
        const lengthMultiplier = 1 + (this.currentLevel - 1) * 0.5; // Each level adds 50% more length
        const baseCubeLength = 1000 * lengthMultiplier;
        const baseWaveLength = 800 * lengthMultiplier;
        const baseShipLength = 800 * lengthMultiplier;
        const baseBallLength = 600 * lengthMultiplier;
        const baseSpiderLength = 700 * lengthMultiplier;

        return [
            { type: 'standard_jumps', mode: 'cube', x: 400, length: baseCubeLength, maxObjects: Math.floor(objectsPerLevel * 0.4) },
            { type: 'standard_flight', mode: 'wave', x: 400 + baseCubeLength, length: baseWaveLength, maxObjects: Math.floor(objectsPerLevel * 0.3) },
            { type: 'standard_ship', mode: 'ship', x: 400 + baseCubeLength + baseWaveLength, length: baseShipLength, maxObjects: Math.floor(objectsPerLevel * 0.3) },
            { type: 'standard_ball', mode: 'ball', x: 400 + baseCubeLength + baseWaveLength + baseShipLength, length: baseBallLength, maxObjects: Math.floor(objectsPerLevel * 0.1) },
            { type: 'standard_spider', mode: 'spider', x: 400 + baseCubeLength + baseWaveLength + baseShipLength + baseBallLength, length: baseSpiderLength, maxObjects: Math.floor(objectsPerLevel * 0.15) }
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
            standard_ball: { min: 140, variance: 60 },
            standard_spider: { min: 150, variance: 70 }
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
        } else if (mode === 'spider') {
            this.generateSpiderObstacle(x, sectionType);
        }
    }

    generateCubeObstacle(x, difficulty) {
        // Cube mode generates spikes and platforms
        const type = Math.random();
        const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);

        if (type < 0.4) {
            // Ground spikes
            this.obstacles.push({
                x: x, y: this.canvas.height - 50 - 40,
                width: 40, height: 40, type: 'spike', gameMode: 'cube'
            });
        } else if (type < 0.7) {
            // Raised platform
            const platformHeight = 60 + Math.random() * (80 * difficultyMultiplier);
            const platformWidth = Math.max(40, 60 - (difficultyMultiplier - 1) * 15);
            this.obstacles.push({
                x: x, y: this.canvas.height - 50 - platformHeight,
                width: platformWidth, height: 15, type: 'platform', gameMode: 'cube'
            });
        } else {
            // Floating platform
            const floatingY = 150 + Math.random() * 80;
            const platformWidth = Math.max(35, 50 - (difficultyMultiplier - 1) * 10);
            this.obstacles.push({
                x: x, y: floatingY,
                width: platformWidth, height: 15, type: 'platform', gameMode: 'cube'
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
            height: gapPosition - gapSize/2, type: 'wall-top', gameMode: 'wave'
        });
        this.obstacles.push({
            x: x, y: gapPosition + gapSize/2, width: 30,
            height: this.canvas.height - 50 - (gapPosition + gapSize/2), type: 'wall-bottom', gameMode: 'wave'
        });
    }

    generateShipObstacle(x, difficulty) {
        console.log('🚨 generateShipObstacle called! x:', x, 'difficulty:', difficulty);
        const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
        const gapSize = Math.max(80, 140 - (difficultyMultiplier - 1) * 20);
        const gapPosition = 80 + Math.random() * (this.canvas.height - 250);

        this.obstacles.push({
            x: x, y: 0, width: 25,
            height: gapPosition - gapSize/2, type: 'wall-top', gameMode: 'ship'
        });
        this.obstacles.push({
            x: x, y: gapPosition + gapSize/2, width: 25,
            height: this.canvas.height - 50 - (gapPosition + gapSize/2), type: 'wall-bottom', gameMode: 'ship'
        });
    }

    generateBallObstacle(x, difficulty) {
        // Ball mode generates multiple spikes together
        const spikePattern = Math.random();
        const numSpikes = Math.floor(Math.random() * 3) + 2; // 2-4 spikes

        if (spikePattern < 0.5) {
            // Generate multiple bottom spikes in a row
            for (let i = 0; i < numSpikes; i++) {
                this.obstacles.push({
                    x: x + (i * 45),
                    y: this.canvas.height - 50 - 40,
                    width: 40,
                    height: 40,
                    type: 'spike',
                    gameMode: 'ball'
                });
            }
        } else {
            // Generate multiple top spikes in a row (for inverted gravity)
            for (let i = 0; i < numSpikes; i++) {
                this.obstacles.push({
                    x: x + (i * 45),
                    y: 50,
                    width: 40,
                    height: 40,
                    type: 'spike-up',
                    gameMode: 'ball'
                });
            }
        }
    }

    generateSpiderObstacle(x, difficulty) {
        // Spider mode generates single spikes on floor or ceiling
        const spikePattern = Math.random();

        if (spikePattern < 0.5) {
            // Generate bottom spike
            this.obstacles.push({
                x: x,
                y: this.canvas.height - 50 - 40,
                width: 40,
                height: 40,
                type: 'spike',
                gameMode: 'spider'
            });
        } else {
            // Generate top spike
            this.obstacles.push({
                x: x,
                y: 50,
                width: 40,
                height: 40,
                type: 'spike-up',
                gameMode: 'spider'
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
        let sectionLength = 800;
        const totalSections = 11; // Increased to 11 to complete the cycle with a final cube section

        for (let section = 0; section < totalSections; section++) {
            const startX = 400 + section * sectionLength;
            const endX = startX + sectionLength - 200;

            // Determine what mode THIS section should have based on its position
            let sectionMode;
            if (section % 5 === 0) {
                sectionMode = 'cube';
            } else if (section % 5 === 1) {
                sectionMode = 'wave';
            } else if (section % 5 === 2) {
                sectionMode = 'ship';
            } else if (section % 5 === 3) {
                sectionMode = 'ball';
            } else {
                sectionMode = 'spider';
            }

            if (section > 0) {
                // Get the previous section's mode
                let prevMode;
                if ((section - 1) % 5 === 0) {
                    prevMode = 'cube';
                } else if ((section - 1) % 5 === 1) {
                    prevMode = 'wave';
                } else if ((section - 1) % 5 === 2) {
                    prevMode = 'ship';
                } else if ((section - 1) % 5 === 3) {
                    prevMode = 'ball';
                } else {
                    prevMode = 'spider';
                }

                console.log(`Portal at x${startX - 100}: ${prevMode} → ${sectionMode} (for section ${section})`);

                this.portals.push({
                    x: startX - 100,
                    y: 0,
                    width: 60,
                    height: this.canvas.height - 50,
                    fromMode: prevMode,
                    toMode: sectionMode
                });
            }

            // Generate obstacles for this section's mode
            console.log(`Section ${section}: x${startX}-${endX}, mode: ${sectionMode}`);
            this.generateSectionObstacles(startX, endX, sectionMode);
        }
    }

    getNextGameMode(currentMode) {
        const modes = ['cube', 'wave', 'ship', 'ball', 'spider'];
        const currentIndex = modes.indexOf(currentMode);
        return modes[(currentIndex + 1) % modes.length];
    }

    generateSectionObstacles(startX, endX, mode) {
        // Add more space after portals for cube sections
        const firstObstacleX = mode === 'cube' ? startX + 200 : startX;
        for (let x = firstObstacleX; x < endX; x += 150 + Math.random() * 50) { // More consistent spacing: 150-200px apart
            const type = Math.random();

            if (mode === 'cube') {
                console.log('Cube mode: generating spikes and platforms at x:', x);
                // Generate spikes and platforms for cube mode
                if (type < 0.4) {
                    // Ground spike
                    this.obstacles.push({
                        x: x, y: this.canvas.height - 50 - 40,
                        width: 40, height: 40, type: 'spike', gameMode: 'cube'
                    });
                } else if (type < 0.7) {
                    // Raised platform
                    const platformHeight = 80 + Math.random() * 60;
                    this.obstacles.push({
                        x: x, y: this.canvas.height - 50 - platformHeight,
                        width: 50, height: 15, type: 'platform', gameMode: 'cube'
                    });
                } else {
                    // Floating platform
                    const floatingY = 150 + Math.random() * 80;
                    this.obstacles.push({
                        x: x, y: floatingY,
                        width: 45, height: 15, type: 'platform', gameMode: 'cube'
                    });
                }
            } else if (mode === 'wave' || mode === 'ship') {
                console.log(`${mode} mode: generating pillars at x:`, x);
                const gapSize = mode === 'wave' ? 80 + Math.random() * 40 : 100 + Math.random() * 50;
                const gapPosition = 80 + Math.random() * (this.canvas.height - 200);

                console.log('Adding wall-top');
                this.obstacles.push({
                    x: x, y: 0, width: 30,
                    height: gapPosition - gapSize/2, type: 'wall-top', gameMode: mode
                });
                console.log('Adding wall-bottom');
                this.obstacles.push({
                    x: x, y: gapPosition + gapSize/2, width: 30,
                    height: this.canvas.height - 50 - (gapPosition + gapSize/2), type: 'wall-bottom', gameMode: mode
                });
            } else if (mode === 'ball') {
                console.log('Ball mode: generating multiple spikes at x:', x);
                // Generate multiple spikes together
                const spikePattern = Math.random();
                const numSpikes = Math.floor(Math.random() * 3) + 2; // 2-4 spikes

                if (spikePattern < 0.5) {
                    // Generate multiple bottom spikes in a row
                    for (let i = 0; i < numSpikes; i++) {
                        this.obstacles.push({
                            x: x + (i * 45), y: this.canvas.height - 50 - 40,
                            width: 40, height: 40, type: 'spike', gameMode: 'ball'
                        });
                    }
                } else {
                    // Generate multiple top spikes in a row
                    for (let i = 0; i < numSpikes; i++) {
                        this.obstacles.push({
                            x: x + (i * 45), y: 50,
                            width: 40, height: 40, type: 'spike-up', gameMode: 'ball'
                        });
                    }
                }
            } else if (mode === 'spider') {
                console.log('Spider mode: generating spikes on ground and ceiling');
                const spikePattern = Math.random();
                if (spikePattern < 0.5) {
                    // Generate bottom spikes
                    this.obstacles.push({
                        x: x, y: this.canvas.height - 50 - 40,
                        width: 40, height: 40, type: 'spike', gameMode: 'spider'
                    });
                } else {
                    // Generate top spikes (upside down)
                    this.obstacles.push({
                        x: x, y: 50,
                        width: 40, height: 40, type: 'spike-up', gameMode: 'spider'
                    });
                }
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

        let points;
        if (obstacle.type === 'spike-up') {
            // Upside-down spike: point at bottom, base at top
            points = [
                { x: obstacle.x + obstacle.width/2, y: obstacle.y + obstacle.height - inset }, // bottom point (inset from bottom)
                { x: obstacle.x + inset, y: obstacle.y + inset }, // top-left (inset)
                { x: obstacle.x + obstacle.width - inset, y: obstacle.y + inset } // top-right (inset)
            ];
        } else {
            // Regular spike: top point in center, base at bottom
            points = [
                { x: obstacle.x + obstacle.width/2, y: obstacle.y + inset }, // top point (inset from top)
                { x: obstacle.x + inset, y: obstacle.y + obstacle.height - inset }, // bottom-left (inset)
                { x: obstacle.x + obstacle.width - inset, y: obstacle.y + obstacle.height - inset } // bottom-right (inset)
            ];
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
        } else if (mode === 'spider') {
            this.checkSpiderCollisions();
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
            // Skip obstacles that don't belong to cube mode
            if (obstacle.gameMode && obstacle.gameMode !== 'cube') {
                continue;
            }

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
            } else if (obstacle.type === 'jump-pad') {
                // Jump pad collision detection - simplified for more reliable activation
                if (this.player.x < obstacle.x + obstacle.width &&
                    this.player.x + this.player.width > obstacle.x &&
                    this.player.y < obstacle.y + obstacle.height &&
                    this.player.y + this.player.height > obstacle.y) {

                    console.log('Jump pad collision detected!');
                    const playerBottom = this.player.y + this.player.height;
                    const padTop = obstacle.y;

                    console.log(`Player velocity: ${this.player.velocity}, playerBottom: ${playerBottom}, padTop: ${padTop}`);

                    // Check if player is touching the top surface of the jump pad
                    if (playerBottom >= padTop && playerBottom <= padTop + 10) {
                        console.log('Jump pad activated!');
                        this.player.y = padTop - this.player.height;
                        this.player.velocity = -this.player.jumpPower; // Same boost as cube jump
                        this.player.onGround = false;
                        this.playSound('jump');

                        // Add visual particles for jump pad activation
                        for (let i = 0; i < 10; i++) {
                            this.particles.push({
                                x: obstacle.x + obstacle.width / 2 + (Math.random() - 0.5) * obstacle.width,
                                y: obstacle.y,
                                vx: (Math.random() - 0.5) * 8,
                                vy: -Math.random() * 8 - 2,
                                life: 30,
                                color: '#00ff00'
                            });
                        }
                        continue;
                    } else {
                        console.log(`Jump pad collision but not on top surface. PlayerBottom: ${playerBottom}, PadTop: ${padTop}`);
                    }
                }
            } else {
                // Check for spike collision (triangular)
                if (obstacle.type === 'spike' || obstacle.type === 'spike-up') {
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
            // Skip obstacles that don't belong to ball mode
            if (obstacle.gameMode && obstacle.gameMode !== 'ball') {
                continue;
            }

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
                            this.player.velocity = 0;
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
                            this.player.velocity = 0;
                            continue;
                        }
                    }
                }
            } else if (obstacle.type === 'jump-pad') {
                // Jump pad collision detection for ball mode
                if (this.player.x < obstacle.x + obstacle.width &&
                    this.player.x + this.player.width > obstacle.x &&
                    this.player.y < obstacle.y + obstacle.height &&
                    this.player.y + this.player.height > obstacle.y) {

                    if (this.player.gravityDirection > 0) {
                        const playerBottom = this.player.y + this.player.height;
                        const playerPrevBottom = playerBottom - this.player.velocity;
                        const padTop = obstacle.y;

                        // Only activate when landing on top of the jump pad
                        if (this.player.velocity > 0 &&
                            playerPrevBottom <= padTop &&
                            playerBottom >= padTop &&
                            this.player.x + this.player.width > obstacle.x + 5 &&
                            this.player.x < obstacle.x + obstacle.width - 5) {

                            this.player.y = padTop - this.player.height;
                            this.player.velocity = -this.player.jumpPower; // Same boost as cube jump
                            this.playSound('jump');

                            // Add visual particles
                            for (let i = 0; i < 10; i++) {
                                this.particles.push({
                                    x: obstacle.x + obstacle.width / 2 + (Math.random() - 0.5) * obstacle.width,
                                    y: obstacle.y,
                                    vx: (Math.random() - 0.5) * 8,
                                    vy: -Math.random() * 8 - 2,
                                    life: 30,
                                    color: '#00ff00'
                                });
                            }
                            continue;
                        }
                    } else {
                        const playerTop = this.player.y;
                        const playerPrevTop = playerTop - this.player.velocity;
                        const padBottom = obstacle.y + obstacle.height;

                        // Activate when hitting bottom of jump pad (inverted gravity)
                        if (this.player.velocity < 0 &&
                            playerPrevTop >= padBottom &&
                            playerTop <= padBottom &&
                            this.player.x + this.player.width > obstacle.x + 5 &&
                            this.player.x < obstacle.x + obstacle.width - 5) {

                            this.player.y = padBottom;
                            this.player.velocity = this.player.jumpPower; // Boost in opposite direction for inverted gravity
                            this.playSound('jump');

                            // Add visual particles
                            for (let i = 0; i < 10; i++) {
                                this.particles.push({
                                    x: obstacle.x + obstacle.width / 2 + (Math.random() - 0.5) * obstacle.width,
                                    y: obstacle.y + obstacle.height,
                                    vx: (Math.random() - 0.5) * 8,
                                    vy: Math.random() * 8 + 2,
                                    life: 30,
                                    color: '#00ff00'
                                });
                            }
                            continue;
                        }
                    }
                }
            } else {
                // Check for spike collision (triangular)
                if (obstacle.type === 'spike' || obstacle.type === 'spike-up') {
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

    checkSpiderCollisions() {
        // Spider uses same collision as cube but sticks to surfaces
        const playerHitbox = this.getPlayerHitbox();
        const ground = this.canvas.height - 50;
        const ceiling = 0;

        // Track if spider is touching a surface
        let onSurface = false;

        for (let obstacle of this.obstacles) {
            // Skip obstacles that don't belong to spider mode
            if (obstacle.gameMode && obstacle.gameMode !== 'spider') {
                continue;
            }

            if (obstacle.type === 'platform') {
                // Spider can walk on platforms
                if (this.player.x + this.player.width > obstacle.x &&
                    this.player.x < obstacle.x + obstacle.width) {

                    const playerBottom = this.player.y + this.player.height;
                    const playerTop = this.player.y;
                    const platformTop = obstacle.y;
                    const platformBottom = obstacle.y + obstacle.height;

                    // Check if approaching platform from above (land on top)
                    if (this.player.gravityDirection > 0 &&
                        playerBottom >= platformTop &&
                        playerBottom <= platformTop + 10 &&
                        playerTop < platformTop) {
                        this.player.y = platformTop - this.player.height;
                        this.player.onGround = true;
                        this.player.canChangeGravity = true;
                        onSurface = true;
                        continue;
                    }

                    // Check if approaching platform from below (stick to bottom)
                    if (this.player.gravityDirection < 0 &&
                        playerTop <= platformBottom &&
                        playerTop >= platformBottom - 10 &&
                        playerBottom > platformBottom) {
                        this.player.y = platformBottom;
                        this.player.onGround = true;
                        this.player.canChangeGravity = true;
                        onSurface = true;
                        continue;
                    }
                }
            } else if (obstacle.type !== 'jump-pad') {
                // Check for obstacle collision (not jump-pads)
                if (obstacle.rotation && obstacle.rotation !== 0) {
                    if (this.checkRotatedRectangleCollision(playerHitbox, obstacle)) {
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
            // Skip obstacles that don't belong to wave or ship mode
            if (obstacle.gameMode && obstacle.gameMode !== 'wave' && obstacle.gameMode !== 'ship') {
                continue;
            }

            if (obstacle.type === 'platform') {
                // Platforms are solid surfaces for wave/ship modes but don't kill
                const obstacleHitbox = {
                    x: obstacle.x,
                    y: obstacle.y,
                    width: obstacle.width,
                    height: obstacle.height
                };

                if (this.checkHitboxCollision(playerHitbox, obstacleHitbox)) {
                    // Push player away from platform instead of killing
                    const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

                    // Determine which side of the platform the player hit
                    const playerCenterX = this.player.x + this.player.width / 2;
                    const playerCenterY = this.player.y + this.player.height / 2;
                    const obstacleCenterX = obstacle.x + obstacle.width / 2;
                    const obstacleCenterY = obstacle.y + obstacle.height / 2;

                    const dx = playerCenterX - obstacleCenterX;
                    const dy = playerCenterY - obstacleCenterY;

                    // Push away from the closest edge
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // Hit from left or right
                        if (dx > 0) {
                            this.player.x = obstacle.x + obstacle.width;
                        } else {
                            this.player.x = obstacle.x - this.player.width;
                        }
                        if (mode === 'wave') {
                            this.player.waveHorizontalVelocity = 0;
                        }
                    } else {
                        // Hit from top or bottom
                        if (dy > 0) {
                            this.player.y = obstacle.y + obstacle.height;
                        } else {
                            this.player.y = obstacle.y - this.player.height;
                        }
                        if (mode === 'wave') {
                            this.player.waveVelocity = 0;
                        } else if (mode === 'ship') {
                            this.player.shipVelocity = 0;
                        }
                    }
                    continue;
                }
            } else if (obstacle.type === 'jump-pad') {
                // Jump pad collision detection for wave/ship modes
                if (this.checkHitboxCollision(playerHitbox, {
                    x: obstacle.x,
                    y: obstacle.y,
                    width: obstacle.width,
                    height: obstacle.height
                })) {
                    const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

                    if (mode === 'wave') {
                        // Boost wave's vertical velocity
                        this.player.waveVelocity = -this.player.jumpPower * 0.8; // Slightly reduced for wave mode
                    } else if (mode === 'ship') {
                        // Boost ship's vertical velocity
                        this.player.shipVelocity = -this.player.jumpPower * 0.8; // Slightly reduced for ship mode
                    }

                    this.playSound('jump');

                    // Add visual particles
                    for (let i = 0; i < 10; i++) {
                        this.particles.push({
                            x: obstacle.x + obstacle.width / 2 + (Math.random() - 0.5) * obstacle.width,
                            y: obstacle.y,
                            vx: (Math.random() - 0.5) * 8,
                            vy: -Math.random() * 8 - 2,
                            life: 30,
                            color: '#00ff00'
                        });
                    }
                    continue;
                }
            }
            // Check for spike collision (triangular)
            else if (obstacle.type === 'spike' || obstacle.type === 'spike-up') {
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
        // Auto-play logic
        if (this.autoPlay) {
            this.handleAutoPlay();
        }

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
            case 'spider':
                this.handleSpiderMovement();
                break;
            default:
                this.player.velocity += this.player.gravity * this.deltaTime * this.gameSpeedMultiplier;
                this.player.y += this.player.velocity * this.deltaTime * this.gameSpeedMultiplier;
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
            // Save context for rotation
            this.ctx.save();

            const shipCenterY = this.player.y + this.player.height / 2;
            const shipCenterX = this.player.x + this.player.width / 2;
            // Extend the ship width to make it longer
            const shipWidth = this.player.width * 1.4;

            // Calculate rotation based on ship velocity (tilts up when going up, down when going down)
            const maxTiltAngle = Math.PI / 6; // 30 degrees max tilt
            const maxVelocity = 300; // Normalize velocity
            const tiltAngle = Math.max(-maxTiltAngle, Math.min(maxTiltAngle,
                -(this.player.shipVelocity / maxVelocity) * maxTiltAngle));

            // Translate to ship center, rotate, then translate back
            this.ctx.translate(shipCenterX, shipCenterY);
            this.ctx.rotate(tiltAngle);
            this.ctx.translate(-shipCenterX, -shipCenterY);

            // Main ship body (rounded submarine/rocket shape with gentler curves)
            this.ctx.beginPath();
            // Start from back-left
            this.ctx.moveTo(this.player.x, shipCenterY);
            // Top curve (gentler - only goes up to 0.25 instead of 0.15)
            this.ctx.quadraticCurveTo(
                this.player.x + shipWidth * 0.4,
                this.player.y + this.player.height * 0.25,
                this.player.x + shipWidth * 0.9,
                this.player.y + this.player.height * 0.35
            );
            // Nose point
            this.ctx.lineTo(this.player.x + shipWidth, shipCenterY);
            // Bottom curve (gentler - only goes down to 0.75 instead of 0.85)
            this.ctx.quadraticCurveTo(
                this.player.x + shipWidth * 0.9,
                this.player.y + this.player.height * 0.65,
                this.player.x + shipWidth * 0.4,
                this.player.y + this.player.height * 0.75
            );
            this.ctx.lineTo(this.player.x, shipCenterY);
            this.ctx.closePath();
            this.ctx.fill();

            // Main body outline
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Top fin
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x + shipWidth * 0.25, this.player.y + this.player.height * 0.3);
            this.ctx.lineTo(this.player.x + shipWidth * 0.32, this.player.y + this.player.height * 0.05);
            this.ctx.lineTo(this.player.x + shipWidth * 0.45, this.player.y + this.player.height * 0.3);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Bottom fin
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x + shipWidth * 0.25, this.player.y + this.player.height * 0.7);
            this.ctx.lineTo(this.player.x + shipWidth * 0.32, this.player.y + this.player.height * 0.95);
            this.ctx.lineTo(this.player.x + shipWidth * 0.45, this.player.y + this.player.height * 0.7);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Three portholes
            const portholeY = shipCenterY;
            const portholeRadius = this.player.width * 0.08;

            for (let i = 0; i < 3; i++) {
                this.ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
                this.ctx.beginPath();
                this.ctx.arc(
                    this.player.x + shipWidth * (0.45 + i * 0.12),
                    portholeY,
                    portholeRadius,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }

            // Engine thruster line at back
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x + shipWidth * 0.05, shipCenterY - this.player.height * 0.15);
            this.ctx.lineTo(this.player.x + shipWidth * 0.05, shipCenterY + this.player.height * 0.15);
            this.ctx.stroke();

            // Restore context after rotation
            this.ctx.restore();
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
        } else if (mode === 'spider') {
            // Spider mode - draw robotic spider icon with flash effect
            this.ctx.save();

            // Flash effect when switching gravity
            if (this.player.gravityFlash > 0) {
                this.ctx.globalAlpha = 0.5 + (this.player.gravityFlash * 0.5);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(this.player.x - 10, this.player.y - 10, this.player.width + 20, this.player.height + 20);
                this.ctx.globalAlpha = 1;
            }

            const spiderCenterX = this.player.x + this.player.width / 2;
            const spiderCenterY = this.player.y + this.player.height / 2;

            // Flip spider upside down when gravity is inverted (walking on ceiling)
            if (this.player.gravityDirection < 0) {
                this.ctx.translate(spiderCenterX, spiderCenterY);
                this.ctx.scale(1, -1);
                this.ctx.translate(-spiderCenterX, -spiderCenterY);
            }

            // Main body - trapezoid/rectangular shape
            this.ctx.fillStyle = this.player.color;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x + this.player.width * 0.15, this.player.y + this.player.height * 0.2);
            this.ctx.lineTo(this.player.x + this.player.width * 0.55, this.player.y);
            this.ctx.lineTo(this.player.x + this.player.width * 0.85, this.player.y + this.player.height * 0.2);
            this.ctx.lineTo(this.player.x + this.player.width * 0.85, this.player.y + this.player.height * 0.7);
            this.ctx.lineTo(this.player.x + this.player.width * 0.15, this.player.y + this.player.height * 0.7);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Eye/circle on top right
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + this.player.width * 0.7, this.player.y + this.player.height * 0.3, this.player.width * 0.12, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();

            // Mechanical legs - angular and bent
            this.ctx.strokeStyle = this.player.color;
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            // Front legs (2 legs)
            const frontLegX = this.player.x + this.player.width * 0.7;
            const legStartY = this.player.y + this.player.height * 0.7;

            // Front right leg
            this.ctx.beginPath();
            this.ctx.moveTo(frontLegX, legStartY);
            this.ctx.lineTo(frontLegX + this.player.width * 0.2, legStartY + this.player.height * 0.15);
            this.ctx.lineTo(frontLegX + this.player.width * 0.35, legStartY + this.player.height * 0.35);
            this.ctx.stroke();

            // Front left leg
            this.ctx.beginPath();
            this.ctx.moveTo(frontLegX, legStartY);
            this.ctx.lineTo(frontLegX - this.player.width * 0.2, legStartY + this.player.height * 0.15);
            this.ctx.lineTo(frontLegX - this.player.width * 0.35, legStartY + this.player.height * 0.35);
            this.ctx.stroke();

            // Back legs (2 legs)
            const backLegX = this.player.x + this.player.width * 0.3;

            // Back right leg
            this.ctx.beginPath();
            this.ctx.moveTo(backLegX, legStartY);
            this.ctx.lineTo(backLegX + this.player.width * 0.15, legStartY + this.player.height * 0.2);
            this.ctx.lineTo(backLegX + this.player.width * 0.25, legStartY + this.player.height * 0.4);
            this.ctx.stroke();

            // Back left leg
            this.ctx.beginPath();
            this.ctx.moveTo(backLegX, legStartY);
            this.ctx.lineTo(backLegX - this.player.width * 0.15, legStartY + this.player.height * 0.2);
            this.ctx.lineTo(backLegX - this.player.width * 0.25, legStartY + this.player.height * 0.4);
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

            // Note: We render ALL obstacles so you can see what's coming in other mode sections
            // But collision detection still filters by game mode

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
            } else if (obstacle.type === 'spike-up') {
                this.ctx.fillStyle = '#ff4444';
                this.ctx.beginPath();
                // Upside down spike: point at the bottom
                this.ctx.moveTo(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height);
                this.ctx.lineTo(obstacle.x, obstacle.y);
                this.ctx.lineTo(obstacle.x + obstacle.width, obstacle.y);
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
            } else if (obstacle.type === 'jump-pad') {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                // Draw upward arrow to indicate jump boost
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                const arrowSize = Math.min(obstacle.width, obstacle.height) * 0.3;

                // Arrow body
                this.ctx.fillRect(centerX - arrowSize * 0.2, centerY - arrowSize * 0.5, arrowSize * 0.4, arrowSize);

                // Arrow head
                this.ctx.moveTo(centerX, centerY - arrowSize * 0.7);
                this.ctx.lineTo(centerX - arrowSize * 0.5, centerY - arrowSize * 0.1);
                this.ctx.lineTo(centerX + arrowSize * 0.5, centerY - arrowSize * 0.1);
                this.ctx.closePath();
                this.ctx.fill();
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
                ball: '#ff00ff',
                spider: '#00ffff'
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

        for (let portal of this.speedPortals || []) {
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

    drawFinishPortals() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        for (let portal of this.finishPortals || []) {
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

            // Draw finish portal with gold color
            this.ctx.fillStyle = '#FFD700';
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

            this.ctx.strokeStyle = '#FFA500';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 1;
            this.ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);

            // Draw finish text
            this.ctx.fillStyle = 'black';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('FINISH',
                portal.x + portal.width/2,
                portal.y + portal.height/2 + 4
            );

            // Restore rotation if applied
            if (portal.rotation && portal.rotation !== 0) {
                this.ctx.restore();
            }

            // Add glow effect
            const time = Date.now() * 0.003;
            this.ctx.globalAlpha = 0.2 + Math.sin(time + portal.x * 0.01) * 0.2;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(portal.x - 3, portal.y - 3, portal.width + 6, portal.height + 6);
        }

        this.ctx.restore();
    }

    drawCheckpoints() {
        if (!this.practiceMode || this.checkpoints.length === 0) return;

        this.ctx.save();
        this.ctx.translate(-this.camera.x, 0);

        for (let i = 0; i < this.checkpoints.length; i++) {
            const checkpoint = this.checkpoints[i];

            // Only draw checkpoints that are visible on screen
            if (checkpoint.x < this.camera.x - 100 ||
                checkpoint.x > this.camera.x + this.canvas.width + 100) {
                continue;
            }

            const size = 15;
            const x = checkpoint.x - size / 2;
            const y = checkpoint.y - size / 2;

            // Draw checkpoint marker with animated glow
            const time = Date.now() * 0.005;
            const glowIntensity = 0.7 + Math.sin(time + i * 0.5) * 0.3;

            // Glow effect
            this.ctx.globalAlpha = glowIntensity * 0.4;
            this.ctx.fillStyle = '#00ffff';
            this.ctx.fillRect(x - 3, y - 3, size + 6, size + 6);

            // Main checkpoint body
            this.ctx.globalAlpha = 1;
            this.ctx.fillStyle = '#00cccc';
            this.ctx.fillRect(x, y, size, size);

            // Inner highlight
            this.ctx.fillStyle = '#00ffff';
            this.ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

            // Border
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, size, size);

            // Draw number for multiple checkpoints
            if (this.checkpoints.length > 1) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText((i + 1).toString(), x + size/2, y + size/2 + 3);
            }

            // Mark the last checkpoint (active one) with special indicator
            if (this.lastCheckpoint === checkpoint) {
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
            }
        }

        this.ctx.restore();
    }

    checkLevelCompletion() {
        // For custom levels with finish portals, check for finish portal collision
        if (this.isCustomLevel && this.finishPortals && this.finishPortals.length > 0) {
            const playerHitbox = this.getPlayerHitbox();

            for (let portal of this.finishPortals) {
                if (playerHitbox.x < portal.x + portal.width &&
                    playerHitbox.x + playerHitbox.width > portal.x &&
                    playerHitbox.y < portal.y + portal.height &&
                    playerHitbox.y + playerHitbox.height > portal.y) {
                    this.levelComplete();
                    return;
                }
            }
        } else {
            // For regular levels or custom levels without finish portals, use distance
            const levelLength = this.getLevelLength();
            if (this.player.x >= levelLength) {
                this.levelComplete();
            }
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
        // Record completion for leaderboard (if not in auto-play mode)
        if (!this.autoPlay && this.leaderboard.enabled) {
            const completionTime = Date.now() - this.levelStartTime;
            this.recordCompletion(
                this.currentLevel,
                this.currentGameMode,
                this.attempts,
                completionTime,
                this.score
            );
        }

        if (this.autoPlay) {
            // Auto-progress to next level
            if (this.currentLevel < this.maxLevel) {
                this.currentLevel++;
                document.getElementById('levelSelect').value = this.currentLevel;
                document.getElementById('currentLevel').textContent = this.currentLevel;
                setTimeout(() => {
                    this.restartGame();
                }, 1000);
            } else {
                // Completed all levels, restart from level 1
                this.currentLevel = 1;
                document.getElementById('levelSelect').value = 1;
                document.getElementById('currentLevel').textContent = 1;
                setTimeout(() => {
                    this.restartGame();
                }, 1000);
            }
            return;
        }

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

        // Handle continuous jumping for cube mode when holding space or mouse
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;
        if (mode === 'cube') {
            const currentTime = Date.now();
            const isJumpKeyPressed = this.keys['Space'] || this.keys['ArrowUp'] || this.mousePressed;

            if (isJumpKeyPressed && currentTime - this.jumpSpamTimer > this.jumpSpamInterval) {
                this.jump();
                this.jumpSpamTimer = currentTime;
            }
        }

        // For wave mode, horizontal movement is handled in handleWaveMovement
        if (mode !== 'wave') {
            this.player.x += this.speed * this.gameSpeedMultiplier * this.deltaTime;
        }
        this.score = Math.floor(this.player.x / 10);

        this.updatePlayer();
        this.updateCamera();
        this.updateParticles();
        this.checkCollisions();
        this.checkPortalCollisions();
        this.checkLevelCompletion();

        document.getElementById('score').textContent = this.score;

        // Update section tracking for analytics
        this.updateSectionTracking();
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

            if (obstacle.type === 'spike' || obstacle.type === 'spike-up') {
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
        this.drawFinishPortals();
        this.drawCheckpoints();
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

    toggleAutoPlay() {
        this.autoPlay = !this.autoPlay;
        const autoPlayBtn = document.getElementById('autoPlayBtn');
        autoPlayBtn.textContent = this.autoPlay ? 'Stop Auto Play' : 'Auto Play';

        if (this.autoPlay) {
            this.startGame();
        }
    }

    togglePracticeMode() {
        this.practiceMode = !this.practiceMode;
        const practiceBtn = document.getElementById('practiceBtn');
        practiceBtn.textContent = this.practiceMode ? 'Exit Practice' : 'Practice Mode';

        // Clear checkpoints when exiting practice mode
        if (!this.practiceMode) {
            this.checkpoints = [];
            this.lastCheckpoint = null;
        }

        this.updateInstructions();
        this.updateBackToEditorButton();
    }

    updateBackToEditorButton() {
        const backBtn = document.getElementById('backToEditorBtn');
        if (this.isCustomLevel && !['developer', 'impossible'].includes(this.currentLevel)) {
            // Show button for user-created custom levels, but not for built-in special levels
            backBtn.style.display = 'inline-block';
        } else {
            backBtn.style.display = 'none';
        }
    }

    returnToEditor() {
        if (this.isCustomLevel && this.customLevelData) {
            // Store the current level data in localStorage so the editor can load it
            localStorage.setItem('editorLevelData', JSON.stringify(this.customLevelData));
            localStorage.setItem('returnedFromTest', 'true');

            // Navigate back to the level editor
            window.location.href = 'level-editor.html';
        }
    }

    placeCheckpoint() {
        if (!this.practiceMode || this.gameState !== 'playing') return;

        const checkpoint = {
            x: this.player.x,
            y: this.player.y,
            cameraX: this.camera.x,
            velocity: this.player.velocity,
            currentGameMode: this.currentGameMode,
            gravityDirection: this.player.gravityDirection,
            attempts: this.attempts,
            score: this.score,
            // Save portal states
            portalStates: this.portals.map(portal => ({ used: portal.used || false })),
            speedPortalStates: this.speedPortals.map(portal => ({ used: portal.used || false })),
            finishPortalStates: this.finishPortals.map(portal => ({ used: portal.used || false }))
        };

        this.checkpoints.push(checkpoint);
        this.lastCheckpoint = checkpoint;

        // Play sound effect
        this.playSound('jump');

        console.log('Checkpoint placed at x:', checkpoint.x);
    }

    deleteCheckpoint() {
        if (!this.practiceMode || this.checkpoints.length === 0) return;

        // Remove the most recent checkpoint
        this.checkpoints.pop();
        this.lastCheckpoint = this.checkpoints.length > 0 ? this.checkpoints[this.checkpoints.length - 1] : null;

        // Play sound effect
        this.playSound('death');

        console.log('Checkpoint deleted. Remaining checkpoints:', this.checkpoints.length);
    }

    respawnAtCheckpoint() {
        if (!this.practiceMode || !this.lastCheckpoint) return false;

        // Restore player state from checkpoint
        this.player.x = this.lastCheckpoint.x;
        this.player.y = this.lastCheckpoint.y;
        this.player.velocity = this.lastCheckpoint.velocity;
        this.player.gravityDirection = this.lastCheckpoint.gravityDirection;
        this.currentGameMode = this.lastCheckpoint.currentGameMode;
        this.camera.x = this.lastCheckpoint.cameraX;
        this.attempts = this.lastCheckpoint.attempts;
        this.score = this.lastCheckpoint.score;

        // Reset other player states
        this.player.onGround = false;
        this.player.waveVelocity = 0;
        this.player.waveHorizontalVelocity = 0;
        this.player.shipVelocity = 0;
        this.player.ballVelocity = 0;
        this.player.rotation = 0;
        this.player.canChangeGravity = true;

        // Clear wave trail
        this.player.trail = [];
        this.player.persistentWaveTrail = [];

        // Restore portal states
        if (this.lastCheckpoint.portalStates) {
            for (let i = 0; i < this.portals.length && i < this.lastCheckpoint.portalStates.length; i++) {
                this.portals[i].used = this.lastCheckpoint.portalStates[i].used;
            }
        }
        if (this.lastCheckpoint.speedPortalStates) {
            for (let i = 0; i < this.speedPortals.length && i < this.lastCheckpoint.speedPortalStates.length; i++) {
                this.speedPortals[i].used = this.lastCheckpoint.speedPortalStates[i].used;
            }
        }
        if (this.lastCheckpoint.finishPortalStates) {
            for (let i = 0; i < this.finishPortals.length && i < this.lastCheckpoint.finishPortalStates.length; i++) {
                this.finishPortals[i].used = this.lastCheckpoint.finishPortalStates[i].used;
            }
        }

        // Update UI
        document.getElementById('score').textContent = this.score;
        document.getElementById('attempts').textContent = this.attempts;

        console.log('Respawned at checkpoint x:', this.lastCheckpoint.x);
        return true;
    }

    handleAutoPlay() {
        const mode = this.gameMode === 'mixed' ? this.currentGameMode : this.gameMode;

        // Dynamic look-ahead based on speed and mode
        let lookAheadDistance = 300; // Base look ahead
        if (mode === 'wave' || mode === 'ship') {
            lookAheadDistance = 400; // More look ahead for flying modes
        }
        lookAheadDistance *= this.speedMultiplier; // Scale with game speed

        const playerCenterX = this.player.x + this.player.width / 2;
        const playerCenterY = this.player.y + this.player.height / 2;
        const playerBottom = this.player.y + this.player.height;

        // Find all obstacles in extended range and sort by distance
        let obstaclesInRange = [];
        let immediateObstacles = [];
        let futureObstacles = [];

        for (let obstacle of this.obstacles) {
            const distance = obstacle.x - playerCenterX;
            if (distance > -100 && distance < lookAheadDistance) {
                const obstacleData = { obstacle, distance };
                obstaclesInRange.push(obstacleData);

                // Categorize obstacles by urgency
                if (distance < 150) {
                    immediateObstacles.push(obstacleData);
                } else {
                    futureObstacles.push(obstacleData);
                }
            }
        }

        obstaclesInRange.sort((a, b) => a.distance - b.distance);
        immediateObstacles.sort((a, b) => a.distance - b.distance);
        futureObstacles.sort((a, b) => a.distance - b.distance);

        // Ground collision check for cube mode
        if (mode === 'cube') {
            if (playerBottom >= this.canvas.height - 50) {
                this.player.y = this.canvas.height - 50 - this.player.height;
                this.player.velocity = 0;
                this.player.onGround = true;
            }
        }

        if (obstaclesInRange.length > 0) {
            switch (mode) {
                case 'cube':
                    // Precise cube jumping with optimal timing
                    let shouldJump = false;
                    let optimalDistance = 0;

                    // Only consider the closest dangerous obstacle
                    if (immediateObstacles.length > 0) {
                        const nextObstacle = immediateObstacles[0].obstacle;
                        const obstacleDistance = immediateObstacles[0].distance;

                        // Only jump for obstacles that actually require jumping
                        if (nextObstacle.type === 'spike' || nextObstacle.type === 'spike-up' || nextObstacle.type === 'platform' ||
                            nextObstacle.type === 'slope-up' || nextObstacle.type === 'slope-down' ||
                            nextObstacle.type === 'steep-up' || nextObstacle.type === 'steep-down') {

                            // Calculate jump timing based on obstacle type and distance
                            const obstacleId = `${nextObstacle.x}-${nextObstacle.y}-${nextObstacle.type}`;
                            const alreadyJumpedForThisObstacle = this.lastJumpedObstacle === obstacleId;

                            if (!alreadyJumpedForThisObstacle && this.player.onGround) {
                                // More forgiving jump ranges for better survival
                                let jumpRange = { min: 60, max: 120 };

                                if (nextObstacle.type === 'spike' || nextObstacle.type === 'spike-up') {
                                    jumpRange = { min: 70, max: 110 }; // Closer for spikes
                                } else if (nextObstacle.type === 'platform') {
                                    jumpRange = { min: 80, max: 130 }; // Earlier for platforms
                                } else {
                                    jumpRange = { min: 75, max: 120 }; // Default for slopes
                                }

                                // Jump if within the safe range
                                if (obstacleDistance >= jumpRange.min &&
                                    obstacleDistance <= jumpRange.max &&
                                    this.canJumpNow()) {
                                    shouldJump = true;
                                    this.lastJumpedObstacle = obstacleId;
                                }
                                // Emergency jump - more aggressive
                                else if (obstacleDistance < 60 && this.canJumpNow()) {
                                    shouldJump = true;
                                    this.lastJumpedObstacle = obstacleId;
                                }
                            }
                        }
                    }

                    if (shouldJump) {
                        this.jump();
                        this.lastJumpTime = Date.now();
                    }

                    // Clear obstacle tracking if we've passed all immediate obstacles
                    if (immediateObstacles.length === 0) {
                        this.lastJumpedObstacle = null;
                    }
                    break;

                case 'wave':
                    // Advanced wave navigation with predictive path planning
                    let needsDodging = false;
                    let shouldGoUp = false;
                    let urgencyLevel = 0; // 0=safe, 1=plan, 2=react, 3=emergency

                    // Priority 1: Avoid ceiling and floor boundaries (more forgiving)
                    if (playerCenterY < 50) {
                        shouldGoUp = false;
                        needsDodging = true;
                        urgencyLevel = 3;
                    } else if (playerCenterY > this.canvas.height - 100) {
                        shouldGoUp = true;
                        needsDodging = true;
                        urgencyLevel = 3;
                    }

                    // Priority 2: React to immediate obstacles
                    if (!needsDodging && immediateObstacles.length > 0) {
                        const immediateObstacle = immediateObstacles[0].obstacle;
                        const immediateDistance = immediateObstacles[0].distance;
                        const obstacleBottom = immediateObstacle.y + immediateObstacle.height;
                        const obstacleTop = immediateObstacle.y;
                        const safeMargin = 35; // Reduced margin for more aggressive dodging

                        if (immediateDistance < 120) { // Increased reaction distance
                            if (playerCenterY > obstacleBottom + safeMargin) {
                                shouldGoUp = true;
                                needsDodging = true;
                                urgencyLevel = 2;
                            } else if (playerCenterY < obstacleTop - safeMargin) {
                                shouldGoUp = false;
                                needsDodging = true;
                                urgencyLevel = 2;
                            }
                            // Emergency gap threading
                            else if (playerCenterY >= obstacleTop - safeMargin &&
                                     playerCenterY <= obstacleBottom + safeMargin) {
                                const topSpace = obstacleTop - 60;
                                const bottomSpace = (this.canvas.height - 60) - obstacleBottom;

                                if (topSpace > bottomSpace + 30) {
                                    shouldGoUp = true;
                                    needsDodging = true;
                                    urgencyLevel = 2;
                                } else if (bottomSpace > topSpace + 30) {
                                    shouldGoUp = false;
                                    needsDodging = true;
                                    urgencyLevel = 2;
                                }
                            }
                        }
                    }

                    // Priority 3: Plan for future obstacles (predictive movement)
                    if (!needsDodging && futureObstacles.length > 0) {
                        const futureObstacle = futureObstacles[0].obstacle;
                        const futureDistance = futureObstacles[0].distance;

                        if (futureDistance < 300) {
                            const futureBottom = futureObstacle.y + futureObstacle.height;
                            const futureTop = futureObstacle.y;
                            const predictMargin = 60;

                            // Predict where we need to be and start moving early
                            const currentTrajectory = this.player.waveVelocity;
                            const timeToObstacle = futureDistance / (this.speed + Math.abs(this.player.waveHorizontalVelocity));
                            const predictedY = playerCenterY + (currentTrajectory * timeToObstacle);

                            if (predictedY > futureBottom + predictMargin) {
                                shouldGoUp = true;
                                needsDodging = true;
                                urgencyLevel = 1;
                            } else if (predictedY < futureTop - predictMargin) {
                                shouldGoUp = false;
                                needsDodging = true;
                                urgencyLevel = 1;
                            }
                        }
                    }

                    // Execute movement with precision timing
                    if (needsDodging) {
                        const newDirection = shouldGoUp ? 'up' : 'down';
                        const isEmergency = urgencyLevel >= 3;

                        // Emergency override - ignore cooldown for critical situations
                        if (this.currentWaveDirection !== newDirection &&
                            (this.canWaveActionNow() || isEmergency)) {
                            this.keys['Space'] = shouldGoUp;
                            this.currentWaveDirection = newDirection;
                            this.lastWaveAction = Date.now();
                        }
                        // Only maintain direction during dodging if we're not changing direction
                        else if (this.currentWaveDirection === newDirection) {
                            this.keys['Space'] = shouldGoUp;
                        }
                    } else {
                        // Safe positioning - only act when really necessary
                        const targetY = this.canvas.height * 0.5;
                        const tolerance = 60; // Large tolerance to minimize actions

                        // Only act if we're far from center AND it's been a while since last action
                        if (Math.abs(playerCenterY - targetY) > tolerance && this.canWaveActionNow()) {
                            const shouldGoUp = playerCenterY > targetY;
                            const newDirection = shouldGoUp ? 'up' : 'down';

                            // Only change if we need a different direction
                            if (this.currentWaveDirection !== newDirection) {
                                this.keys['Space'] = shouldGoUp;
                                this.currentWaveDirection = newDirection;
                                this.lastWaveAction = Date.now();
                            }
                        } else {
                            // Clear any held inputs when no action is needed
                            if (this.keys['Space'] !== undefined) {
                                delete this.keys['Space'];
                            }
                            this.currentWaveDirection = null;
                        }
                    }
                    break;

                case 'ship':
                    // Enhanced ship navigation with look-ahead
                    let shipNeedsDodging = false;
                    let shipShouldGoUp = false;

                    // Boundary avoidance
                    if (playerCenterY < 70) {
                        shipShouldGoUp = false;
                        shipNeedsDodging = true;
                    } else if (playerCenterY > this.canvas.height - 120) {
                        shipShouldGoUp = true;
                        shipNeedsDodging = true;
                    }

                    // Immediate obstacle handling
                    if (!shipNeedsDodging && immediateObstacles.length > 0) {
                        const shipObstacle = immediateObstacles[0].obstacle;
                        const shipDistance = immediateObstacles[0].distance;
                        const shipObstacleBottom = shipObstacle.y + shipObstacle.height;
                        const shipObstacleTop = shipObstacle.y;
                        const shipSafeMargin = 50;

                        if (shipDistance < 120) {
                            if (playerCenterY > shipObstacleBottom + shipSafeMargin) {
                                shipShouldGoUp = true;
                                shipNeedsDodging = true;
                            } else if (playerCenterY < shipObstacleTop - shipSafeMargin) {
                                shipShouldGoUp = false;
                                shipNeedsDodging = true;
                            } else {
                                const topSpace = shipObstacleTop - 60;
                                const bottomSpace = (this.canvas.height - 60) - shipObstacleBottom;
                                if (Math.abs(topSpace - bottomSpace) > 40) {
                                    shipShouldGoUp = topSpace > bottomSpace;
                                    shipNeedsDodging = true;
                                }
                            }
                        }
                    }

                    // Future planning for ship
                    if (!shipNeedsDodging && futureObstacles.length > 0) {
                        const futureShipObstacle = futureObstacles[0].obstacle;
                        const futureShipDistance = futureObstacles[0].distance;

                        if (futureShipDistance < 250) {
                            const futureShipBottom = futureShipObstacle.y + futureShipObstacle.height;
                            const futureShipTop = futureShipObstacle.y;

                            // Predict trajectory and adjust early
                            const shipTrajectory = this.player.shipVelocity;
                            const timeToShipObstacle = futureShipDistance / this.speed;
                            const predictedShipY = playerCenterY + (shipTrajectory * timeToShipObstacle);

                            if (predictedShipY > futureShipBottom + 50) {
                                shipShouldGoUp = true;
                                shipNeedsDodging = true;
                            } else if (predictedShipY < futureShipTop - 50) {
                                shipShouldGoUp = false;
                                shipNeedsDodging = true;
                            }
                        }
                    }

                    // Execute ship movement with precision
                    if (shipNeedsDodging && this.canShipActionNow()) {
                        this.keys['Space'] = shipShouldGoUp;
                        this.lastShipAction = Date.now();
                    } else if (!shipNeedsDodging) {
                        // Maintain safe center position with reduced sensitivity
                        const shipTargetY = this.canvas.height * 0.6;
                        const shipTolerance = 40; // Increased tolerance

                        if (Math.abs(playerCenterY - shipTargetY) > shipTolerance && this.canShipActionNow()) {
                            this.keys['Space'] = playerCenterY > shipTargetY;
                            this.lastShipAction = Date.now();
                        } else if (Math.abs(playerCenterY - shipTargetY) <= shipTolerance) {
                            // Clear input when in safe zone
                            if (this.keys['Space'] !== undefined) {
                                delete this.keys['Space'];
                            }
                        }
                    }
                    break;
            }
        } else {
            // No immediate obstacles - maintain safe positioning
            switch (mode) {
                case 'cube':
                    // Stay on ground when safe
                    if (!this.player.onGround && this.player.y > this.canvas.height - 150) {
                        // Don't jump unnecessarily
                    }
                    break;

                case 'wave':
                    // Safe positioning when no obstacles - very minimal adjustments
                    const waveTargetY = this.canvas.height * 0.5;
                    const waveTolerance = 80; // Much larger tolerance when safe

                    if (Math.abs(playerCenterY - waveTargetY) > waveTolerance && this.canWaveActionNow()) {
                        const shouldGoUp = playerCenterY > waveTargetY;
                        const newWaveDirection = shouldGoUp ? 'up' : 'down';
                        if (this.currentWaveDirection !== newWaveDirection) {
                            this.keys['Space'] = shouldGoUp;
                            this.currentWaveDirection = newWaveDirection;
                            this.lastWaveAction = Date.now();
                        }
                    } else if (Math.abs(playerCenterY - waveTargetY) <= waveTolerance) {
                        // Clear input when in very safe zone
                        if (this.keys['Space'] !== undefined) {
                            delete this.keys['Space'];
                        }
                        this.currentWaveDirection = null;
                    }
                    break;

                case 'ship':
                    // Stay in middle-lower area when safe with precision
                    const shipTargetY = this.canvas.height * 0.6;
                    const shipSafeTolerance = 35;

                    if (Math.abs(playerCenterY - shipTargetY) > shipSafeTolerance && this.canShipActionNow()) {
                        this.keys['Space'] = playerCenterY > shipTargetY;
                        this.lastShipAction = Date.now();
                    }
                    break;
            }
        }
    }

    // Precision timing functions to prevent spam
    canJumpNow() {
        const jumpCooldown = 150; // 150ms between jumps - more responsive but still controlled
        return Date.now() - this.lastJumpTime > jumpCooldown;
    }

    canWaveActionNow() {
        const waveActionCooldown = 150; // 150ms between wave direction changes - prevent spam
        return Date.now() - this.lastWaveAction > waveActionCooldown;
    }

    canShipActionNow() {
        const shipActionCooldown = 150; // 150ms between ship direction changes
        return Date.now() - this.lastShipAction > shipActionCooldown;
    }

    gameOver() {
        // Track the failure for analytics
        this.trackFailure(
            this.player.x + this.camera.x,
            this.player.y,
            this.currentGameMode,
            'collision'
        );

        if (this.autoPlay) {
            // Auto-restart if auto-play is enabled
            setTimeout(() => {
                this.restartGame();
            }, 500);
            return;
        }

        // In practice mode, try to respawn at checkpoint instead of game over
        if (this.practiceMode && this.respawnAtCheckpoint()) {
            this.gameState = 'playing';
            return;
        }

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

    setupCanvas() {
        // Set canvas size based on screen size - more aggressive mobile sizing
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;

        let maxWidth, maxHeight;

        if (isMobile) {
            // Mobile: use almost full screen width and more height
            maxWidth = Math.min(800, window.innerWidth * 0.98);
            maxHeight = Math.min(400, window.innerHeight * 0.6); // Increased from 0.4 to 0.6
        } else if (isTablet) {
            // Tablet: moderate sizing
            maxWidth = Math.min(800, window.innerWidth * 0.9);
            maxHeight = Math.min(400, window.innerHeight * 0.5);
        } else {
            // Desktop: keep original sizing
            maxWidth = 800;
            maxHeight = 400;
        }

        // Maintain aspect ratio
        const aspectRatio = 800 / 400;
        let canvasWidth = maxWidth;
        let canvasHeight = maxWidth / aspectRatio;

        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = maxHeight * aspectRatio;
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        // Set CSS size to match canvas size
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
    }

    // === SMART HELP SYSTEM - ANALYTICS METHODS ===

    loadAnalyticsData() {
        try {
            const stored = localStorage.getItem('geometryDash_analytics');
            if (stored) {
                const data = JSON.parse(stored);
                this.failureAnalytics.sessionData = { ...this.failureAnalytics.sessionData, ...data.sessionData };
                this.failureAnalytics.patterns = { ...this.failureAnalytics.patterns, ...data.patterns };
            }
        } catch (e) {
            console.log('Could not load analytics data:', e);
        }
    }

    saveAnalyticsData() {
        try {
            const dataToSave = {
                sessionData: this.failureAnalytics.sessionData,
                patterns: this.failureAnalytics.patterns,
                lastSaved: Date.now()
            };
            localStorage.setItem('geometryDash_analytics', JSON.stringify(dataToSave));
        } catch (e) {
            console.log('Could not save analytics data:', e);
        }
    }

    trackFailure(x, y, gameMode, reason = 'collision') {
        if (!this.failureAnalytics.enabled) return;

        const failure = {
            timestamp: Date.now(),
            level: this.currentLevel,
            gameMode: gameMode,
            position: { x, y },
            reason: reason,
            attempts: this.attempts,
            timeInSection: this.sectionTracker.entryTime ? Date.now() - this.sectionTracker.entryTime : 0,
            playerVelocity: {
                x: this.speed,
                y: this.player.velocity || this.player.waveVelocity || this.player.shipVelocity || this.player.ballVelocity
            }
        };

        // Update session data
        this.failureAnalytics.sessionData.totalDeaths++;
        this.failureAnalytics.sessionData.lastFailureTime = failure.timestamp;

        // Track level-specific deaths
        const levelKey = `${this.currentLevel}_${gameMode}`;
        if (!this.failureAnalytics.sessionData.levelDeaths[levelKey]) {
            this.failureAnalytics.sessionData.levelDeaths[levelKey] = [];
        }
        this.failureAnalytics.sessionData.levelDeaths[levelKey].push(failure);

        // Add to failure hotspots
        this.failureAnalytics.sessionData.failureHotspots.push(failure);

        // Keep only last 100 failures to prevent storage bloat
        if (this.failureAnalytics.sessionData.failureHotspots.length > 100) {
            this.failureAnalytics.sessionData.failureHotspots.shift();
        }

        // Analyze failure pattern
        this.analyzeFailurePattern(failure);

        // Generate suggestions
        this.generateFailureSuggestion(failure);

        // Save data
        this.saveAnalyticsData();
    }

    analyzeFailurePattern(failure) {
        const recentFailures = this.getRecentFailures(failure.position, 50); // Within 50px

        if (recentFailures.length >= 3) {
            // Multiple failures in same spot - analyze pattern
            const avgTimeInSection = recentFailures.reduce((sum, f) => sum + f.timeInSection, 0) / recentFailures.length;

            if (avgTimeInSection < 1000) {
                this.failureAnalytics.patterns.earlyJump++;
            } else if (avgTimeInSection > 3000) {
                this.failureAnalytics.patterns.lateReaction++;
            }

            // Check for mode transition issues
            const modeChanges = recentFailures.filter(f => f.gameMode !== this.currentGameMode);
            if (modeChanges.length > 0) {
                this.failureAnalytics.patterns.wrongModeTransition++;
            }

            // Check for gravity confusion in ball mode
            if (failure.gameMode === 'ball' && Math.abs(failure.playerVelocity.y) > 5) {
                this.failureAnalytics.patterns.gravityConfusion++;
            }
        }
    }

    getRecentFailures(position, radius) {
        return this.failureAnalytics.sessionData.failureHotspots.filter(failure => {
            const distance = Math.sqrt(
                Math.pow(failure.position.x - position.x, 2) +
                Math.pow(failure.position.y - position.y, 2)
            );
            return distance <= radius && failure.level === this.currentLevel;
        });
    }

    generateFailureSuggestion(failure) {
        // Tips disabled
        return;
    }

    getDominantFailurePattern() {
        const patterns = this.failureAnalytics.patterns;
        let maxPattern = 'general';
        let maxCount = 0;

        for (const [pattern, count] of Object.entries(patterns)) {
            if (count > maxCount) {
                maxCount = count;
                maxPattern = pattern;
            }
        }

        return maxPattern;
    }

    showSmartSuggestion(suggestion) {
        // Create suggestion UI element
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'smart-suggestion';
        suggestionDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00ff88;
            border-radius: 10px;
            padding: 15px;
            max-width: 300px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 1250;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
            animation: slideInRight 0.5s ease-out;
        `;

        suggestionDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #00ff88;">${suggestion.title}</h4>
            <p style="margin: 0 0 15px 0; line-height: 1.4;">${suggestion.message}</p>
            <div style="display: flex; gap: 10px;">
                <button class="suggestion-action" style="
                    background: #00ff88;
                    color: #1a1a2e;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">${suggestion.action}</button>
                <button class="suggestion-close" style="
                    background: transparent;
                    color: #00ff88;
                    border: 1px solid #00ff88;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Dismiss</button>
            </div>
        `;

        document.body.appendChild(suggestionDiv);

        // Add CSS animation
        if (!document.getElementById('suggestion-animations')) {
            const style = document.createElement('style');
            style.id = 'suggestion-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // Event listeners
        suggestionDiv.querySelector('.suggestion-action').onclick = () => {
            this.handleSuggestionAction(suggestion);
            document.body.removeChild(suggestionDiv);
        };

        suggestionDiv.querySelector('.suggestion-close').onclick = () => {
            document.body.removeChild(suggestionDiv);
        };

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            if (document.body.contains(suggestionDiv)) {
                document.body.removeChild(suggestionDiv);
            }
        }, 8000);
    }

    handleSuggestionAction(suggestion) {
        switch (suggestion.type) {
            case 'timing':
                // Show timing visualization overlay
                this.showTimingGuide();
                break;
            case 'reaction':
            case 'general':
                // Enable practice mode
                if (!this.practiceMode) {
                    document.getElementById('practiceBtn').click();
                }
                break;
            case 'mode':
                // Show help menu with mode focus
                this.showHelpMenu();
                break;
            case 'gravity':
                // Could show ball mode demo in future
                this.showHelpMenu();
                break;
        }
    }

    showTimingGuide() {
        // Simple timing indicator overlay
        const guide = document.createElement('div');
        guide.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 255, 136, 0.9);
            color: #1a1a2e;
            padding: 20px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 1260;
            text-align: center;
        `;
        guide.innerHTML = `
            <h3>⏱️ Timing Guide</h3>
            <p>Watch for the rhythm!</p>
            <p>Jump when obstacles are <strong>2-3 grid spaces</strong> away</p>
            <button onclick="this.parentElement.remove()" style="
                background: #1a1a2e;
                color: #00ff88;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 10px;
            ">Got it!</button>
        `;
        document.body.appendChild(guide);
    }

    updateSectionTracking() {
        const currentPos = this.player.x + this.camera.x;
        const sectionSize = 100; // Track every 100px sections
        const currentSection = Math.floor(currentPos / sectionSize);

        if (currentSection !== this.sectionTracker.currentSection) {
            // Entering new section
            this.sectionTracker.currentSection = currentSection;
            this.sectionTracker.entryTime = Date.now();
            this.sectionTracker.lastPosition = currentPos;
        }
    }

    updateAnalyticsDashboard() {
        // Update total deaths
        const totalDeathsEl = document.getElementById('totalDeaths');
        if (totalDeathsEl) {
            totalDeathsEl.textContent = this.failureAnalytics.sessionData.totalDeaths;
        }

        // Update dominant pattern
        const dominantPatternEl = document.getElementById('dominantPattern');
        if (dominantPatternEl) {
            const pattern = this.getDominantFailurePattern();
            const patternNames = {
                earlyJump: 'Jumping too early',
                lateReaction: 'Slow reactions',
                wrongModeTransition: 'Mode confusion',
                gravityConfusion: 'Gravity timing',
                timingIssues: 'Timing problems',
                general: 'General gameplay'
            };
            dominantPatternEl.textContent = patternNames[pattern] || 'Getting started...';
        }

        // Update current level deaths
        const currentLevelDeathsEl = document.getElementById('currentLevelDeaths');
        if (currentLevelDeathsEl) {
            const levelKey = `${this.currentLevel}_${this.currentGameMode}`;
            const levelDeaths = this.failureAnalytics.sessionData.levelDeaths[levelKey] || [];
            currentLevelDeathsEl.textContent = levelDeaths.length;
        }

        // Update suggestions count
        const suggestionsCountEl = document.getElementById('suggestionsCount');
        if (suggestionsCountEl) {
            suggestionsCountEl.textContent = this.failureAnalytics.suggestions.length;
        }

        // Update hotspots list
        this.updateHotspotsList();
    }

    updateHotspotsList() {
        const hotspotsListEl = document.getElementById('hotspotsList');
        if (!hotspotsListEl) return;

        const hotspots = this.getFailureHotspots();

        if (hotspots.length === 0) {
            hotspotsListEl.innerHTML = '<p class="no-data">Play the game to see your failure analysis!</p>';
            return;
        }

        hotspotsListEl.innerHTML = hotspots.map(hotspot => `
            <div class="hotspot-item">
                <span class="hotspot-location">Level ${hotspot.level} - Position ${Math.round(hotspot.avgPosition)}</span>
                <span class="hotspot-count">${hotspot.count} deaths</span>
                <div style="clear: both; font-size: 0.8rem; margin-top: 5px; color: #ccc;">
                    ${hotspot.mode} mode • Avg time: ${(hotspot.avgTime / 1000).toFixed(1)}s
                </div>
            </div>
        `).join('');
    }

    getFailureHotspots() {
        const hotspots = {};
        const threshold = 2; // Minimum deaths to be considered a hotspot

        this.failureAnalytics.sessionData.failureHotspots.forEach(failure => {
            const key = `${failure.level}_${Math.floor(failure.position.x / 100)}`; // Group by 100px sections

            if (!hotspots[key]) {
                hotspots[key] = {
                    level: failure.level,
                    mode: failure.gameMode,
                    positions: [],
                    times: [],
                    count: 0
                };
            }

            hotspots[key].positions.push(failure.position.x);
            hotspots[key].times.push(failure.timeInSection);
            hotspots[key].count++;
        });

        return Object.values(hotspots)
            .filter(hotspot => hotspot.count >= threshold)
            .map(hotspot => ({
                ...hotspot,
                avgPosition: hotspot.positions.reduce((a, b) => a + b, 0) / hotspot.positions.length,
                avgTime: hotspot.times.reduce((a, b) => a + b, 0) / hotspot.times.length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5 hotspots
    }

    resetAnalytics() {
        this.failureAnalytics = {
            enabled: true,
            sessionData: {
                totalDeaths: 0,
                levelDeaths: {},
                failureHotspots: [],
                timeSpentOnSections: {},
                inputPatterns: [],
                lastFailureTime: null
            },
            patterns: {
                earlyJump: 0,
                lateReaction: 0,
                wrongModeTransition: 0,
                timingIssues: 0,
                gravityConfusion: 0
            },
            suggestions: [],
            lastSuggestionTime: 0,
            suggestionCooldown: 10000
        };

        localStorage.removeItem('geometryDash_analytics');
        this.updateAnalyticsDashboard();

        // Show confirmation
        const confirmation = document.createElement('div');
        confirmation.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #00ff88;
            color: #1a1a2e;
            padding: 20px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 1310;
            text-align: center;
        `;
        confirmation.innerHTML = '✅ Analytics data has been reset!';
        document.body.appendChild(confirmation);

        setTimeout(() => {
            if (document.body.contains(confirmation)) {
                document.body.removeChild(confirmation);
            }
        }, 2000);
    }

    exportAnalytics() {
        const data = {
            exportDate: new Date().toISOString(),
            sessionData: this.failureAnalytics.sessionData,
            patterns: this.failureAnalytics.patterns,
            suggestions: this.failureAnalytics.suggestions,
            hotspots: this.getFailureHotspots()
        };

        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `geometry_dash_analytics_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // === TUTORIAL SYSTEM ===

    loadTutorialProgress() {
        try {
            const progress = localStorage.getItem('geometryDash_tutorialProgress');
            return progress ? JSON.parse(progress) : {};
        } catch (e) {
            return {};
        }
    }

    saveTutorialProgress() {
        try {
            localStorage.setItem('geometryDash_tutorialProgress', JSON.stringify(this.tutorialSystem.completed));
        } catch (e) {
            console.log('Could not save tutorial progress:', e);
        }
    }

    startTutorial(tutorialType = 'basic') {
        this.tutorialSystem.active = true;
        this.tutorialSystem.currentStep = 0;
        this.tutorialSystem.steps = this.getTutorialSteps(tutorialType);

        // Pause the game
        if (this.gameState === 'playing') {
            this.tutorialSystem.paused = true;
            this.gameState = 'paused';
        }

        this.showTutorialOverlay();
        this.updateTutorialStep();
    }

    getTutorialSteps(type) {
        const tutorials = {
            basic: [
                {
                    title: "Welcome to Geometry Dash! 🎮",
                    text: "This interactive tutorial will teach you the basics of the game. Let's start with the fundamentals!",
                    highlight: null,
                    visual: "🎯 Goal: Navigate through obstacles without crashing!",
                    position: "center"
                },
                {
                    title: "Basic Controls 🎮",
                    text: "Use SPACEBAR, UP ARROW, or CLICK to jump. Try it now!",
                    highlight: "#gameCanvas",
                    visual: {
                        type: "keys",
                        keys: ["SPACE", "↑", "CLICK"]
                    },
                    position: "right",
                    action: "waitForJump"
                },
                {
                    title: "Game Modes 🔄",
                    text: "Geometry Dash has different game modes. Let's see the mode selector!",
                    highlight: "#gameMode",
                    visual: "Different modes change how your character moves",
                    position: "left"
                },
                {
                    title: "Practice Mode 🎯",
                    text: "Use Practice Mode to place checkpoints and learn difficult sections without starting over.",
                    highlight: "#practiceBtn",
                    visual: "💡 Perfect for learning new levels!",
                    position: "bottom"
                },
                {
                    title: "Help & Analytics 📊",
                    text: "Use the Help button to access guides and see your progress analytics!",
                    highlight: "#helpBtn",
                    visual: "📈 Track your improvement over time",
                    position: "bottom"
                }
            ],
            modes: [
                {
                    title: "Cube Mode 🔷",
                    text: "The basic mode. Click to jump and land on platforms. Avoid spikes!",
                    gameMode: "cube",
                    visual: "🔷 Jump with precise timing"
                },
                {
                    title: "Ship Mode 🚀",
                    text: "Hold to fly up, release to fall down. Navigate through tight spaces!",
                    gameMode: "ship",
                    visual: "🚀 Smooth flying controls"
                },
                {
                    title: "Wave Mode 🌊",
                    text: "Hold to move up, release to move down. Flow through wave-like paths!",
                    gameMode: "wave",
                    visual: "🌊 Fluid wave movement"
                },
                {
                    title: "Ball Mode ⚽",
                    text: "Click to flip gravity. Bounce between surfaces with perfect timing!",
                    gameMode: "ball",
                    visual: "⚽ Gravity-defying bounces"
                }
            ]
        };

        return tutorials[type] || tutorials.basic;
    }

    showTutorialOverlay() {
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.pointerEvents = 'all';
            this.setupTutorialListeners();
        }
    }

    hideTutorialOverlay() {
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.style.pointerEvents = 'none';
        }

        // Hide any active highlights
        const highlight = document.getElementById('tutorialHighlight');
        if (highlight) {
            highlight.style.display = 'none';
        }

        // Resume game if it was paused
        if (this.tutorialSystem.paused) {
            this.gameState = 'playing';
            this.tutorialSystem.paused = false;
        }

        this.tutorialSystem.active = false;
    }

    setupTutorialListeners() {
        if (this.tutorialListenersAttached) return;

        const nextBtn = document.getElementById('tutorialNextBtn');
        const prevBtn = document.getElementById('tutorialPrevBtn');
        const skipBtn = document.getElementById('tutorialSkipBtn');
        const closeBtn = document.getElementById('closeTutorialBtn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextTutorialStep());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevTutorialStep());
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipTutorial());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.skipTutorial());
        }

        this.tutorialListenersAttached = true;
    }

    updateTutorialStep() {
        const step = this.tutorialSystem.steps[this.tutorialSystem.currentStep];
        if (!step) return;

        // Update progress
        const progress = ((this.tutorialSystem.currentStep + 1) / this.tutorialSystem.steps.length) * 100;
        const progressFill = document.getElementById('tutorialProgress');
        const progressText = document.getElementById('progressText');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) {
            progressText.textContent = `Step ${this.tutorialSystem.currentStep + 1} of ${this.tutorialSystem.steps.length}`;
        }

        // Update content
        const title = document.getElementById('tutorialTitle');
        const text = document.getElementById('tutorialText');
        const visual = document.getElementById('tutorialVisual');

        if (title) title.textContent = step.title;
        if (text) text.textContent = step.text;

        // Update visual
        if (visual) {
            if (typeof step.visual === 'string') {
                visual.innerHTML = step.visual;
                visual.className = 'tutorial-visual';
            } else if (step.visual && step.visual.type === 'keys') {
                visual.className = 'tutorial-visual demo-keys';
                visual.innerHTML = step.visual.keys.map(key =>
                    `<div class="demo-key">${key}</div>`
                ).join('');
            }
        }

        // Update highlight
        this.updateTutorialHighlight(step.highlight);

        // Update card position
        const card = document.getElementById('tutorialCard');
        if (card) {
            card.className = 'tutorial-card';
            if (step.position) {
                card.classList.add(step.position);
            }
        }

        // Update button states
        const nextBtn = document.getElementById('tutorialNextBtn');
        const prevBtn = document.getElementById('tutorialPrevBtn');

        if (prevBtn) {
            prevBtn.disabled = this.tutorialSystem.currentStep === 0;
        }

        if (nextBtn) {
            if (this.tutorialSystem.currentStep === this.tutorialSystem.steps.length - 1) {
                nextBtn.textContent = 'Finish';
            } else {
                nextBtn.textContent = 'Next';
            }
        }

        // Handle special actions
        if (step.action) {
            this.handleTutorialAction(step.action);
        }
    }

    updateTutorialHighlight(selector) {
        const highlight = document.getElementById('tutorialHighlight');
        if (!highlight) return;

        if (!selector) {
            highlight.style.display = 'none';
            return;
        }

        const element = document.querySelector(selector);
        if (!element) {
            highlight.style.display = 'none';
            return;
        }

        const rect = element.getBoundingClientRect();

        // Position relative to the viewport (fixed positioning)
        highlight.style.display = 'block';
        highlight.style.position = 'fixed';
        highlight.style.left = `${rect.left - 10}px`;
        highlight.style.top = `${rect.top - 10}px`;
        highlight.style.width = `${rect.width + 20}px`;
        highlight.style.height = `${rect.height + 20}px`;
        highlight.style.zIndex = '1150'; // Above overlay but below tutorial card
    }

    handleTutorialAction(action) {
        switch (action) {
            case 'waitForJump':
                // Listen for jump input to advance
                const originalJump = this.jump.bind(this);
                this.jump = () => {
                    originalJump();
                    this.nextTutorialStep();
                    this.jump = originalJump; // Restore original
                };
                break;
        }
    }

    nextTutorialStep() {
        if (this.tutorialSystem.currentStep < this.tutorialSystem.steps.length - 1) {
            this.tutorialSystem.currentStep++;
            this.updateTutorialStep();
        } else {
            this.completeTutorial();
        }
    }

    prevTutorialStep() {
        if (this.tutorialSystem.currentStep > 0) {
            this.tutorialSystem.currentStep--;
            this.updateTutorialStep();
        }
    }

    skipTutorial() {
        this.hideTutorialOverlay();
    }

    completeTutorial() {
        const tutorialType = 'basic'; // Could be dynamic
        this.tutorialSystem.completed[tutorialType] = true;
        this.saveTutorialProgress();

        // Show completion message
        const completion = document.createElement('div');
        completion.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #00ff88, #00cc6a);
            color: #1a1a2e;
            padding: 30px;
            border-radius: 15px;
            font-weight: bold;
            z-index: 1400;
            text-align: center;
            box-shadow: 0 0 30px rgba(0, 255, 136, 0.5);
        `;
        completion.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">🎉 Tutorial Complete!</h3>
            <p style="margin: 0;">You're ready to play Geometry Dash!</p>
        `;
        document.body.appendChild(completion);

        setTimeout(() => {
            if (document.body.contains(completion)) {
                document.body.removeChild(completion);
            }
        }, 3000);

        this.hideTutorialOverlay();
    }

    // === LEADERBOARD SYSTEM ===

    loadPlayerName() {
        try {
            const stored = localStorage.getItem('geometryDash_playerName');
            return stored || null;
        } catch (e) {
            return null;
        }
    }

    savePlayerName(name) {
        try {
            localStorage.setItem('geometryDash_playerName', name);
            this.leaderboard.currentPlayer = name;
        } catch (e) {
            console.log('Could not save player name:', e);
        }
    }

    loadLeaderboardData() {
        try {
            const stored = localStorage.getItem('geometryDash_leaderboard');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    saveLeaderboardData() {
        try {
            localStorage.setItem('geometryDash_leaderboard', JSON.stringify(this.leaderboard.scores));
        } catch (e) {
            console.log('Could not save leaderboard data:', e);
        }
    }

    promptPlayerName() {
        if (this.leaderboard.currentPlayer) {
            return this.leaderboard.currentPlayer;
        }

        // Create name input modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1500;
        `;

        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border: 2px solid #00ff88;
                border-radius: 15px;
                padding: 30px;
                text-align: center;
                color: white;
                max-width: 400px;
                width: 90%;
            ">
                <h3 style="color: #00ff88; margin-bottom: 20px;">🏆 Join the Leaderboard!</h3>
                <p style="margin-bottom: 20px;">Enter your name to track your achievements:</p>
                <input type="text" id="playerNameInput" placeholder="Enter your name..." style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #00ff88;
                    border-radius: 8px;
                    background: rgba(0, 255, 136, 0.1);
                    color: white;
                    font-size: 1rem;
                    margin-bottom: 20px;
                    text-align: center;
                " maxlength="20">
                <div>
                    <button id="saveNameBtn" style="
                        background: linear-gradient(45deg, #00ff88, #00cc6a);
                        color: #1a1a2e;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        margin-right: 10px;
                    ">Save Name</button>
                    <button id="skipNameBtn" style="
                        background: transparent;
                        color: #888;
                        border: 1px solid #666;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Skip</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            const input = modal.querySelector('#playerNameInput');
            const saveBtn = modal.querySelector('#saveNameBtn');
            const skipBtn = modal.querySelector('#skipNameBtn');

            const handleSave = () => {
                const name = input.value.trim();
                if (name && name.length >= 2) {
                    this.savePlayerName(name);
                    document.body.removeChild(modal);
                    resolve(name);
                } else {
                    input.style.borderColor = '#ff4444';
                    input.placeholder = 'Name must be at least 2 characters';
                }
            };

            const handleSkip = () => {
                document.body.removeChild(modal);
                resolve('Anonymous');
            };

            saveBtn.addEventListener('click', handleSave);
            skipBtn.addEventListener('click', handleSkip);

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleSave();
                }
            });

            // Focus input
            setTimeout(() => input.focus(), 100);
        });
    }

    async recordCompletion(level, gameMode, attempts, timeElapsed, score) {
        const playerName = this.leaderboard.currentPlayer || await this.promptPlayerName();

        const completion = {
            playerName: playerName,
            level: level,
            gameMode: gameMode,
            attempts: attempts,
            timeElapsed: timeElapsed,
            score: score,
            timestamp: Date.now(),
            date: new Date().toLocaleDateString(),
            difficulty: this.getLevelDifficulty(level)
        };

        // Check if this is a personal best
        const existingRecord = this.leaderboard.scores.find(record =>
            record.playerName === playerName &&
            record.level === level &&
            record.gameMode === gameMode
        );

        const isPersonalBest = !existingRecord ||
            attempts < existingRecord.attempts ||
            (attempts === existingRecord.attempts && timeElapsed < existingRecord.timeElapsed);

        if (isPersonalBest) {
            // Remove old record if it exists
            if (existingRecord) {
                const index = this.leaderboard.scores.indexOf(existingRecord);
                this.leaderboard.scores.splice(index, 1);
            }

            // Add new record
            this.leaderboard.scores.push(completion);
            this.saveLeaderboardData();

            // Show personal best notification
            this.showPersonalBestNotification(completion, !existingRecord);
        }

        return isPersonalBest;
    }

    getLevelDifficulty(level) {
        const difficulties = {
            1: 'Easy',
            2: 'Medium',
            3: 'Hard',
            4: 'Expert',
            5: 'Insane',
            'developer': 'Expert+',
            'impossible': 'Nightmare'
        };
        return difficulties[level] || 'Unknown';
    }

    showPersonalBestNotification(completion, isFirstCompletion) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b35, #f7931e);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 0 25px rgba(255, 107, 53, 0.4);
            z-index: 1600;
            max-width: 300px;
            animation: slideInBounce 0.6s ease-out;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 1.5rem; margin-right: 10px;">🏆</span>
                <strong>${isFirstCompletion ? 'First Completion!' : 'Personal Best!'}</strong>
            </div>
            <div style="font-size: 0.9rem; opacity: 0.9;">
                <div>${completion.playerName}</div>
                <div>Level ${completion.level} - ${completion.gameMode}</div>
                <div>${completion.attempts} attempts in ${(completion.timeElapsed / 1000).toFixed(1)}s</div>
            </div>
        `;

        document.body.appendChild(notification);

        // Add bounce animation
        if (!document.getElementById('leaderboard-animations')) {
            const style = document.createElement('style');
            style.id = 'leaderboard-animations';
            style.textContent = `
                @keyframes slideInBounce {
                    0% { transform: translateX(100%) scale(0.8); opacity: 0; }
                    60% { transform: translateX(-10px) scale(1.05); opacity: 1; }
                    100% { transform: translateX(0) scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.animation = 'slideOut 0.3s ease-in forwards';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
    }

    getLeaderboardData(sortBy = 'score', filterLevel = null, filterMode = null) {
        let filtered = [...this.leaderboard.scores];

        // Apply filters
        if (filterLevel) {
            filtered = filtered.filter(record => record.level.toString() === filterLevel.toString());
        }

        if (filterMode && filterMode !== 'all') {
            filtered = filtered.filter(record => record.gameMode === filterMode);
        }

        // Sort the data
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'attempts':
                    return a.attempts - b.attempts;
                case 'time':
                    return a.timeElapsed - b.timeElapsed;
                case 'date':
                    return b.timestamp - a.timestamp;
                case 'score':
                default:
                    if (a.score !== b.score) return b.score - a.score;
                    if (a.attempts !== b.attempts) return a.attempts - b.attempts;
                    return a.timeElapsed - b.timeElapsed;
            }
        });

        return filtered;
    }

    updateLeaderboard() {
        const content = document.getElementById('leaderboardContent');
        if (!content) return;

        const levelFilter = document.getElementById('leaderboardLevel')?.value || null;
        const modeFilter = document.getElementById('leaderboardMode')?.value || null;
        const sortBy = document.getElementById('leaderboardSort')?.value || 'score';

        const data = this.getLeaderboardData(sortBy, levelFilter, modeFilter);

        if (data.length === 0) {
            content.innerHTML = `
                <div class="no-scores">
                    <p>🎮 ${levelFilter || modeFilter ? 'No scores for these filters' : 'Complete some levels to see your scores'}!</p>
                </div>
            `;
            return;
        }

        const table = document.createElement('table');
        table.className = 'leaderboard-table';

        table.innerHTML = `
            <thead>
                <tr>
                    <th class="leaderboard-rank">#</th>
                    <th>Player</th>
                    <th>Level</th>
                    <th>Mode</th>
                    <th>Score</th>
                    <th>Attempts</th>
                    <th>Time</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                ${data.map((record, index) => {
                    const rank = index + 1;
                    let rankClass = '';
                    if (rank === 1) rankClass = 'gold';
                    else if (rank === 2) rankClass = 'silver';
                    else if (rank === 3) rankClass = 'bronze';

                    return `
                        <tr>
                            <td class="leaderboard-rank ${rankClass}">${rank}</td>
                            <td class="leaderboard-name">${record.playerName}</td>
                            <td class="leaderboard-level">Level ${record.level}</td>
                            <td><span class="leaderboard-mode">${record.gameMode}</span></td>
                            <td class="leaderboard-score">${record.score}</td>
                            <td class="leaderboard-attempts">${record.attempts}</td>
                            <td class="leaderboard-time">${(record.timeElapsed / 1000).toFixed(1)}s</td>
                            <td>${record.date}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;

        content.innerHTML = '';
        content.appendChild(table);
    }

    setupLeaderboardListeners() {
        if (this.leaderboardListenersAttached) return;

        // Filter change listeners
        const levelFilter = document.getElementById('leaderboardLevel');
        const modeFilter = document.getElementById('leaderboardMode');
        const sortFilter = document.getElementById('leaderboardSort');

        if (levelFilter) {
            levelFilter.addEventListener('change', () => this.updateLeaderboard());
        }

        if (modeFilter) {
            modeFilter.addEventListener('change', () => this.updateLeaderboard());
        }

        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.updateLeaderboard());
        }

        // Action button listeners
        const changeNameBtn = document.getElementById('changeNameBtn');
        const clearBtn = document.getElementById('clearLeaderboardBtn');

        if (changeNameBtn) {
            changeNameBtn.addEventListener('click', () => {
                this.leaderboard.currentPlayer = null;
                this.promptPlayerName().then(() => {
                    this.updateLeaderboard();
                });
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all leaderboard data? This cannot be undone!')) {
                    this.leaderboard.scores = [];
                    this.saveLeaderboardData();
                    this.updateLeaderboard();

                    const confirmation = document.createElement('div');
                    confirmation.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: #ff6666;
                        color: white;
                        padding: 20px;
                        border-radius: 10px;
                        font-weight: bold;
                        z-index: 1700;
                        text-align: center;
                    `;
                    confirmation.innerHTML = '🗑️ Leaderboard data cleared!';
                    document.body.appendChild(confirmation);

                    setTimeout(() => {
                        if (document.body.contains(confirmation)) {
                            document.body.removeChild(confirmation);
                        }
                    }, 2000);
                }
            });
        }

        this.leaderboardListenersAttached = true;
    }

    // === CUSTOM LEVEL UPLOAD SYSTEM ===

    loadLevelProjects() {
        try {
            const stored = localStorage.getItem('geometryDash_levelProjects');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.log('Could not load level projects:', e);
            return {};
        }
    }

    saveLevelProjects() {
        try {
            localStorage.setItem('geometryDash_levelProjects', JSON.stringify(this.levelProjects.projects));
        } catch (e) {
            console.log('Could not save level projects:', e);
        }
    }

    createNewProject(projectName) {
        if (this.levelProjects.projects[projectName]) {
            throw new Error('A project with this name already exists');
        }

        const newProject = {
            name: projectName,
            metadata: {
                author: this.leaderboard.currentPlayer || 'Unknown',
                description: '',
                difficulty: 'Medium',
                dateCreated: Date.now(),
                lastModified: Date.now(),
                playCount: 0,
                bestScore: 0,
                rating: 0
            },
            data: {
                objects: [],
                portals: [],
                finishPortal: null,
                gameMode: 'mixed'
            }
        };

        this.levelProjects.projects[projectName] = newProject;
        this.levelProjects.currentProject = newProject;
        this.levelProjects.currentProjectName = projectName;
        this.saveLevelProjects();

        return newProject;
    }

    saveCurrentProject() {
        if (!this.levelProjects.currentProject || !this.levelProjects.currentProjectName) {
            throw new Error('No project is currently loaded');
        }

        // Update the last modified time
        this.levelProjects.currentProject.metadata.lastModified = Date.now();

        // Save the current project data
        this.levelProjects.projects[this.levelProjects.currentProjectName] = this.levelProjects.currentProject;
        this.saveLevelProjects();
    }

    loadProject(projectName) {
        if (!this.levelProjects.projects[projectName]) {
            throw new Error('Project not found');
        }

        this.levelProjects.currentProject = this.levelProjects.projects[projectName];
        this.levelProjects.currentProjectName = projectName;

        return this.levelProjects.currentProject;
    }

    deleteProject(projectName) {
        if (!this.levelProjects.projects[projectName]) {
            throw new Error('Project not found');
        }

        delete this.levelProjects.projects[projectName];

        // If this was the current project, clear it
        if (this.levelProjects.currentProjectName === projectName) {
            this.levelProjects.currentProject = null;
            this.levelProjects.currentProjectName = null;
        }

        this.saveLevelProjects();
    }

    getProjectList() {
        return Object.keys(this.levelProjects.projects).map(name => ({
            name: name,
            metadata: this.levelProjects.projects[name].metadata
        })).sort((a, b) => b.metadata.lastModified - a.metadata.lastModified);
    }

    renameProject(oldName, newName) {
        if (!this.levelProjects.projects[oldName]) {
            throw new Error('Project not found');
        }

        if (this.levelProjects.projects[newName]) {
            throw new Error('A project with the new name already exists');
        }

        // Copy the project data
        this.levelProjects.projects[newName] = this.levelProjects.projects[oldName];
        this.levelProjects.projects[newName].name = newName;

        // Delete the old entry
        delete this.levelProjects.projects[oldName];

        // Update current project reference if necessary
        if (this.levelProjects.currentProjectName === oldName) {
            this.levelProjects.currentProjectName = newName;
        }

        this.saveLevelProjects();
    }

    showLevelUploadModal() {
        const modal = document.createElement('div');
        modal.id = 'levelUploadModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1600;
        `;

        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border: 2px solid #00ff88;
                border-radius: 15px;
                padding: 30px;
                max-width: 600px;
                width: 90%;
                color: white;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="color: #00ff88; margin: 0;">📁 Upload Custom Level</h3>
                    <button id="closeLevelUploadBtn" style="
                        background: #ff4444;
                        color: white;
                        border: none;
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        font-size: 1.2rem;
                        cursor: pointer;
                    ">×</button>
                </div>

                <div class="level-upload-content">
                    <div class="upload-method-selector" style="margin-bottom: 20px;">
                        <h4 style="color: #00ff88; margin-bottom: 15px;">Choose Upload Method:</h4>
                        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                            <button id="fileUploadBtn" class="upload-method-btn active" style="
                                background: linear-gradient(45deg, #00ff88, #00cc6a);
                                color: #1a1a2e;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: bold;
                            ">📁 Upload File</button>
                            <button id="jsonPasteBtn" class="upload-method-btn" style="
                                background: rgba(0, 255, 136, 0.2);
                                color: #00ff88;
                                border: 1px solid #00ff88;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: bold;
                            ">📋 Paste JSON</button>
                        </div>
                    </div>

                    <div id="fileUploadSection" class="upload-section">
                        <div style="
                            border: 2px dashed #00ff88;
                            border-radius: 10px;
                            padding: 40px 20px;
                            text-align: center;
                            margin-bottom: 20px;
                            background: rgba(0, 255, 136, 0.05);
                            cursor: pointer;
                            transition: all 0.3s ease;
                        " id="dropZone">
                            <div style="font-size: 3rem; margin-bottom: 15px;">📁</div>
                            <p style="margin: 0 0 10px 0; font-size: 1.1rem;">Drop your level file here</p>
                            <p style="margin: 0; opacity: 0.7;">or click to browse</p>
                            <input type="file" id="levelFileInput" accept=".json,.txt" style="display: none;">
                        </div>
                    </div>

                    <div id="jsonPasteSection" class="upload-section" style="display: none;">
                        <textarea id="levelJsonInput" placeholder="Paste your level JSON here..." style="
                            width: 100%;
                            height: 200px;
                            background: rgba(0, 255, 136, 0.1);
                            border: 1px solid #00ff88;
                            border-radius: 8px;
                            padding: 15px;
                            color: white;
                            font-family: monospace;
                            font-size: 0.9rem;
                            resize: vertical;
                            margin-bottom: 20px;
                        "></textarea>
                    </div>

                    <div class="project-selector" style="margin-bottom: 20px;">
                        <h4 style="color: #00ff88; margin-bottom: 15px;">Save As Project:</h4>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <input type="text" id="projectNameInput" placeholder="Enter project name..." style="
                                flex: 1;
                                background: rgba(0, 255, 136, 0.1);
                                border: 1px solid #00ff88;
                                border-radius: 6px;
                                padding: 12px;
                                color: white;
                                font-size: 1rem;
                            ">
                            <button id="createProjectBtn" style="
                                background: linear-gradient(45deg, #00ff88, #00cc6a);
                                color: #1a1a2e;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: bold;
                                white-space: nowrap;
                            ">Create New</button>
                        </div>
                        <div style="max-height: 150px; overflow-y: auto; border: 1px solid #444; border-radius: 6px; padding: 10px;">
                            <div id="existingProjectsList">
                                ${this.generateProjectList()}
                            </div>
                        </div>
                    </div>

                    <div class="level-metadata" style="margin-bottom: 20px;">
                        <h4 style="color: #00ff88; margin-bottom: 15px;">Level Information:</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #00ff88;">Level Name:</label>
                                <input type="text" id="levelNameInput" placeholder="Enter level name..." style="
                                    width: 100%;
                                    padding: 10px;
                                    border: 1px solid #00ff88;
                                    border-radius: 6px;
                                    background: rgba(0, 255, 136, 0.1);
                                    color: white;
                                " maxlength="30">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #00ff88;">Author:</label>
                                <input type="text" id="levelAuthorInput" placeholder="Level creator..." style="
                                    width: 100%;
                                    padding: 10px;
                                    border: 1px solid #00ff88;
                                    border-radius: 6px;
                                    background: rgba(0, 255, 136, 0.1);
                                    color: white;
                                " maxlength="20">
                            </div>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; color: #00ff88;">Description (Optional):</label>
                            <textarea id="levelDescriptionInput" placeholder="Describe your level..." style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #00ff88;
                                border-radius: 6px;
                                background: rgba(0, 255, 136, 0.1);
                                color: white;
                                resize: vertical;
                                min-height: 60px;
                                max-height: 120px;
                            " maxlength="200"></textarea>
                        </div>
                    </div>


                    <div class="upload-actions" style="display: flex; gap: 15px; justify-content: center;">
                        <button id="uploadLevelBtn" style="
                            background: linear-gradient(45deg, #00ff88, #00cc6a);
                            color: #1a1a2e;
                            border: none;
                            padding: 15px 30px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                            font-size: 1.1rem;
                            opacity: 0.5;
                        " disabled>Upload Level</button>
                        <button id="cancelUploadBtn" style="
                            background: transparent;
                            color: #888;
                            border: 1px solid #666;
                            padding: 15px 30px;
                            border-radius: 8px;
                            cursor: pointer;
                        ">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupLevelUploadListeners(modal);
    }

    generateProjectList() {
        const projects = this.getProjectList();

        if (projects.length === 0) {
            return '<div style="color: #888; text-align: center; padding: 20px;">No projects yet. Create your first project above!</div>';
        }

        let html = '';
        projects.forEach(project => {
            const lastModified = new Date(project.metadata.lastModified).toLocaleDateString();
            html += `
                <div class="project-item" data-project="${project.name}" style="
                    background: rgba(0, 255, 136, 0.1);
                    border: 1px solid #00ff88;
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='rgba(0, 255, 136, 0.2)'"
                   onmouseout="this.style.background='rgba(0, 255, 136, 0.1)'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: bold; color: #00ff88;">${project.name}</div>
                            <div style="font-size: 0.8rem; color: #aaa;">Modified: ${lastModified}</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="select-project-btn" data-project="${project.name}" style="
                                background: #00ff88;
                                color: #1a1a2e;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 0.8rem;
                                font-weight: bold;
                            ">Select</button>
                            <button class="delete-project-btn" data-project="${project.name}" style="
                                background: #ff4444;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 0.8rem;
                                font-weight: bold;
                            ">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        });

        return html;
    }

    refreshProjectList(modal) {
        const projectsList = modal.querySelector('#existingProjectsList');
        if (projectsList) {
            projectsList.innerHTML = this.generateProjectList();
        }
    }

    selectProject(projectName, modal) {
        try {
            this.loadProject(projectName);

            // Update UI to show selected project
            const projectItems = modal.querySelectorAll('.project-item');
            projectItems.forEach(item => {
                if (item.dataset.project === projectName) {
                    item.style.background = 'rgba(0, 255, 136, 0.3)';
                    item.style.borderColor = '#00ff88';
                } else {
                    item.style.background = 'rgba(0, 255, 136, 0.1)';
                    item.style.borderColor = '#00ff88';
                }
            });

            // Auto-populate level name if not already filled
            const nameInput = modal.querySelector('#levelNameInput');
            if (!nameInput.value.trim()) {
                nameInput.value = projectName;
            }

            this.validateLevelData(modal);
            this.showUploadSuccess(`Project "${projectName}" selected!`, '');
        } catch (error) {
            this.showUploadError(error.message);
        }
    }

    confirmDeleteProject(projectName, modal) {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1700;
        `;

        confirmModal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border: 2px solid #ff4444;
                border-radius: 15px;
                padding: 30px;
                max-width: 400px;
                color: white;
                text-align: center;
            ">
                <h3 style="color: #ff4444; margin: 0 0 15px 0;">⚠️ Delete Project</h3>
                <p style="margin: 0 0 20px 0;">Are you sure you want to delete the project "${projectName}"?</p>
                <p style="margin: 0 0 20px 0; color: #aaa; font-size: 0.9rem;">This action cannot be undone.</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirmDeleteBtn" style="
                        background: #ff4444;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Delete</button>
                    <button id="cancelDeleteBtn" style="
                        background: transparent;
                        color: #888;
                        border: 1px solid #666;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        const confirmBtn = confirmModal.querySelector('#confirmDeleteBtn');
        const cancelBtn = confirmModal.querySelector('#cancelDeleteBtn');

        const closeConfirm = () => {
            document.body.removeChild(confirmModal);
        };

        confirmBtn.addEventListener('click', () => {
            try {
                this.deleteProject(projectName);
                this.refreshProjectList(modal);
                this.validateLevelData(modal);
                closeConfirm();
                this.showUploadSuccess(`Project "${projectName}" deleted.`, '');
            } catch (error) {
                this.showUploadError(error.message);
                closeConfirm();
            }
        });

        cancelBtn.addEventListener('click', closeConfirm);
    }


    setupLevelUploadListeners(modal) {
        const closeBtn = modal.querySelector('#closeLevelUploadBtn');
        const cancelBtn = modal.querySelector('#cancelUploadBtn');
        const fileUploadBtn = modal.querySelector('#fileUploadBtn');
        const jsonPasteBtn = modal.querySelector('#jsonPasteBtn');
        const fileInput = modal.querySelector('#levelFileInput');
        const dropZone = modal.querySelector('#dropZone');
        const uploadBtn = modal.querySelector('#uploadLevelBtn');

        // Close modal handlers
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Upload method switching
        fileUploadBtn.addEventListener('click', () => {
            this.switchUploadMethod('file', modal);
        });

        jsonPasteBtn.addEventListener('click', () => {
            this.switchUploadMethod('json', modal);
        });

        // File upload handlers
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#00cc6a';
            dropZone.style.background = 'rgba(0, 255, 136, 0.1)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#00ff88';
            dropZone.style.background = 'rgba(0, 255, 136, 0.05)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#00ff88';
            dropZone.style.background = 'rgba(0, 255, 136, 0.05)';

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0], modal);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0], modal);
            }
        });

        // Project management
        const createProjectBtn = modal.querySelector('#createProjectBtn');
        const projectNameInput = modal.querySelector('#projectNameInput');

        createProjectBtn.addEventListener('click', () => {
            const projectName = projectNameInput.value.trim();
            if (!projectName) {
                this.showUploadError('Please enter a project name.');
                return;
            }

            try {
                this.createNewProject(projectName);
                this.refreshProjectList(modal);
                projectNameInput.value = '';
                this.validateLevelData(modal);
                this.showUploadSuccess(`Project "${projectName}" created!`, '');
            } catch (error) {
                this.showUploadError(error.message);
            }
        });

        // Project selection and deletion
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-project-btn')) {
                const projectName = e.target.dataset.project;
                this.selectProject(projectName, modal);
            } else if (e.target.classList.contains('delete-project-btn')) {
                const projectName = e.target.dataset.project;
                this.confirmDeleteProject(projectName, modal);
            }
        });

        // JSON input handler
        const jsonInput = modal.querySelector('#levelJsonInput');
        jsonInput.addEventListener('input', () => {
            this.validateLevelData(modal);
        });

        // Upload button
        uploadBtn.addEventListener('click', () => {
            this.processLevelUpload(modal);
        });

        // Input validation
        const nameInput = modal.querySelector('#levelNameInput');
        nameInput.addEventListener('input', () => {
            this.validateLevelData(modal);
        });
    }

    switchUploadMethod(method, modal) {
        const fileBtn = modal.querySelector('#fileUploadBtn');
        const jsonBtn = modal.querySelector('#jsonPasteBtn');
        const fileSection = modal.querySelector('#fileUploadSection');
        const jsonSection = modal.querySelector('#jsonPasteSection');

        if (method === 'file') {
            fileBtn.style.background = 'linear-gradient(45deg, #00ff88, #00cc6a)';
            fileBtn.style.color = '#1a1a2e';
            jsonBtn.style.background = 'rgba(0, 255, 136, 0.2)';
            jsonBtn.style.color = '#00ff88';
            fileSection.style.display = 'block';
            jsonSection.style.display = 'none';
        } else {
            jsonBtn.style.background = 'linear-gradient(45deg, #00ff88, #00cc6a)';
            jsonBtn.style.color = '#1a1a2e';
            fileBtn.style.background = 'rgba(0, 255, 136, 0.2)';
            fileBtn.style.color = '#00ff88';
            fileSection.style.display = 'none';
            jsonSection.style.display = 'block';
        }

        this.validateLevelData(modal);
    }

    handleFileUpload(file, modal) {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const levelData = JSON.parse(content);

                // Populate the JSON textarea with formatted content
                const jsonInput = modal.querySelector('#levelJsonInput');
                jsonInput.value = JSON.stringify(levelData, null, 2);

                // Auto-fill metadata if available
                const nameInput = modal.querySelector('#levelNameInput');
                const authorInput = modal.querySelector('#levelAuthorInput');

                if (levelData.name && !nameInput.value) {
                    nameInput.value = levelData.name;
                }

                if (levelData.author && !authorInput.value) {
                    authorInput.value = levelData.author;
                }

                this.validateLevelData(modal);

            } catch (error) {
                this.showUploadError('Invalid JSON file. Please check the format and try again.');
            }
        };

        reader.onerror = () => {
            this.showUploadError('Failed to read file. Please try again.');
        };

        reader.readAsText(file);
    }

    selectLevelSlot(slotNumber, modal) {
        this.customLevels.currentSlot = slotNumber;

        // Update slot button styling
        const slotButtons = modal.querySelectorAll('.slot-btn');
        slotButtons.forEach(btn => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        });

        const selectedBtn = modal.querySelector(`[data-slot="${slotNumber}"]`);
        selectedBtn.style.transform = 'scale(1.05)';
        selectedBtn.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.5)';

        this.validateLevelData(modal);
    }

    validateLevelData(modal) {
        const jsonInput = modal.querySelector('#levelJsonInput');
        const nameInput = modal.querySelector('#levelNameInput');
        const uploadBtn = modal.querySelector('#uploadLevelBtn');

        let isValid = true;
        let levelData = null;
        let validationErrors = [];

        // Check if project is selected or can be created
        const projectNameInput = modal.querySelector('#projectNameInput');
        const hasSelectedProject = this.levelProjects.currentProjectName;
        const hasNewProjectName = projectNameInput && projectNameInput.value.trim();
        const levelName = nameInput.value.trim();

        // Allow using level name as project name if no project is specified
        if (!hasSelectedProject && !hasNewProjectName && !levelName) {
            isValid = false;
            validationErrors.push('No project selected, new project name, or level name provided');
        }

        // Check if name is provided
        if (!nameInput.value.trim()) {
            isValid = false;
            validationErrors.push('Level name is required');
        }

        // Validate JSON data
        try {
            if (jsonInput.value.trim()) {
                const inputData = jsonInput.value.trim();

                // Try to parse as compressed data first (base64 from level editor)
                try {
                    levelData = this.decompressLevel(inputData);
                } catch (decompressError) {
                    // If decompression fails, try parsing as regular JSON
                    levelData = JSON.parse(inputData);
                }

                // Basic level data validation
                if (!this.isValidLevelData(levelData)) {
                    isValid = false;
                    validationErrors.push('Invalid level data structure');
                }
            } else {
                isValid = false;
                validationErrors.push('JSON data is required');
            }
        } catch (e) {
            isValid = false;
            validationErrors.push('Invalid JSON format: ' + e.message);
        }

        // Debug logging
        console.log('Validation check:', {
            isValid,
            currentProject: this.levelProjects.currentProjectName,
            hasSelectedProject,
            hasNewProjectName,
            newProjectName: projectNameInput?.value,
            levelName: nameInput.value.trim(),
            hasJsonData: !!jsonInput.value.trim(),
            validationErrors
        });

        // Update upload button state
        uploadBtn.disabled = !isValid;
        uploadBtn.style.opacity = isValid ? '1' : '0.5';

        if (!isValid) {
            uploadBtn.title = 'Validation errors: ' + validationErrors.join(', ');
        } else {
            uploadBtn.title = 'Upload level';
        }

        return { isValid, levelData };
    }

    isValidLevelData(data) {
        // Check for required properties
        if (!data || typeof data !== 'object') return false;

        // Level should have sections, obstacles, objects, portals, or template
        // Level editor format uses: objects, portals, speedPortals, finishPortals
        if (!data.sections && !data.obstacles && !data.objects && !data.portals && !data.template) return false;

        // If it has sections, validate structure
        if (data.sections && Array.isArray(data.sections)) {
            for (const section of data.sections) {
                if (!section.x || typeof section.x !== 'number') return false;
                if (!section.length || typeof section.length !== 'number') return false;
            }
        }

        return true;
    }

    processLevelUpload(modal) {
        const validation = this.validateLevelData(modal);

        if (!validation.isValid) {
            this.showUploadError('Please fix validation errors before uploading.');
            return;
        }

        const nameInput = modal.querySelector('#levelNameInput');
        const authorInput = modal.querySelector('#levelAuthorInput');
        const projectNameInput = modal.querySelector('#projectNameInput');

        // Determine project name (either selected project, new project name, or level name)
        let projectName = this.levelProjects.currentProjectName;
        if (!projectName && projectNameInput && projectNameInput.value.trim()) {
            projectName = projectNameInput.value.trim();
        }
        if (!projectName && nameInput.value.trim()) {
            // Use level name as project name if no other name is provided
            projectName = nameInput.value.trim();
        }

        try {
            // Save to customLevels slots for User Levels page only
            // Find an available slot
            let targetSlot = null;
            for (let i = 1; i <= this.customLevels.maxSlots; i++) {
                if (!this.customLevels.slots[i]) {
                    targetSlot = i;
                    break;
                }
            }

            if (!targetSlot) {
                this.showUploadError('No available slots. Maximum 10 custom levels allowed. Please delete a level first.');
                return;
            }

            this.customLevels.slots[targetSlot] = {
                data: validation.levelData,
                metadata: {
                    name: nameInput.value.trim(),
                    description: modal.querySelector('#levelDescriptionInput')?.value.trim() || '',
                    author: authorInput.value.trim() || 'Anonymous',
                    difficulty: this.analyzeLevelDifficulty(validation.levelData),
                    dateAdded: Date.now(),
                    uploadDate: Date.now(),
                    playCount: 0,
                    bestScore: 0,
                    rating: 0
                }
            };
            this.saveCustomLevels();

            // Show success message
            this.showUploadSuccess(nameInput.value.trim(), 'User Levels');

            // Close modal
            document.body.removeChild(modal);

        } catch (error) {
            this.showUploadError(error.message);
        }

        // Refresh User Levels page if it's currently open
        const userLevelsPage = document.getElementById('userLevelsPage');
        if (userLevelsPage && userLevelsPage.style.display === 'block') {
            this.renderUserLevels();
        }
    }

    analyzeLevelDifficulty(levelData) {
        // Simple difficulty analysis based on level content
        let difficulty = 'Easy';

        if (levelData.sections) {
            const totalLength = levelData.sections.reduce((sum, section) => sum + section.length, 0);
            const obstacleCount = levelData.sections.filter(section =>
                section.obstacles && section.obstacles.length > 0
            ).length;

            const density = obstacleCount / Math.max(totalLength / 100, 1);

            if (density > 0.8) difficulty = 'Insane';
            else if (density > 0.6) difficulty = 'Expert';
            else if (density > 0.4) difficulty = 'Hard';
            else if (density > 0.2) difficulty = 'Medium';
        }

        return difficulty;
    }

    showUploadError(message) {
        const error = document.createElement('div');
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff4444, #cc3333);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1700;
            box-shadow: 0 0 20px rgba(255, 68, 68, 0.4);
        `;
        error.innerHTML = `❌ ${message}`;
        document.body.appendChild(error);

        setTimeout(() => {
            if (document.body.contains(error)) {
                document.body.removeChild(error);
            }
        }, 4000);
    }

    showUploadSuccess(levelName, slotNumber) {
        const success = document.createElement('div');
        success.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #00ff88, #00cc6a);
            color: #1a1a2e;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1700;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
            font-weight: bold;
        `;
        success.innerHTML = `✅ "${levelName}" uploaded to Slot ${slotNumber}!`;
        document.body.appendChild(success);

        setTimeout(() => {
            if (document.body.contains(success)) {
                document.body.removeChild(success);
            }
        }, 4000);
    }


    updateLevelSelector() {
        // Disabled - custom levels only show in User Levels page
        return;
    }

    loadProjectLevel(projectName) {
        try {
            const project = this.levelProjects.projects[projectName];
            if (!project || !project.data) {
                this.showUploadError(`Project "${projectName}" not found or has no data`);
                return;
            }

            // Set up custom level state
            this.currentLevel = `project_${projectName}`;
            this.isCustomLevel = true;
            this.customLevelData = project.data;

            // Update UI
            document.getElementById('currentLevel').textContent = project.metadata.name;

            // Generate and restart level
            this.generateLevel();
            this.restartGame();

            console.log(`Loaded project level: ${projectName}`);
        } catch (error) {
            console.error('Error loading project level:', error);
            this.showUploadError(`Failed to load project: ${error.message}`);
        }
    }

    loadUploadedLevel(slotNumber) {
        const slot = this.customLevels.slots[slotNumber];
        if (!slot || !slot.data) {
            this.showUploadError(`No level found in slot ${slotNumber}`);
            return;
        }

        try {
            // Set up custom level state
            this.currentLevel = `custom_${slotNumber}`;
            this.isCustomLevel = true;
            this.customLevelData = slot.data;

            // Update UI
            document.getElementById('currentLevel').textContent = slot.name;

            // Increment play count
            slot.playCount = (slot.playCount || 0) + 1;
            this.saveCustomLevels();

            // Generate the level
            this.generateLevel();

            // Show level info notification
            this.showLevelInfo(slot);

        } catch (error) {
            console.error('Error loading custom level:', error);
            this.showUploadError('Failed to load custom level. The level data may be corrupted.');

            // Reset to default level
            document.getElementById('levelSelect').value = '1';
            this.currentLevel = 1;
            this.isCustomLevel = false;
            this.customLevelData = null;
            this.generateLevel();
            document.getElementById('currentLevel').textContent = '1';
        }
    }

    showLevelInfo(levelSlot) {
        const info = document.createElement('div');
        info.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00ff88;
            border-radius: 12px;
            padding: 20px;
            color: white;
            z-index: 1700;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
            text-align: center;
            max-width: 400px;
        `;

        info.innerHTML = `
            <h4 style="color: #00ff88; margin: 0 0 15px 0;">${levelSlot.name}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div>
                    <strong style="color: #00ff88;">Author:</strong><br>
                    ${levelSlot.author}
                </div>
                <div>
                    <strong style="color: #00ff88;">Difficulty:</strong><br>
                    ${levelSlot.difficulty}
                </div>
                <div>
                    <strong style="color: #00ff88;">Uploaded:</strong><br>
                    ${new Date(levelSlot.uploadDate).toLocaleDateString()}
                </div>
                <div>
                    <strong style="color: #00ff88;">Play Count:</strong><br>
                    ${levelSlot.playCount}
                </div>
            </div>
            <p style="margin: 0; opacity: 0.8; font-size: 0.9rem;">Good luck! 🎮</p>
        `;

        document.body.appendChild(info);

        setTimeout(() => {
            if (document.body.contains(info)) {
                info.style.transition = 'opacity 0.3s ease';
                info.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(info)) {
                        document.body.removeChild(info);
                    }
                }, 300);
            }
        }, 4000);
    }

    restartGame() {
        this.attempts++;
        document.getElementById('attempts').textContent = this.attempts;

        // Record level start time for leaderboard timing
        this.levelStartTime = Date.now();

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

        // Clear checkpoints only if not in practice mode
        if (!this.practiceMode) {
            this.checkpoints = [];
            this.lastCheckpoint = null;
        }

        this.generateLevel();
        this.updateInstructions(); // Update instructions to match reset game mode

        this.gameState = 'playing';
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('pauseBtn').textContent = 'Pause';
    }

    gameLoop(currentTime = 0) {
        // Calculate delta time for frame-independent movement
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
        }
        this.deltaTime = (currentTime - this.lastTime) / (1000 / this.targetFPS);
        this.lastTime = currentTime;

        // Cap delta time to prevent large jumps when tab is unfocused
        this.deltaTime = Math.min(this.deltaTime, 2);

        this.update();
        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    showHelpMenu() {
        console.log('Showing help menu');
        const helpMenu = document.getElementById('helpMenu');
        if (helpMenu) {
            helpMenu.style.display = 'flex';

            // Update analytics dashboard when help menu is shown
            this.updateAnalyticsDashboard();

            // Update leaderboard when help menu is shown
            this.updateLeaderboard();

            // Set up event listeners (only once)
            if (!this.analyticsListenersAttached) {
                const resetBtn = document.getElementById('resetAnalyticsBtn');
                const exportBtn = document.getElementById('exportAnalyticsBtn');

                if (resetBtn) {
                    resetBtn.addEventListener('click', () => {
                        this.resetAnalytics();
                    });
                }

                if (exportBtn) {
                    exportBtn.addEventListener('click', () => {
                        this.exportAnalytics();
                    });
                }

                this.analyticsListenersAttached = true;
            }

            // Set up leaderboard listeners (only once)
            this.setupLeaderboardListeners();

            console.log('Help menu displayed');
        } else {
            console.error('Help menu element not found');
        }
    }

    hideHelpMenu() {
        console.log('Hiding help menu');
        const helpMenu = document.getElementById('helpMenu');
        if (helpMenu) {
            helpMenu.style.display = 'none';
            console.log('Help menu hidden');
        } else {
            console.error('Help menu element not found');
        }
    }

    // User Levels Page Methods
    showUserLevelsPage() {
        console.log('Showing User Levels page');
        const userLevelsPage = document.getElementById('userLevelsPage');
        if (userLevelsPage) {
            userLevelsPage.style.display = 'block';
            this.renderUserLevels();
            this.setupUserLevelsEventListeners();
        } else {
            console.error('User Levels page element not found');
        }
    }

    hideUserLevelsPage() {
        console.log('Hiding User Levels page');
        const userLevelsPage = document.getElementById('userLevelsPage');
        if (userLevelsPage) {
            userLevelsPage.style.display = 'none';
        }
    }

    setupUserLevelsEventListeners() {
        // Back to hub button
        const backToHubBtn = document.getElementById('backToHubBtn');
        if (backToHubBtn) {
            backToHubBtn.replaceWith(backToHubBtn.cloneNode(true));
            const newBackBtn = document.getElementById('backToHubBtn');
            newBackBtn.addEventListener('click', () => {
                this.hideUserLevelsPage();
            });
        }

        // Upload buttons
        const uploadLevelPageBtn = document.getElementById('uploadLevelPageBtn');
        const uploadFirstLevelBtn = document.getElementById('uploadFirstLevelBtn');

        [uploadLevelPageBtn, uploadFirstLevelBtn].forEach(btn => {
            if (btn) {
                btn.replaceWith(btn.cloneNode(true));
                const newBtn = document.getElementById(btn.id);
                newBtn.addEventListener('click', () => {
                    this.showLevelUploadModal();
                });
            }
        });

        // Sort dropdown
        const levelsSortSelect = document.getElementById('levelsSortSelect');
        if (levelsSortSelect) {
            levelsSortSelect.replaceWith(levelsSortSelect.cloneNode(true));
            const newSortSelect = document.getElementById('levelsSortSelect');
            newSortSelect.addEventListener('change', () => {
                this.renderUserLevels();
            });
        }
    }

    renderUserLevels() {
        const levelsGrid = document.getElementById('levelsGrid');
        const emptyState = document.getElementById('emptyLevelsState');

        if (!levelsGrid || !emptyState) return;

        const customLevels = this.getCustomLevelsForDisplay();

        if (customLevels.length === 0) {
            emptyState.style.display = 'block';
            levelsGrid.innerHTML = '';
            levelsGrid.appendChild(emptyState);
            return;
        }

        emptyState.style.display = 'none';

        // Sort levels
        const sortBy = document.getElementById('levelsSortSelect')?.value || 'date';
        customLevels.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return (a.metadata?.name || `Custom Level ${a.slot}`).localeCompare(b.metadata?.name || `Custom Level ${b.slot}`);
                case 'rating':
                    return (b.metadata?.rating || 0) - (a.metadata?.rating || 0);
                case 'difficulty':
                    return (a.metadata?.difficulty || 1) - (b.metadata?.difficulty || 1);
                case 'date':
                default:
                    return new Date(b.metadata?.dateAdded || 0) - new Date(a.metadata?.dateAdded || 0);
            }
        });

        levelsGrid.innerHTML = customLevels.map(level => this.createLevelCard(level)).join('');

        // Add event listeners to level cards
        this.setupLevelCardEventListeners();
    }

    getCustomLevelsForDisplay() {
        const levels = [];
        for (let slot = 1; slot <= this.customLevels.maxSlots; slot++) {
            const levelData = this.customLevels.slots[slot];
            if (levelData) {
                levels.push({
                    slot: slot,
                    data: levelData.data,
                    metadata: levelData.metadata
                });
            }
        }
        return levels;
    }

    createLevelCard(level) {
        const metadata = level.metadata || {};
        const name = metadata.name || `Custom Level ${level.slot}`;
        const description = metadata.description || 'No description provided';
        const author = metadata.author || 'Unknown';
        const difficulty = this.getDifficultyName(metadata.difficulty || 1);
        const rating = metadata.rating || 0;
        const dateAdded = new Date(metadata.dateAdded || Date.now()).toLocaleDateString();
        const playCount = metadata.playCount || 0;
        const bestScore = metadata.bestScore || 0;

        return `
            <div class="level-card" data-slot="${level.slot}">
                <div class="level-card-header">
                    <div class="level-card-title">${this.escapeHtml(name)}</div>
                    <div class="level-card-meta">
                        <span>Slot ${level.slot}</span>
                        <span class="level-difficulty difficulty-${difficulty.toLowerCase()}">${difficulty}</span>
                    </div>
                </div>
                <div class="level-card-body">
                    <div class="level-description">${this.escapeHtml(description)}</div>
                    <div class="level-stats">
                        <div class="level-stat"><strong>Author:</strong> ${this.escapeHtml(author)}</div>
                        <div class="level-stat"><strong>Added:</strong> ${dateAdded}</div>
                        <div class="level-stat"><strong>Plays:</strong> ${playCount}</div>
                        <div class="level-stat"><strong>Best Score:</strong> ${bestScore}</div>
                    </div>
                    <div class="star-rating">
                        <div class="star-rating-display star-rating-interactive" data-slot="${level.slot}">
                            ${this.createStarRating(rating)}
                        </div>
                        <span class="rating-text">${rating.toFixed(1)} / 5.0</span>
                    </div>
                    <div class="level-card-actions">
                        <button class="level-action-btn play-btn" data-action="play" data-slot="${level.slot}">Play</button>
                        <button class="level-action-btn edit-btn" data-action="edit" data-slot="${level.slot}">Edit</button>
                        <button class="level-action-btn duplicate-btn" data-action="duplicate" data-slot="${level.slot}">Copy</button>
                        <button class="level-action-btn delete-btn" data-action="delete" data-slot="${level.slot}">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }

    createStarRating(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            const filled = i <= Math.round(rating) ? 'filled' : '';
            stars += `<span class="star ${filled}" data-rating="${i}">★</span>`;
        }
        return stars;
    }

    getDifficultyName(difficulty) {
        switch (difficulty) {
            case 1: return 'Easy';
            case 2: return 'Medium';
            case 3: return 'Hard';
            case 4: return 'Expert';
            case 5: return 'Insane';
            default: return 'Medium';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupLevelCardEventListeners() {
        // Star rating interactions
        document.querySelectorAll('.star-rating-interactive .star').forEach(star => {
            star.addEventListener('click', (e) => {
                const slot = parseInt(e.target.closest('.star-rating-display').dataset.slot);
                const rating = parseInt(e.target.dataset.rating);
                this.setLevelRating(slot, rating);
            });

            star.addEventListener('mouseenter', (e) => {
                const rating = parseInt(e.target.dataset.rating);
                const stars = e.target.closest('.star-rating-display').querySelectorAll('.star');
                stars.forEach((s, index) => {
                    s.classList.toggle('filled', index < rating);
                });
            });

            star.addEventListener('mouseleave', (e) => {
                const slot = parseInt(e.target.closest('.star-rating-display').dataset.slot);
                const levelData = this.customLevels.slots[slot];
                const currentRating = levelData?.metadata?.rating || 0;
                const stars = e.target.closest('.star-rating-display').querySelectorAll('.star');
                stars.forEach((s, index) => {
                    s.classList.toggle('filled', index < Math.round(currentRating));
                });
            });
        });

        // Level action buttons
        document.querySelectorAll('.level-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const slot = parseInt(e.target.dataset.slot);
                this.handleLevelAction(action, slot);
            });
        });
    }

    setLevelRating(slot, rating) {
        const levelData = this.customLevels.slots[slot];
        if (levelData) {
            levelData.metadata.rating = rating;
            this.saveCustomLevels();

            // Update the rating display
            const ratingText = document.querySelector(`[data-slot="${slot}"] .rating-text`);
            if (ratingText) {
                ratingText.textContent = `${rating.toFixed(1)} / 5.0`;
            }

            console.log(`Set rating for slot ${slot} to ${rating} stars`);
        }
    }

    handleLevelAction(action, slot) {
        switch (action) {
            case 'play':
                this.playCustomLevel(slot);
                break;
            case 'edit':
                this.editCustomLevel(slot);
                break;
            case 'duplicate':
                this.duplicateCustomLevel(slot);
                break;
            case 'delete':
                this.deleteCustomLevel(slot);
                break;
        }
    }

    playCustomLevel(slot) {
        console.log(`Playing custom level from slot ${slot}`);
        this.hideUserLevelsPage();
        this.loadUploadedLevel(slot);
        this.startGame();
    }

    editCustomLevel(slot) {
        console.log(`Editing custom level from slot ${slot}`);
        // Load level into editor
        const levelData = this.customLevels.slots[slot];
        if (levelData) {
            // Store level data and metadata in localStorage for the editor to load
            const editData = {
                ...levelData.data,
                name: levelData.metadata?.name || `Custom Level ${slot}`,
                difficulty: levelData.metadata?.difficulty || 1
            };
            localStorage.setItem('editLevelData', JSON.stringify(editData));

            // Also store the slot number so we can update it when saving
            localStorage.setItem('editLevelSlot', slot.toString());

            // Redirect to the level editor
            window.location.href = 'level-editor.html';
        }
    }

    duplicateCustomLevel(slot) {
        console.log(`Duplicating custom level from slot ${slot}`);
        const sourceLevel = this.customLevels.slots[slot];
        if (!sourceLevel) return;

        // Find next available slot
        let targetSlot = null;
        for (let i = 1; i <= this.customLevels.maxSlots; i++) {
            if (!this.customLevels.slots[i]) {
                targetSlot = i;
                break;
            }
        }

        if (targetSlot) {
            const duplicatedLevel = {
                data: JSON.parse(JSON.stringify(sourceLevel.data)),
                metadata: {
                    ...sourceLevel.metadata,
                    name: (sourceLevel.metadata.name || `Custom Level ${slot}`) + ' (Copy)',
                    dateAdded: Date.now(),
                    playCount: 0,
                    bestScore: 0,
                    rating: 0
                }
            };

            this.customLevels.slots[targetSlot] = duplicatedLevel;
            this.saveCustomLevels();
            this.renderUserLevels();

            alert(`Level duplicated to slot ${targetSlot}!`);
        } else {
            alert('No available slots for duplication. Please delete a level first.');
        }
    }

    deleteCustomLevel(slot) {
        const levelData = this.customLevels.slots[slot];
        if (!levelData) return;

        const levelName = levelData.metadata?.name || `Custom Level ${slot}`;
        if (confirm(`Are you sure you want to delete "${levelName}"? This action cannot be undone.`)) {
            delete this.customLevels.slots[slot];
            this.saveCustomLevels();
            this.updateLevelSelector();
            this.renderUserLevels();
            console.log(`Deleted custom level from slot ${slot}`);
        }
    }

    // Enhanced custom level data structure with ratings
    loadCustomLevels() {
        try {
            const savedLevels = localStorage.getItem('customLevels');
            if (savedLevels) {
                const parsed = JSON.parse(savedLevels);
                // Ensure metadata exists for each level
                Object.keys(parsed).forEach(slot => {
                    if (parsed[slot] && !parsed[slot].metadata) {
                        parsed[slot].metadata = {
                            name: `Custom Level ${slot}`,
                            description: '',
                            author: '',
                            difficulty: 1,
                            dateAdded: Date.now(),
                            playCount: 0,
                            bestScore: 0,
                            rating: 0
                        };
                    }
                });
                return parsed;
            }
        } catch (e) {
            console.error('Error loading custom levels:', e);
        }
        return {};
    }

    saveCustomLevels() {
        try {
            localStorage.setItem('customLevels', JSON.stringify(this.customLevels.slots));
        } catch (e) {
            console.error('Error saving custom levels:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new GeometryDash();

    // Handle window resize
    window.addEventListener('resize', () => {
        game.setupCanvas();
    });

    // Handle orientation change on mobile
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            game.setupCanvas();
        }, 100);
    });
});