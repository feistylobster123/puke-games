// Chipotle Mile - PUKE Games
// Eat half a burrito before each lap. Run the lap. Don't puke.
// Tap SPACE to run (during run phase) or chew (during eat phase).
// Nausea rises when eating, spikes if you run too fast after eating.

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
        sky: '#1a0a02',
        ground: '#5c3a1e',
        track: '#8b6914',
        trackLine: '#d4a026',
        runner: '#e87f24',
        burrito: '#c8a96e',
        burrFill: '#8b4513',
        rice: '#fdf5e6',
        nausea: '#6b8e23',
        nauseaHigh: '#c0392b',
        text: '#e87f24',
        textDim: '#8b6914',
        puke: '#9acd32',
    };

    // Game state
    const STATE = { TITLE: 0, EATING: 1, RUNNING: 2, PUKING: 3, GAMEOVER: 4 };
    let state = STATE.TITLE;

    // Player
    let lap = 0;
    let nausea = 0;          // 0-100
    let burrProgress = 0;    // 0-100 per eating phase
    let runProgress = 0;     // 0-100 per running phase (one lap around track)
    let runSpeed = 0;        // current speed
    let score = 0;           // laps completed
    let highScore = parseInt(localStorage.getItem('puke-chipotle-high') || '0');
    let tapCount = 0;
    let lastTapTime = 0;
    let tapRate = 0;         // taps per second
    let pukeTimer = 0;
    let pukeParticles = [];

    // Runner animation
    let runnerX = 0;
    let runnerBob = 0;
    let runnerFrame = 0;
    let runnerAngle = 0;     // lean from nausea

    // Burrito visual
    let burrBites = 0;       // visual bite marks

    // Difficulty scaling
    function getBurrSize() { return 1 + lap * 0.3; }  // burrito gets bigger each lap
    function getNauseaRate() { return 0.4 + lap * 0.12; }  // nausea rises faster each lap
    function getNauseaDecay() { return 0.08 - Math.min(0.06, lap * 0.005); } // decays slower as laps go on
    function getRunNauseaSpike() { return 0.15 + nausea * 0.004 + lap * 0.03; } // fast running spikes nausea more when already high

    // Input
    let keys = {};
    let tapping = false;
    let touchActive = false;

    document.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            handleTap();
        }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
    canvas.addEventListener('touchstart', e => { e.preventDefault(); touchActive = true; handleTap(); });
    canvas.addEventListener('touchend', e => { touchActive = false; });
    canvas.addEventListener('mousedown', e => { handleTap(); });

    function handleTap() {
        const now = Date.now();
        tapCount++;

        if (now - lastTapTime < 500) {
            tapRate = 1000 / (now - lastTapTime);
        } else {
            tapRate = 1;
        }
        lastTapTime = now;

        if (state === STATE.TITLE) {
            startGame();
        } else if (state === STATE.GAMEOVER) {
            state = STATE.TITLE;
        } else if (state === STATE.EATING) {
            chew();
        } else if (state === STATE.RUNNING) {
            run();
        }
    }

    function startGame() {
        state = STATE.EATING;
        lap = 0;
        nausea = 0;
        burrProgress = 0;
        runProgress = 0;
        runSpeed = 0;
        score = 0;
        tapCount = 0;
        burrBites = 0;
        pukeParticles = [];
    }

    function chew() {
        // Each tap = a bite. Bigger burrito = more bites needed
        const biteSize = 8 / getBurrSize();
        burrProgress = Math.min(100, burrProgress + biteSize);
        nausea = Math.min(100, nausea + getNauseaRate());
        burrBites++;

        if (nausea >= 100) {
            triggerPuke();
            return;
        }

        if (burrProgress >= 100) {
            // Done eating, start running
            state = STATE.RUNNING;
            runProgress = 0;
            runSpeed = 0;
        }
    }

    function run() {
        // Each tap = a stride
        const stride = 3.5;
        runSpeed = Math.min(12, runSpeed + stride);

        // Running fast with high nausea = danger
        if (tapRate > 4) {
            nausea = Math.min(100, nausea + getRunNauseaSpike() * tapRate * 0.3);
        }

        if (nausea >= 100) {
            triggerPuke();
        }
    }

    function triggerPuke() {
        state = STATE.PUKING;
        pukeTimer = 120; // 2 seconds at 60fps
        // Create puke particles
        for (let i = 0; i < 30; i++) {
            pukeParticles.push({
                x: canvas.width * 0.3,
                y: canvas.height * 0.55,
                vx: Math.random() * 6 + 2,
                vy: -(Math.random() * 8 + 2),
                life: 60 + Math.random() * 60,
                size: 2 + Math.random() * 4,
                color: Math.random() > 0.5 ? C.puke : C.burrito,
            });
        }
    }

    // Update loop
    function update() {
        if (state === STATE.RUNNING) {
            // Running physics
            runProgress += runSpeed * 0.15;
            runSpeed *= 0.92; // friction / decel

            // Nausea slowly decays while running at moderate pace
            if (tapRate < 3) {
                nausea = Math.max(0, nausea - getNauseaDecay());
            }

            // Tap rate decays
            if (Date.now() - lastTapTime > 400) {
                tapRate *= 0.9;
            }

            // Lap complete
            if (runProgress >= 100) {
                lap++;
                score = lap;
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-chipotle-high', highScore.toString());
                }
                // Next eating phase
                state = STATE.EATING;
                burrProgress = 0;
                burrBites = 0;
                // Small nausea reduction between laps
                nausea = Math.max(0, nausea - 8);
            }

            // Runner animation
            runnerBob += runSpeed * 0.3;
            runnerFrame += runSpeed * 0.1;
        }

        if (state === STATE.EATING) {
            // Nausea slowly decays while eating (you're standing still)
            nausea = Math.max(0, nausea - getNauseaDecay() * 0.5);
            if (Date.now() - lastTapTime > 400) {
                tapRate *= 0.9;
            }
        }

        if (state === STATE.PUKING) {
            pukeTimer--;
            // Update puke particles
            pukeParticles = pukeParticles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.3; // gravity
                p.life--;
                return p.life > 0;
            });
            if (pukeTimer <= 0) {
                state = STATE.GAMEOVER;
            }
        }

        // Runner lean from nausea
        runnerAngle = (nausea / 100) * 0.3;
    }

    // Draw functions
    function drawTrack() {
        const w = canvas.width;
        const h = canvas.height;
        const groundY = h * 0.7;

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, '#0a0502');
        skyGrad.addColorStop(1, '#2a1506');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, groundY);

        // Stars
        ctx.fillStyle = '#fdf5e6';
        for (let i = 0; i < 30; i++) {
            const sx = (i * 97 + 13) % w;
            const sy = (i * 53 + 7) % (groundY * 0.7);
            ctx.fillRect(sx, sy, 1, 1);
        }

        // Ground
        ctx.fillStyle = C.ground;
        ctx.fillRect(0, groundY, w, h - groundY);

        // Track (oval, shown from side as a flat strip)
        const trackY = groundY - 2;
        ctx.fillStyle = C.track;
        ctx.fillRect(40, trackY, w - 80, 50);

        // Lane lines
        ctx.strokeStyle = C.trackLine;
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 10]);
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(40, trackY + 12 + i * 14);
            ctx.lineTo(w - 40, trackY + 12 + i * 14);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Start/finish line
        const finishX = 80;
        ctx.fillStyle = '#fff';
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 3; c++) {
                if ((r + c) % 2 === 0) {
                    ctx.fillRect(finishX + c * 5, trackY + r * 10, 5, 10);
                }
            }
        }
    }

    function drawRunner(x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(runnerAngle);

        const bob = state === STATE.RUNNING ? Math.sin(runnerBob) * 3 : 0;
        const legPhase = state === STATE.RUNNING ? Math.sin(runnerFrame) : 0;

        // Body
        ctx.fillStyle = C.runner;
        ctx.fillRect(-6, -30 + bob, 12, 20); // torso

        // Head
        ctx.fillRect(-5, -40 + bob, 10, 10);

        // Nausea face
        if (nausea > 50) {
            ctx.fillStyle = C.nausea;
            // green tinge
            ctx.globalAlpha = (nausea - 50) / 50;
            ctx.fillRect(-5, -40 + bob, 10, 10);
            ctx.globalAlpha = 1;
        }

        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(-3, -37 + bob, 2, 2);
        ctx.fillRect(1, -37 + bob, 2, 2);

        // Mouth (gets more distressed with nausea)
        if (nausea > 70) {
            ctx.fillStyle = C.nauseaHigh;
            ctx.fillRect(-2, -33 + bob, 4, 3); // open mouth
        } else {
            ctx.fillRect(-2, -33 + bob, 4, 1);
        }

        // Arms
        ctx.fillStyle = C.runner;
        const armSwing = state === STATE.RUNNING ? legPhase * 8 : 0;
        ctx.save();
        ctx.translate(-6, -26 + bob);
        ctx.rotate(-0.3 + armSwing * 0.05);
        ctx.fillRect(-3, 0, 4, 14);
        ctx.restore();
        ctx.save();
        ctx.translate(6, -26 + bob);
        ctx.rotate(0.3 - armSwing * 0.05);
        ctx.fillRect(-1, 0, 4, 14);
        ctx.restore();

        // Legs
        ctx.save();
        ctx.translate(-4, -10 + bob);
        ctx.rotate(legPhase * 0.4);
        ctx.fillRect(-2, 0, 5, 16);
        ctx.restore();
        ctx.save();
        ctx.translate(2, -10 + bob);
        ctx.rotate(-legPhase * 0.4);
        ctx.fillRect(-2, 0, 5, 16);
        ctx.restore();

        ctx.restore();
    }

    function drawBurrito(x, y, progress) {
        const scale = getBurrSize();
        const w = 60 * scale;
        const h = 22 * scale;

        ctx.save();
        ctx.translate(x, y);

        // Foil wrapper (what's left)
        const wrapEnd = w * (1 - progress / 100);
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath();
        ctx.ellipse(0, 0, wrapEnd / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Exposed burrito filling
        if (progress > 0) {
            ctx.fillStyle = C.burrFill;
            ctx.beginPath();
            ctx.ellipse(wrapEnd / 2, 0, (w - wrapEnd) / 2, h / 2 - 1, 0, 0, Math.PI * 2);
            ctx.fill();

            // Rice bits
            ctx.fillStyle = C.rice;
            for (let i = 0; i < 5; i++) {
                const rx = wrapEnd / 2 + (i * 7) % (w - wrapEnd);
                const ry = -3 + (i * 3) % 6;
                if (rx < w / 2) ctx.fillRect(rx, ry, 2, 1);
            }
        }

        // Bite marks
        ctx.fillStyle = C.sky;
        for (let i = 0; i < Math.min(burrBites, 8); i++) {
            const bx = wrapEnd / 2 + i * 6;
            if (bx < w / 2) {
                ctx.beginPath();
                ctx.arc(bx, -h / 2 + 2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function drawNauseaMeter() {
        const w = canvas.width;
        const meterW = 200;
        const meterH = 16;
        const x = w / 2 - meterW / 2;
        const y = 20;

        // Label
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = nausea > 70 ? C.nauseaHigh : C.text;
        ctx.textAlign = 'center';
        ctx.fillText('NAUSEA', w / 2, y - 4);

        // Bar background
        ctx.fillStyle = '#1a0a02';
        ctx.strokeStyle = nausea > 70 ? C.nauseaHigh : C.text;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, meterW, meterH);
        ctx.fillRect(x, y, meterW, meterH);

        // Bar fill
        const fillW = (nausea / 100) * meterW;
        if (nausea > 70) {
            ctx.fillStyle = C.nauseaHigh;
        } else if (nausea > 40) {
            ctx.fillStyle = C.nausea;
        } else {
            ctx.fillStyle = C.nausea;
        }
        ctx.fillRect(x, y, fillW, meterH);

        // Shake effect at high nausea
        if (nausea > 80 && Math.random() > 0.7) {
            ctx.fillStyle = C.nauseaHigh;
            ctx.fillRect(x + fillW - 3, y - 1, 6, meterH + 2);
        }
    }

    function drawPhaseIndicator() {
        const w = canvas.width;
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        if (state === STATE.EATING) {
            ctx.fillStyle = C.burrito;
            ctx.fillText('EAT THE BURRITO', w / 2, canvas.height * 0.45);
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.fillText('TAP TO CHEW', w / 2, canvas.height * 0.45 + 20);

            // Burrito progress
            const pctText = Math.floor(burrProgress) + '% EATEN';
            ctx.fillStyle = C.text;
            ctx.fillText(pctText, w / 2, canvas.height * 0.45 + 45);
        } else if (state === STATE.RUNNING) {
            ctx.fillStyle = C.text;
            ctx.fillText('RUN!', w / 2, canvas.height * 0.45);
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;

            const paceText = tapRate > 5 ? 'TOO FAST!' : tapRate > 3 ? 'FAST' : 'STEADY';
            const paceColor = tapRate > 5 ? C.nauseaHigh : tapRate > 3 ? C.nausea : C.text;
            ctx.fillStyle = paceColor;
            ctx.fillText(paceText, w / 2, canvas.height * 0.45 + 20);
        }
    }

    function drawHUD() {
        ctx.font = '14px "Press Start 2P", monospace';

        // Lap counter
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('LAP ' + (lap + 1), 60, 60);

        // Score
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('LAPS: ' + score, canvas.width - 20, 60);

        // High score
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('BEST: ' + highScore, canvas.width - 20, 78);

        // Run progress bar (during running)
        if (state === STATE.RUNNING) {
            const barW = canvas.width - 120;
            const barH = 8;
            const barX = 60;
            const barY = canvas.height - 30;

            ctx.fillStyle = '#1a0a02';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.strokeStyle = C.textDim;
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);

            ctx.fillStyle = C.text;
            ctx.fillRect(barX, barY, barW * (runProgress / 100), barH);

            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.textAlign = 'center';
            ctx.fillText('TRACK', canvas.width / 2, barY - 4);
        }
    }

    function drawPukeParticles() {
        pukeParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.min(1, p.life / 30);
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1;
    }

    function drawTitle() {
        const w = canvas.width;
        const h = canvas.height;

        drawTrack();

        ctx.font = '28px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('CHIPOTLE', w / 2, h * 0.25);
        ctx.fillText('MILE', w / 2, h * 0.25 + 40);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.burrito;
        ctx.fillText('Eat half a burrito before each lap.', w / 2, h * 0.42);
        ctx.fillText('Run the lap. Don\'t puke.', w / 2, h * 0.42 + 22);
        ctx.fillText('Each lap the burrito gets bigger.', w / 2, h * 0.42 + 44);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.65);

        // Controls
        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('SPACE / TAP to chew & run', w / 2, h * 0.78);
        ctx.fillText('Pace yourself or pay the price', w / 2, h * 0.78 + 18);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('HIGH SCORE: ' + highScore + ' LAPS', w / 2, h * 0.88);
        }
    }

    function drawGameOver() {
        const w = canvas.width;
        const h = canvas.height;

        // Darken
        ctx.fillStyle = 'rgba(26, 10, 2, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Puke particles still visible
        drawPukeParticles();

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = C.nauseaHigh;
        ctx.textAlign = 'center';
        ctx.fillText('DQ\'d!', w / 2, h * 0.25);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = C.puke;
        ctx.fillText('YOU PUKED', w / 2, h * 0.25 + 35);

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(score + ' LAPS', w / 2, h * 0.45);

        if (score >= highScore && score > 0) {
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText('NEW RECORD!', w / 2, h * 0.45 + 28);
        }

        // Flavor text based on score
        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = C.burrito;
        let flavor = '';
        if (score === 0) flavor = 'You didn\'t even finish the first burrito.';
        else if (score === 1) flavor = 'One lap. The burrito won.';
        else if (score < 4) flavor = 'Respectable. Chipotle is undefeated though.';
        else if (score < 7) flavor = 'Serious competitor. Your stomach disagrees.';
        else if (score < 10) flavor = 'Iron gut. PUKE would be proud.';
        else flavor = 'Legendary. You ARE the Chipotle Mile.';
        ctx.fillText(flavor, w / 2, h * 0.58);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.75);
    }

    // Main game render
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) {
            drawTitle();
            return;
        }

        if (state === STATE.GAMEOVER) {
            drawTrack();
            drawGameOver();
            return;
        }

        // Active gameplay
        drawTrack();

        // Runner position
        const trackY = canvas.height * 0.7 - 2;
        let rx;
        if (state === STATE.RUNNING) {
            // Runner moves along the track
            rx = 80 + (canvas.width - 160) * (runProgress / 100);
        } else {
            // Standing at start
            rx = 100;
        }
        drawRunner(rx, trackY);

        // Burrito (during eating phase, shown above runner)
        if (state === STATE.EATING) {
            drawBurrito(rx + 30, trackY - 35, burrProgress);
        }

        // Puke particles
        if (state === STATE.PUKING) {
            drawPukeParticles();

            ctx.font = '20px "Press Start 2P", monospace';
            ctx.fillStyle = C.puke;
            ctx.textAlign = 'center';
            ctx.fillText('BLEEAARGH', canvas.width / 2, canvas.height * 0.35);
        }

        drawNauseaMeter();
        drawPhaseIndicator();
        drawHUD();
    }

    // Game loop
    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
