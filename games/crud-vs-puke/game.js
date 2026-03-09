// CRUD vs PUKE - PUKE Games
// Tug of war tap battle. Mash SPACE to pull for Team PUKE.
// AI controls Team CRUD. Powerups rain down. Best of 3 rounds.
// Loser gets dragged through the mud pit.

(function() {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // Responsive sizing
    function resize() {
        canvas.width = Math.min(window.innerWidth, 800);
        canvas.height = Math.min(window.innerHeight, 600);
    }
    resize();
    window.addEventListener('resize', resize);

    // Colors
    const C = {
        sky: '#87CEEB',
        skyTop: '#5a9fd4',
        ground: '#6b8e23',
        dirt: '#8b6914',
        mud: '#5c3a1e',
        mudDark: '#3d2510',
        rope: '#d2b48c',
        ropeKnot: '#8b4513',
        marker: '#c0392b',
        puke: '#e87f24',      // PUKE team orange
        crud: '#8b45a0',      // CRUD team purple
        text: '#e87f24',
        textDim: '#8b6914',
        cream: '#fdf5e6',
        brown: '#8b4513',
        dark: '#2a1506',
        green: '#6b8e23',
        gifBomb: '#ff6b9d',
        rally: '#f1c40f',
        mudSlick: '#5c3a1e',
        white: '#ffffff',
    };

    // States
    const STATE = { TITLE: 0, PLAYING: 1, ROUND_END: 2, GAMEOVER: 3 };
    let state = STATE.TITLE;

    // Game constants
    const WIN_DISTANCE = 150;       // pixels past center to win a pull
    const ROUND_END_DELAY = 2000;   // ms to show round result
    const BEST_OF = 3;
    const ROUNDS_TO_WIN = 2;

    // Game variables
    let ropeOffset = 0;             // negative = PUKE winning, positive = CRUD winning
    let pukeForce = 0;              // accumulated pull force
    let crudForce = 0;
    let pukeScore = 0;              // rounds won
    let crudScore = 0;
    let currentRound = 1;
    let roundTimer = 0;
    let roundEndTime = 0;
    let winner = '';                 // 'puke' or 'crud'

    // Tap tracking
    let lastTapTime = 0;
    let tapRate = 0;                // taps per second
    let tapCount = 0;
    let tapTimes = [];              // rolling window for rate calc
    let totalTaps = 0;

    // AI variables
    let aiTapRate = 0;
    let aiTargetRate = 4;
    let aiNextTapTime = 0;
    let aiDifficulty = 1;           // scales per round
    let aiStunned = false;
    let aiStunEnd = 0;
    let aiTractionMult = 1;
    let aiTractionEnd = 0;

    // Player powerup state
    let playerRallyActive = false;
    let playerRallyEnd = 0;

    // Powerups
    let powerups = [];
    let nextPowerupTime = 0;
    let activePowerupText = '';
    let powerupTextTimer = 0;
    const POWERUP_TYPES = ['gif_bomb', 'team_rally', 'mud_slick'];

    // Particles (for effects)
    let particles = [];
    let mudSplashes = [];

    // Team runners (visual)
    let pukeRunners = [];
    let crudRunners = [];

    // Score
    let highScore = parseInt(localStorage.getItem('puke-crudvspuke-high') || '0');

    // Drag animation
    let dragPhase = false;
    let dragProgress = 0;

    // --- Initialization ---

    function initRunners() {
        pukeRunners = [];
        crudRunners = [];
        for (let i = 0; i < 4; i++) {
            pukeRunners.push({
                offsetX: -30 - i * 28,
                bobPhase: Math.random() * Math.PI * 2,
                armPhase: Math.random() * Math.PI * 2,
            });
            crudRunners.push({
                offsetX: 30 + i * 28,
                bobPhase: Math.random() * Math.PI * 2,
                armPhase: Math.random() * Math.PI * 2,
            });
        }
    }

    function startGame() {
        pukeScore = 0;
        crudScore = 0;
        currentRound = 1;
        aiDifficulty = 1;
        totalTaps = 0;
        startRound();
    }

    function startRound() {
        ropeOffset = 0;
        pukeForce = 0;
        crudForce = 0;
        tapCount = 0;
        tapTimes = [];
        tapRate = 0;
        lastTapTime = 0;
        powerups = [];
        particles = [];
        mudSplashes = [];
        nextPowerupTime = Date.now() + 3000 + Math.random() * 2000;
        aiTapRate = 0;
        aiTargetRate = 3 + aiDifficulty * 0.8;
        aiNextTapTime = 0;
        aiStunned = false;
        aiStunEnd = 0;
        aiTractionMult = 1;
        aiTractionEnd = 0;
        playerRallyActive = false;
        playerRallyEnd = 0;
        activePowerupText = '';
        powerupTextTimer = 0;
        dragPhase = false;
        dragProgress = 0;
        roundTimer = 0;
        initRunners();
        state = STATE.PLAYING;
    }

    function endRound(roundWinner) {
        winner = roundWinner;
        if (roundWinner === 'puke') pukeScore++;
        else crudScore++;

        dragPhase = true;
        dragProgress = 0;
        roundEndTime = Date.now() + ROUND_END_DELAY + 1500; // extra for drag anim
        state = STATE.ROUND_END;
    }

    function checkGameOver() {
        if (pukeScore >= ROUNDS_TO_WIN || crudScore >= ROUNDS_TO_WIN) {
            let finalWinner = pukeScore >= ROUNDS_TO_WIN ? 'puke' : 'crud';
            winner = finalWinner;
            if (finalWinner === 'puke') {
                let score = pukeScore * 1000 + Math.max(0, 500 - totalTaps);
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-crudvspuke-high', String(highScore));
                }
            }
            state = STATE.GAMEOVER;
            return true;
        }
        return false;
    }

    // --- Input ---

    document.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            handleTap();
        }
    });

    document.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleTap();
    }, { passive: false });

    function handleTap() {
        if (state === STATE.TITLE) {
            startGame();
            return;
        }
        if (state === STATE.GAMEOVER) {
            state = STATE.TITLE;
            return;
        }
        if (state === STATE.ROUND_END) return;
        if (state !== STATE.PLAYING) return;

        // Record tap
        let now = Date.now();
        tapTimes.push(now);
        totalTaps++;
        // Keep only last 1 second of taps
        while (tapTimes.length > 0 && tapTimes[0] < now - 1000) {
            tapTimes.shift();
        }
        tapRate = tapTimes.length;
        lastTapTime = now;
        tapCount++;

        // Check if tapping a highlighted powerup
        let caughtPowerup = false;
        for (let i = powerups.length - 1; i >= 0; i--) {
            let p = powerups[i];
            if (p.highlighted && !p.caught) {
                p.caught = true;
                caughtPowerup = true;
                activatePowerup(p.type);
                powerups.splice(i, 1);
                break;
            }
        }
    }

    // --- Powerups ---

    function spawnPowerup() {
        let w = canvas.width;
        let type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        let x = 100 + Math.random() * (w - 200);
        powerups.push({
            type: type,
            x: x,
            y: -30,
            vy: 1.5 + Math.random(),
            size: 28,
            highlighted: false,
            highlightTimer: 0,
            caught: false,
            age: 0,
        });
    }

    function activatePowerup(type) {
        let now = Date.now();
        if (type === 'gif_bomb') {
            // Stun AI for 2 seconds
            aiStunned = true;
            aiStunEnd = now + 2000;
            activePowerupText = 'GIF BOMB!';
            powerupTextTimer = now + 1500;
            // Visual explosion
            for (let i = 0; i < 20; i++) {
                particles.push({
                    x: canvas.width / 2,
                    y: canvas.height / 2 - 50,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 60,
                    maxLife: 60,
                    color: C.gifBomb,
                    size: 4 + Math.random() * 6,
                });
            }
        } else if (type === 'team_rally') {
            // +50% pull for 3 seconds
            playerRallyActive = true;
            playerRallyEnd = now + 3000;
            activePowerupText = 'TEAM RALLY!';
            powerupTextTimer = now + 1500;
            // Yellow sparks
            for (let i = 0; i < 15; i++) {
                particles.push({
                    x: canvas.width * 0.3,
                    y: canvas.height * 0.55,
                    vx: (Math.random() - 0.5) * 5,
                    vy: -Math.random() * 6,
                    life: 45,
                    maxLife: 45,
                    color: C.rally,
                    size: 3 + Math.random() * 4,
                });
            }
        } else if (type === 'mud_slick') {
            // Opponent loses traction for 2.5 seconds
            aiTractionMult = 0.3;
            aiTractionEnd = now + 2500;
            activePowerupText = 'MUD SLICK!';
            powerupTextTimer = now + 1500;
            // Brown splatter
            for (let i = 0; i < 15; i++) {
                particles.push({
                    x: canvas.width * 0.7,
                    y: canvas.height * 0.65,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -Math.random() * 4,
                    life: 50,
                    maxLife: 50,
                    color: C.mud,
                    size: 3 + Math.random() * 5,
                });
            }
        }
    }

    // --- AI ---

    function updateAI(dt) {
        let now = Date.now();

        // Check stun
        if (aiStunned && now > aiStunEnd) {
            aiStunned = false;
        }
        // Check traction
        if (aiTractionMult < 1 && now > aiTractionEnd) {
            aiTractionMult = 1;
        }

        if (aiStunned) {
            aiTapRate = 0;
            return;
        }

        // AI adjusts target based on rope position
        let urgency = Math.max(0, ropeOffset / WIN_DISTANCE); // 0-1 how close CRUD is to losing
        let comfort = Math.max(0, -ropeOffset / WIN_DISTANCE); // 0-1 how close PUKE is to losing

        // Adjust target rate
        let baseRate = 3 + aiDifficulty * 0.8;
        if (urgency > 0.3) baseRate += urgency * 3;
        if (comfort > 0.5) baseRate -= 1; // ease off when winning

        // Add some randomness
        aiTargetRate = baseRate + (Math.random() - 0.5) * 1.5;
        aiTargetRate = Math.max(1, Math.min(10, aiTargetRate));

        // Simulate tapping at target rate
        aiTapRate += (aiTargetRate - aiTapRate) * 0.1;
    }

    // --- Physics ---

    function updatePhysics(dt) {
        let now = Date.now();

        // Player pull force based on tap rate
        let playerMult = playerRallyActive && now < playerRallyEnd ? 1.5 : 1.0;
        if (playerRallyActive && now >= playerRallyEnd) playerRallyActive = false;

        pukeForce = tapRate * 2.5 * playerMult;

        // AI pull force
        crudForce = aiTapRate * 2.5 * aiTractionMult;

        // Net force: negative = PUKE pulling left (winning), positive = CRUD pulling
        let netForce = crudForce - pukeForce;

        // Apply force with some momentum / smoothing
        let accel = netForce * 0.15;
        ropeOffset += accel;

        // Friction / damping
        ropeOffset *= 0.995;

        // Decay tap rate if not tapping
        if (now - lastTapTime > 300) {
            // Remove old taps from window
            while (tapTimes.length > 0 && tapTimes[0] < now - 1000) {
                tapTimes.shift();
            }
            tapRate = tapTimes.length;
        }

        // Check win condition
        if (ropeOffset < -WIN_DISTANCE) {
            endRound('puke');
        } else if (ropeOffset > WIN_DISTANCE) {
            endRound('crud');
        }
    }

    // --- Update ---

    let lastTime = 0;

    function update(timestamp) {
        let dt = lastTime ? (timestamp - lastTime) / 16.67 : 1;
        dt = Math.min(dt, 3); // cap
        lastTime = timestamp;

        if (state === STATE.PLAYING) {
            roundTimer += dt;
            updateAI(dt);
            updatePhysics(dt);
            updatePowerups(dt);
            updateParticles(dt);
            updateRunnerAnims(dt);
        } else if (state === STATE.ROUND_END) {
            updateDragAnim(dt);
            updateParticles(dt);
            if (Date.now() > roundEndTime) {
                if (!checkGameOver()) {
                    currentRound++;
                    aiDifficulty += 0.5;
                    startRound();
                }
            }
        }

        draw();
        requestAnimationFrame(update);
    }

    function updatePowerups(dt) {
        let now = Date.now();
        let w = canvas.width;
        let h = canvas.height;
        let groundY = h * 0.72;

        // Spawn new powerup
        if (now > nextPowerupTime) {
            spawnPowerup();
            nextPowerupTime = now + 4000 + Math.random() * 4000;
        }

        // Update existing
        for (let i = powerups.length - 1; i >= 0; i--) {
            let p = powerups[i];
            p.y += p.vy * dt;
            p.age += dt;

            // Highlight when in catch zone (middle third of screen, near ground)
            let midX = w / 2;
            let inCatchZone = Math.abs(p.x - midX) < w * 0.25 && p.y > groundY - 100 && p.y < groundY;
            p.highlighted = inCatchZone;

            // Remove if off screen
            if (p.y > h + 50) {
                powerups.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.15 * dt; // gravity
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function updateRunnerAnims(dt) {
        let speed = Math.abs(tapRate) * 0.3 + 0.5;
        for (let r of pukeRunners) {
            r.bobPhase += speed * 0.1 * dt;
            r.armPhase += speed * 0.15 * dt;
        }
        let aiSpeed = Math.abs(aiTapRate) * 0.3 + 0.5;
        for (let r of crudRunners) {
            r.bobPhase += aiSpeed * 0.1 * dt;
            r.armPhase += aiSpeed * 0.15 * dt;
        }
    }

    function updateDragAnim(dt) {
        if (dragPhase && dragProgress < 1) {
            dragProgress += 0.015 * dt;
            if (dragProgress > 1) dragProgress = 1;

            // Mud splashes during drag
            if (Math.random() < 0.3) {
                let h = canvas.height;
                let baseY = h * 0.72;
                mudSplashes.push({
                    x: canvas.width / 2 + (Math.random() - 0.5) * 100,
                    y: baseY + Math.random() * 30,
                    vx: (Math.random() - 0.5) * 3,
                    vy: -Math.random() * 4,
                    life: 30,
                    maxLife: 30,
                    size: 2 + Math.random() * 4,
                });
            }
        }
        // Update mud splashes
        for (let i = mudSplashes.length - 1; i >= 0; i--) {
            let s = mudSplashes[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.2;
            s.life--;
            if (s.life <= 0) mudSplashes.splice(i, 1);
        }
    }

    // --- Drawing ---

    function draw() {
        let w = canvas.width;
        let h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (state === STATE.TITLE) {
            drawTitle(w, h);
        } else {
            drawScene(w, h);
            drawHUD(w, h);
            if (state === STATE.ROUND_END) drawRoundEnd(w, h);
            if (state === STATE.GAMEOVER) drawGameOver(w, h);
        }
    }

    function drawTitle(w, h) {
        // Sky gradient
        let grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, C.skyTop);
        grad.addColorStop(0.5, C.sky);
        grad.addColorStop(1, C.green);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = C.puke;
        ctx.font = 'bold 36px "Press Start 2P", monospace';
        ctx.fillText('CRUD', w / 2, h * 0.2);
        ctx.fillStyle = C.cream;
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillText('vs', w / 2, h * 0.28);
        ctx.fillStyle = C.crud;
        ctx.font = 'bold 36px "Press Start 2P", monospace';
        ctx.fillText('PUKE', w / 2, h * 0.37);

        // Subtitle
        ctx.fillStyle = C.cream;
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillText('TUG OF WAR', w / 2, h * 0.47);

        // Instructions
        ctx.fillStyle = C.textDim;
        ctx.font = '18px VT323, monospace';
        ctx.fillText('Mash SPACE to pull for Team PUKE', w / 2, h * 0.58);
        ctx.fillText('Catch powerups when they glow', w / 2, h * 0.64);
        ctx.fillText('Best of 3 rounds', w / 2, h * 0.70);

        // High score
        if (highScore > 0) {
            ctx.fillStyle = C.rally;
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillText('BEST: ' + highScore, w / 2, h * 0.78);
        }

        // Prompt
        ctx.fillStyle = C.puke;
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 400);
        ctx.fillText('TAP TO START', w / 2, h * 0.88);
        ctx.globalAlpha = 1;

        // Draw opposing teams preview
        drawTeamPreview(w, h);
    }

    function drawTeamPreview(w, h) {
        let baseY = h * 0.9;
        // PUKE side (left)
        for (let i = 0; i < 3; i++) {
            drawStickRunner(w * 0.2 + i * 25, baseY, C.puke, Math.sin(Date.now() / 300 + i), false);
        }
        // CRUD side (right)
        for (let i = 0; i < 3; i++) {
            drawStickRunner(w * 0.8 - i * 25, baseY, C.crud, Math.sin(Date.now() / 300 + i), true);
        }
    }

    function drawScene(w, h) {
        let groundY = h * 0.72;
        let midX = w / 2;

        // Sky
        let grad = ctx.createLinearGradient(0, 0, 0, groundY);
        grad.addColorStop(0, C.skyTop);
        grad.addColorStop(1, C.sky);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, groundY);

        // Clouds
        drawClouds(w, groundY);

        // Mountains in background
        drawMountains(w, groundY);

        // Ground
        ctx.fillStyle = C.green;
        ctx.fillRect(0, groundY, w, h - groundY);

        // Trail / dirt strip
        let trailY = groundY + 5;
        let trailH = 35;
        ctx.fillStyle = C.dirt;
        ctx.fillRect(0, trailY, w, trailH);

        // Mud pit in center
        let mudW = 80;
        let mudH = trailH + 10;
        ctx.fillStyle = C.mud;
        ctx.beginPath();
        ctx.ellipse(midX, trailY + trailH / 2, mudW / 2, mudH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.mudDark;
        ctx.beginPath();
        ctx.ellipse(midX, trailY + trailH / 2 + 3, mudW / 3, mudH / 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rope
        drawRope(w, h, groundY, trailY, trailH, midX);

        // Teams
        drawTeams(w, h, groundY, trailY, trailH, midX);

        // Powerups falling from sky
        drawPowerups(w, h, groundY);

        // Particles
        drawParticles();

        // Mud splashes
        drawMudSplashes();

        // Powerup text
        drawPowerupText(w, h);
    }

    function drawClouds(w, groundY) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        let t = Date.now() / 8000;
        for (let i = 0; i < 5; i++) {
            let cx = ((i * 200 + t * 100 * (i % 2 === 0 ? 1 : 0.5)) % (w + 100)) - 50;
            let cy = 30 + i * 25;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 40 + i * 5, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 25, cy - 5, 25, 12, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawMountains(w, groundY) {
        ctx.fillStyle = '#4a7a3a';
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let x = 0; x <= w; x += 50) {
            let peak = groundY - 40 - Math.sin(x * 0.008) * 30 - Math.sin(x * 0.015 + 1) * 20;
            ctx.lineTo(x, peak);
        }
        ctx.lineTo(w, groundY);
        ctx.closePath();
        ctx.fill();
    }

    function drawRope(w, h, groundY, trailY, trailH, midX) {
        let ropeY = trailY + trailH / 2 - 15;
        let ropeLen = w * 0.6;
        let ropeStartX = midX - ropeLen / 2 + ropeOffset;
        let ropeEndX = midX + ropeLen / 2 + ropeOffset;

        // Rope line
        ctx.strokeStyle = C.rope;
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Slight sag in rope
        ctx.moveTo(ropeStartX, ropeY);
        let sagMid = ropeY + 8 + Math.abs(ropeOffset) * 0.02;
        ctx.quadraticCurveTo(midX + ropeOffset, sagMid, ropeEndX, ropeY);
        ctx.stroke();

        // Center marker (flag)
        let markerX = midX + ropeOffset;
        ctx.fillStyle = C.marker;
        ctx.fillRect(markerX - 3, ropeY - 20, 6, 20);
        // Flag
        ctx.fillStyle = C.marker;
        ctx.beginPath();
        ctx.moveTo(markerX + 3, ropeY - 20);
        ctx.lineTo(markerX + 18, ropeY - 14);
        ctx.lineTo(markerX + 3, ropeY - 8);
        ctx.closePath();
        ctx.fill();

        // Center line (fixed)
        ctx.strokeStyle = C.white;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(midX, groundY - 5);
        ctx.lineTo(midX, groundY + trailH + 15);
        ctx.stroke();
        ctx.setLineDash([]);

        // Win zone indicators
        ctx.fillStyle = 'rgba(192,57,43,0.15)';
        // Left win zone
        ctx.fillRect(midX - WIN_DISTANCE - 30, trailY, 30, trailH);
        // Right win zone
        ctx.fillRect(midX + WIN_DISTANCE, trailY, 30, trailH);
    }

    function drawTeams(w, h, groundY, trailY, trailH, midX) {
        let ropeY = trailY + trailH / 2 - 15;
        let teamY = trailY + trailH / 2 + 5;

        // PUKE team (left) - pulling left
        for (let i = 0; i < pukeRunners.length; i++) {
            let r = pukeRunners[i];
            let x = midX + ropeOffset + r.offsetX;
            let bob = Math.sin(r.bobPhase) * 3;

            if (dragPhase && winner === 'crud') {
                // Being dragged right toward mud
                x += dragProgress * (WIN_DISTANCE + 50);
            }

            drawPullingRunner(x, teamY + bob, C.puke, r.armPhase, false, tapRate > 2);
        }

        // CRUD team (right) - pulling right
        for (let i = 0; i < crudRunners.length; i++) {
            let r = crudRunners[i];
            let x = midX + ropeOffset + r.offsetX;
            let bob = Math.sin(r.bobPhase) * 3;

            if (dragPhase && winner === 'puke') {
                // Being dragged left toward mud
                x -= dragProgress * (WIN_DISTANCE + 50);
            }

            drawPullingRunner(x, teamY + bob, C.crud, r.armPhase, true, aiTapRate > 2);
        }

        // Team labels
        ctx.textAlign = 'center';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.puke;
        let pukeX = midX + ropeOffset - 70;
        if (dragPhase && winner === 'crud') pukeX += dragProgress * (WIN_DISTANCE + 50);
        ctx.fillText('PUKE', pukeX, teamY - 35);

        ctx.fillStyle = C.crud;
        let crudX = midX + ropeOffset + 70;
        if (dragPhase && winner === 'puke') crudX -= dragProgress * (WIN_DISTANCE + 50);
        ctx.fillText('CRUD', crudX, teamY - 35);
    }

    function drawPullingRunner(x, y, color, armPhase, facingLeft, active) {
        let dir = facingLeft ? -1 : 1;
        let lean = active ? dir * 4 : dir * 1;
        let armSwing = active ? Math.sin(armPhase) * 8 : Math.sin(armPhase) * 3;

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y - 18, 6, 0, Math.PI * 2); // head
        ctx.fill();

        // Torso (leaning)
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + lean, y + 2);
        ctx.stroke();

        // Arms reaching for rope
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - dir * 12 + armSwing * dir * 0.3, y - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x - dir * 14 + armSwing * dir * 0.2, y - 6);
        ctx.stroke();

        // Legs
        let legSpread = active ? Math.sin(armPhase * 0.7) * 5 : 2;
        ctx.beginPath();
        ctx.moveTo(x + lean, y + 2);
        ctx.lineTo(x + lean - legSpread, y + 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + lean, y + 2);
        ctx.lineTo(x + lean + legSpread, y + 14);
        ctx.stroke();
    }

    function drawStickRunner(x, y, color, phase, facingLeft) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y - 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 11);
        ctx.lineTo(x, y);
        ctx.stroke();
        let armSwing = Math.sin(phase) * 6;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + armSwing, y - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - armSwing, y - 4);
        ctx.stroke();
    }

    function drawPowerups(w, h, groundY) {
        for (let p of powerups) {
            if (p.caught) continue;

            ctx.save();

            // Glow when highlighted
            if (p.highlighted) {
                ctx.shadowColor = C.rally;
                ctx.shadowBlur = 15;
                // Pulsing border
                ctx.strokeStyle = C.rally;
                ctx.lineWidth = 2 + Math.sin(Date.now() / 100) * 1;
                ctx.strokeRect(p.x - p.size / 2 - 4, p.y - p.size / 2 - 4, p.size + 8, p.size + 8);
            }

            // Draw based on type
            if (p.type === 'gif_bomb') {
                drawGifBomb(p.x, p.y, p.size, p.age);
            } else if (p.type === 'team_rally') {
                drawTeamRally(p.x, p.y, p.size, p.age);
            } else if (p.type === 'mud_slick') {
                drawMudSlick(p.x, p.y, p.size, p.age);
            }

            ctx.restore();
        }
    }

    function drawGifBomb(x, y, size, age) {
        // Animated "GIF" box with flashing colors
        let flash = Math.floor(age * 0.3) % 3;
        let colors = [C.gifBomb, '#ff4757', '#ff6b81'];
        ctx.fillStyle = colors[flash];
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = C.white;
        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GIF', x, y + 4);
    }

    function drawTeamRally(x, y, size, age) {
        // Star / boost icon
        ctx.fillStyle = C.rally;
        let rot = age * 0.05;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        drawStar(0, 0, size / 2, size / 4, 5);
        ctx.restore();
    }

    function drawStar(cx, cy, outerR, innerR, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            let r = i % 2 === 0 ? outerR : innerR;
            let angle = (i * Math.PI) / points - Math.PI / 2;
            if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fill();
    }

    function drawMudSlick(x, y, size, age) {
        // Brown blob
        ctx.fillStyle = C.mud;
        ctx.beginPath();
        let wobble = Math.sin(age * 0.2) * 2;
        ctx.ellipse(x, y, size / 2 + wobble, size / 2 - wobble, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.mudDark;
        ctx.font = 'bold 8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MUD', x, y + 3);
    }

    function drawParticles() {
        for (let p of particles) {
            let alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawMudSplashes() {
        for (let s of mudSplashes) {
            let alpha = s.life / s.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = C.mud;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawPowerupText(w, h) {
        if (activePowerupText && Date.now() < powerupTextTimer) {
            let alpha = (powerupTextTimer - Date.now()) / 1500;
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.font = 'bold 24px "Press Start 2P", monospace';
            ctx.fillStyle = C.rally;
            ctx.strokeStyle = C.dark;
            ctx.lineWidth = 3;
            ctx.strokeText(activePowerupText, w / 2, h * 0.35);
            ctx.fillText(activePowerupText, w / 2, h * 0.35);
            ctx.globalAlpha = 1;
        }
    }

    function drawHUD(w, h) {
        let pad = 15;
        let barW = w * 0.35;
        let barH = 14;
        let barY = 18;
        let midX = w / 2;

        // Round indicator
        ctx.textAlign = 'center';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.cream;
        ctx.fillText('ROUND ' + currentRound, midX, barY - 2);

        // Score: PUKE (left) vs CRUD (right)
        ctx.textAlign = 'left';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.puke;
        ctx.fillText('PUKE: ' + pukeScore, pad, barY + barH + 18);

        ctx.textAlign = 'right';
        ctx.fillStyle = C.crud;
        ctx.fillText('CRUD: ' + crudScore, w - pad, barY + barH + 18);

        // Tug-of-war meter
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(midX - barW / 2, barY, barW, barH);

        // PUKE side fill (from center to left)
        let pukeFill = Math.max(0, -ropeOffset) / WIN_DISTANCE;
        pukeFill = Math.min(1, pukeFill);
        ctx.fillStyle = C.puke;
        ctx.fillRect(midX, barY, -(pukeFill * barW / 2), barH);

        // CRUD side fill (from center to right)
        let crudFill = Math.max(0, ropeOffset) / WIN_DISTANCE;
        crudFill = Math.min(1, crudFill);
        ctx.fillStyle = C.crud;
        ctx.fillRect(midX, barY, crudFill * barW / 2, barH);

        // Center line on meter
        ctx.fillStyle = C.white;
        ctx.fillRect(midX - 1, barY - 2, 2, barH + 4);

        // Border
        ctx.strokeStyle = C.cream;
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - barW / 2, barY, barW, barH);

        // Tap rate indicator
        ctx.textAlign = 'left';
        ctx.font = '16px VT323, monospace';
        ctx.fillStyle = C.puke;
        ctx.fillText('TAP: ' + Math.round(tapRate) + '/s', pad, barY + barH + 38);

        // Active powerup indicators
        let now = Date.now();
        let statusY = barY + barH + 55;
        if (aiStunned && now < aiStunEnd) {
            ctx.fillStyle = C.gifBomb;
            ctx.fillText('STUNNED! ' + ((aiStunEnd - now) / 1000).toFixed(1) + 's', pad, statusY);
            statusY += 16;
        }
        if (playerRallyActive && now < playerRallyEnd) {
            ctx.fillStyle = C.rally;
            ctx.fillText('RALLY! ' + ((playerRallyEnd - now) / 1000).toFixed(1) + 's', pad, statusY);
            statusY += 16;
        }
        if (aiTractionMult < 1 && now < aiTractionEnd) {
            ctx.fillStyle = C.mudSlick;
            ctx.fillText('MUD SLICK! ' + ((aiTractionEnd - now) / 1000).toFixed(1) + 's', pad, statusY);
        }

        // Instructions reminder at bottom
        if (state === STATE.PLAYING) {
            ctx.textAlign = 'center';
            ctx.font = '14px VT323, monospace';
            ctx.fillStyle = 'rgba(253,245,230,0.4)';
            ctx.fillText('MASH SPACE TO PULL  |  TAP WHEN POWERUPS GLOW', midX, h - 10);
        }
    }

    function drawRoundEnd(w, h) {
        ctx.fillStyle = 'rgba(42, 21, 6, 0.6)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.font = 'bold 28px "Press Start 2P", monospace';

        if (winner === 'puke') {
            ctx.fillStyle = C.puke;
            ctx.fillText('PUKE WINS', w / 2, h * 0.35);
            ctx.font = '14px "Press Start 2P", monospace';
            ctx.fillStyle = C.cream;
            ctx.fillText('CRUD eats mud!', w / 2, h * 0.45);
        } else {
            ctx.fillStyle = C.crud;
            ctx.fillText('CRUD WINS', w / 2, h * 0.35);
            ctx.font = '14px "Press Start 2P", monospace';
            ctx.fillStyle = C.cream;
            ctx.fillText('PUKE eats mud!', w / 2, h * 0.45);
        }

        ctx.font = '16px VT323, monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('PUKE ' + pukeScore + ' - ' + crudScore + ' CRUD', w / 2, h * 0.55);
    }

    function drawGameOver(w, h) {
        ctx.fillStyle = 'rgba(42, 21, 6, 0.85)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        let matchWinner = pukeScore >= ROUNDS_TO_WIN ? 'puke' : 'crud';

        if (matchWinner === 'puke') {
            ctx.font = 'bold 20px "Press Start 2P", monospace';
            ctx.fillStyle = C.puke;
            ctx.fillText('TEAM PUKE', w / 2, h * 0.25);
            ctx.font = 'bold 28px "Press Start 2P", monospace';
            ctx.fillStyle = C.rally;
            ctx.fillText('VICTORY!', w / 2, h * 0.35);

            ctx.font = '16px VT323, monospace';
            ctx.fillStyle = C.cream;
            ctx.fillText('CRUD has been dragged through the mud!', w / 2, h * 0.45);
        } else {
            ctx.font = 'bold 20px "Press Start 2P", monospace';
            ctx.fillStyle = C.crud;
            ctx.fillText('TEAM CRUD', w / 2, h * 0.25);
            ctx.font = 'bold 28px "Press Start 2P", monospace';
            ctx.fillStyle = C.marker;
            ctx.fillText('WINS...', w / 2, h * 0.35);

            ctx.font = '16px VT323, monospace';
            ctx.fillStyle = C.cream;
            ctx.fillText('PUKE takes the mud bath of shame.', w / 2, h * 0.45);
        }

        // Final score
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = C.cream;
        ctx.fillText('PUKE ' + pukeScore + ' - ' + crudScore + ' CRUD', w / 2, h * 0.57);

        // Best score
        if (highScore > 0) {
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.rally;
            ctx.fillText('BEST SCORE: ' + highScore, w / 2, h * 0.65);
        }

        // Total taps
        ctx.font = '16px VT323, monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('Total taps: ' + totalTaps, w / 2, h * 0.73);

        // Prompt
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.puke;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 400);
        ctx.fillText('TAP TO PLAY AGAIN', w / 2, h * 0.85);
        ctx.globalAlpha = 1;
    }

    // --- Start ---
    requestAnimationFrame(update);

})();
