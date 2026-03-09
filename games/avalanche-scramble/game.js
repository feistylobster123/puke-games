// Avalanche Scramble - PUKE Games
// Vertical climbing platformer. 31 laps of Kendall Mountain.
// 116,188 ft of elevation. Rocks tumble from above. Altitude sickness.

(function() {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = Math.min(window.innerWidth, 800);
        canvas.height = Math.min(window.innerHeight, 600);
    }
    resize();
    window.addEventListener('resize', resize);

    const C = {
        sky: '#2a3a5a',
        mountain: '#6a6a7a',
        rock: '#8a8a9a',
        snow: '#dde8f0',
        ice: '#a0c0e0',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#5c5c6c',
        danger: '#c0392b',
        ledge: '#7a7a5a',
        dark: '#1a1a2a',
    };

    const STATE = { TITLE: 0, PLAYING: 1, GAMEOVER: 2 };
    let state = STATE.TITLE;

    // Player
    let px, py;           // position
    let pvx, pvy;         // velocity
    let onGround = false;
    let canJump = true;
    let facing = 1;       // 1 = right, -1 = left

    // Camera
    let camY = 0;         // scrolls up as player climbs
    let highestY = 0;     // highest point reached

    // Game
    let lap = 1;
    let lapProgress = 0;  // 0-100 per lap
    let totalGain = 0;    // total ft gained
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-avalanche-high') || '0');

    // Altitude sickness
    let sickness = 0;     // 0-100, increases with altitude per lap

    // Platforms (procedurally generated)
    let platforms = [];
    let boulders = [];
    let nextPlatY = 0;

    // Constants
    const GRAVITY = 0.4;
    const JUMP_FORCE = -9;
    const MOVE_SPEED = 4;
    const PLAYER_W = 12;
    const PLAYER_H = 20;
    const LAP_HEIGHT = 2000; // pixels per lap
    const TOTAL_LAPS = 31;

    // Input
    let keys = {};
    document.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
        if (state === STATE.TITLE && (e.code === 'Space' || e.code === 'Enter')) startGame();
        if (state === STATE.GAMEOVER && (e.code === 'Space' || e.code === 'Enter')) state = STATE.TITLE;
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });

    // Touch controls
    let touchLeft = false, touchRight = false, touchJump = false;
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { state = STATE.TITLE; return; }
        for (const t of e.touches) {
            if (t.clientY > canvas.height * 0.6) {
                if (t.clientX < canvas.width / 3) touchLeft = true;
                else if (t.clientX > canvas.width * 2 / 3) touchRight = true;
                else touchJump = true;
            } else {
                touchJump = true;
            }
        }
    });
    canvas.addEventListener('touchend', e => {
        touchLeft = false; touchRight = false; touchJump = false;
    });

    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { state = STATE.TITLE; return; }
    });

    function startGame() {
        state = STATE.PLAYING;
        px = canvas.width / 2;
        py = 0;
        pvx = 0;
        pvy = 0;
        camY = 200;
        highestY = 0;
        lap = 1;
        lapProgress = 0;
        totalGain = 0;
        sickness = 0;
        score = 0;
        platforms = [];
        boulders = [];
        nextPlatY = 0;

        // Generate initial platforms
        generatePlatforms(-canvas.height * 2);
    }

    function generatePlatforms(upToY) {
        while (nextPlatY > upToY) {
            const platW = 40 + Math.random() * 80;
            const platX = Math.random() * (canvas.width - platW);

            // Make platforms harder to reach in later laps
            const gap = 40 + Math.random() * 30 + Math.min(lap * 2, 30);

            platforms.push({
                x: platX,
                y: nextPlatY,
                w: platW,
                h: 8,
                type: Math.random() > 0.8 ? 'ice' : (Math.random() > 0.7 ? 'crumble' : 'solid'),
                crumbleTimer: 0,
            });

            nextPlatY -= gap;
        }
    }

    function spawnBoulder() {
        boulders.push({
            x: Math.random() * canvas.width,
            y: camY - canvas.height - 50,
            size: 10 + Math.random() * 15,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 2 + lap * 0.1,
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 0.2,
        });
    }

    function update() {
        if (state !== STATE.PLAYING) return;

        const w = canvas.width;

        // Input
        let moveDir = 0;
        if (keys['ArrowLeft'] || keys['KeyA'] || touchLeft) moveDir = -1;
        if (keys['ArrowRight'] || keys['KeyD'] || touchRight) moveDir = 1;
        const jumping = keys['ArrowUp'] || keys['Space'] || keys['KeyW'] || touchJump;

        // Altitude sickness effects (controls get sluggish)
        const sicknessSlug = Math.max(0.3, 1 - sickness / 150);
        pvx = moveDir * MOVE_SPEED * sicknessSlug;

        // Gravity
        pvy += GRAVITY;

        // Jump
        if (jumping && onGround && canJump) {
            pvy = JUMP_FORCE * sicknessSlug;
            onGround = false;
            canJump = false;
        }
        if (!jumping) canJump = true;

        // Apply velocity
        px += pvx;
        py += pvy;

        // Wrap horizontal
        if (px < 0) px = w;
        if (px > w) px = 0;

        if (moveDir !== 0) facing = moveDir;

        // Platform collision
        onGround = false;
        for (const plat of platforms) {
            if (pvy > 0 &&
                px + PLAYER_W / 2 > plat.x &&
                px - PLAYER_W / 2 < plat.x + plat.w &&
                py + PLAYER_H > plat.y &&
                py + PLAYER_H < plat.y + plat.h + pvy + 2) {

                py = plat.y - PLAYER_H;
                pvy = 0;
                onGround = true;

                // Ice = slippery
                if (plat.type === 'ice') {
                    pvx += (Math.random() - 0.5) * 3;
                }

                // Crumble = falls after standing on it
                if (plat.type === 'crumble') {
                    plat.crumbleTimer++;
                    if (plat.crumbleTimer > 30) {
                        plat.y += 100; // drop it off screen
                    }
                }
            }
        }

        // Track height progress
        if (py < highestY) {
            const gained = highestY - py;
            highestY = py;
            totalGain += gained * 2; // scale pixels to "feet"

            // Lap progress
            lapProgress = (((-highestY) % LAP_HEIGHT) / LAP_HEIGHT) * 100;
            lap = Math.floor(-highestY / LAP_HEIGHT) + 1;

            // Altitude sickness increases each lap
            sickness = Math.min(100, (lap - 1) * 4);

            score = lap - 1;
        }

        // Camera follows player upward
        const targetCamY = py + canvas.height * 0.3;
        if (targetCamY < camY) {
            camY += (targetCamY - camY) * 0.1;
        }

        // Generate more platforms as we climb
        generatePlatforms(camY - canvas.height * 2);

        // Clean up old platforms and boulders below screen
        platforms = platforms.filter(p => p.y < camY + canvas.height);
        boulders = boulders.filter(b => b.y < camY + canvas.height);

        // Spawn boulders (more frequent in later laps)
        if (Math.random() < 0.005 + lap * 0.003) {
            spawnBoulder();
        }

        // Update boulders
        for (const b of boulders) {
            b.x += b.vx;
            b.y += b.vy;
            b.rotation += b.rotSpeed;

            // Bounce off walls
            if (b.x < 0 || b.x > w) b.vx *= -1;

            // Boulder-player collision
            const dx = b.x - px;
            const dy = b.y - (py + PLAYER_H / 2);
            if (Math.sqrt(dx * dx + dy * dy) < b.size / 2 + PLAYER_W / 2) {
                // Hit! Push player down
                pvy = 5;
                py += 10;
                sickness = Math.min(100, sickness + 5);
            }
        }

        // Fall death (fell too far below camera)
        if (py > camY + canvas.height + 100) {
            endGame();
        }

        // Win condition
        if (lap > TOTAL_LAPS) {
            endGame();
        }
    }

    function endGame() {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('puke-avalanche-high', highScore.toString());
        }
        state = STATE.GAMEOVER;
    }

    // Draw
    function drawBackground() {
        const w = canvas.width, h = canvas.height;

        // Sky gradient (gets darker higher up)
        const skyDark = Math.min(1, lap / 15);
        const r = Math.round(42 - skyDark * 20);
        const g = Math.round(58 - skyDark * 20);
        const b = Math.round(90 - skyDark * 20);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, w, h);

        // Snow particles at higher altitudes
        if (lap > 3) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            for (let i = 0; i < lap * 2; i++) {
                const sx = (i * 97 + Date.now() * 0.02 * (i % 3 + 1)) % w;
                const sy = (i * 53 + Date.now() * 0.03) % h;
                ctx.fillRect(sx, sy, 2, 2);
            }
        }

        // Mountain walls (parallax)
        ctx.fillStyle = '#3a3a4a';
        for (let i = 0; i < 8; i++) {
            const wallY = ((i * 200 - camY * 0.3) % (h + 200)) - 100;
            ctx.fillRect(0, wallY, 15, 120);
            ctx.fillRect(w - 15, wallY + 60, 15, 120);
        }
    }

    function drawPlatforms() {
        for (const plat of platforms) {
            const screenY = plat.y - camY;
            if (screenY < -20 || screenY > canvas.height + 20) continue;

            switch(plat.type) {
                case 'solid':
                    ctx.fillStyle = C.ledge;
                    ctx.fillRect(plat.x, screenY, plat.w, plat.h);
                    // Rocky texture
                    ctx.fillStyle = '#6a6a4a';
                    ctx.fillRect(plat.x + 2, screenY + 1, plat.w * 0.3, 3);
                    ctx.fillRect(plat.x + plat.w * 0.5, screenY + 2, plat.w * 0.3, 2);
                    break;
                case 'ice':
                    ctx.fillStyle = C.ice;
                    ctx.fillRect(plat.x, screenY, plat.w, plat.h);
                    // Shine
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(plat.x + 3, screenY + 1, plat.w * 0.4, 2);
                    break;
                case 'crumble':
                    const crumbleAlpha = Math.max(0.3, 1 - plat.crumbleTimer / 30);
                    ctx.globalAlpha = crumbleAlpha;
                    ctx.fillStyle = '#9a8a6a';
                    ctx.fillRect(plat.x, screenY, plat.w, plat.h);
                    // Cracks
                    ctx.strokeStyle = '#5a4a3a';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(plat.x + plat.w * 0.3, screenY);
                    ctx.lineTo(plat.x + plat.w * 0.4, screenY + plat.h);
                    ctx.moveTo(plat.x + plat.w * 0.7, screenY);
                    ctx.lineTo(plat.x + plat.w * 0.6, screenY + plat.h);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    break;
            }
        }
    }

    function drawBoulders() {
        for (const b of boulders) {
            const screenY = b.y - camY;
            if (screenY < -50 || screenY > canvas.height + 50) continue;

            ctx.save();
            ctx.translate(b.x, screenY);
            ctx.rotate(b.rotation);

            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.arc(0, 0, b.size / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.arc(-2, -2, b.size / 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    function drawPlayer() {
        const screenY = py - camY;
        const bob = onGround ? 0 : Math.sin(Date.now() / 100) * 1;

        ctx.save();
        ctx.translate(px, screenY + bob);

        // Altitude sickness visual (screen wobble handled elsewhere)
        const sicknessShake = sickness > 50 ? Math.sin(Date.now() / 100) * (sickness / 50) : 0;
        ctx.translate(sicknessShake, 0);

        // Body
        ctx.fillStyle = C.runner;
        ctx.fillRect(-PLAYER_W / 2, 0, PLAYER_W, PLAYER_H);

        // Head
        ctx.fillRect(-5, -8, 10, 8);

        // Eyes
        ctx.fillStyle = sickness > 60 ? '#9acd32' : '#000';
        ctx.fillRect(facing > 0 ? 0 : -4, -6, 2, 2);

        // Arms reaching up (climbing pose)
        ctx.fillStyle = C.runner;
        const armPhase = Math.sin(Date.now() / 200);
        ctx.fillRect(-PLAYER_W / 2 - 4, -3 + armPhase * 3, 4, 10);
        ctx.fillRect(PLAYER_W / 2, -3 - armPhase * 3, 4, 10);

        // Legs
        const legPhase = onGround ? 0 : Math.sin(Date.now() / 150);
        ctx.fillRect(-4, PLAYER_H, 4, 8 + legPhase * 2);
        ctx.fillRect(1, PLAYER_H, 4, 8 - legPhase * 2);

        ctx.restore();
    }

    function drawHUD() {
        const w = canvas.width;

        // Altitude sickness screen wobble
        if (sickness > 40) {
            const wobble = Math.sin(Date.now() / 500) * (sickness - 40) * 0.02;
            ctx.save();
            ctx.translate(wobble, 0);
        }

        ctx.font = '10px "Press Start 2P", monospace';

        // Lap counter
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('LAP ' + Math.min(lap, TOTAL_LAPS) + '/' + TOTAL_LAPS, 60, 25);

        // Lap progress bar
        ctx.fillStyle = C.dark;
        ctx.fillRect(60, 30, 120, 8);
        ctx.fillStyle = C.text;
        ctx.fillRect(60, 30, 120 * (lapProgress / 100), 8);
        ctx.strokeStyle = C.textDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(60, 30, 120, 8);

        // Total elevation
        ctx.textAlign = 'right';
        ctx.fillStyle = '#dde8f0';
        ctx.fillText(Math.floor(totalGain) + ' FT', w - 20, 25);

        // Soul crushing meter
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('SOUL CRUSHING', w / 2, 20);

        ctx.fillStyle = C.dark;
        ctx.fillRect(w / 2 - 50, 24, 100, 8);
        const soulFrac = Math.min(lap, TOTAL_LAPS) / TOTAL_LAPS;
        ctx.fillStyle = soulFrac > 0.7 ? C.danger : soulFrac > 0.4 ? '#f1c40f' : C.text;
        ctx.fillRect(w / 2 - 50, 24, 100 * soulFrac, 8);

        // Altitude sickness indicator
        if (sickness > 20) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = sickness > 60 ? C.danger : '#f1c40f';
            ctx.textAlign = 'left';
            ctx.fillText('ALTITUDE SICKNESS: ' + Math.floor(sickness) + '%', 60, 52);
        }

        // Touch controls hint
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('ARROWS/WASD  SPACE=JUMP', w / 2, canvas.height - 10);

        if (sickness > 40) ctx.restore();
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        // Mountain backdrop
        ctx.fillStyle = C.mountain;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.2, h * 0.3);
        ctx.lineTo(w * 0.35, h * 0.5);
        ctx.lineTo(w * 0.5, h * 0.15);
        ctx.lineTo(w * 0.65, h * 0.4);
        ctx.lineTo(w * 0.8, h * 0.25);
        ctx.lineTo(w, h);
        ctx.fill();

        // Snow caps
        ctx.fillStyle = C.snow;
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.2);
        ctx.lineTo(w * 0.5, h * 0.15);
        ctx.lineTo(w * 0.55, h * 0.2);
        ctx.fill();

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('AVALANCHE', w / 2, h * 0.08 + 14);
        ctx.fillText('SCRAMBLE', w / 2, h * 0.08 + 44);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.snow;
        ctx.fillText('31 laps of Kendall Mountain.', w / 2, h * 0.5);
        ctx.fillText('116,188 ft of elevation gain.', w / 2, h * 0.5 + 20);
        ctx.fillText('45% grade. Boulder scrambling. Altitude sickness.', w / 2, h * 0.5 + 40);
        ctx.fillText('Nobody will finish all 31.', w / 2, h * 0.5 + 60);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP / PRESS SPACE', w / 2, h * 0.74);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('ARROWS/WASD = Move  |  SPACE/UP = Jump', w / 2, h * 0.84);
        ctx.fillText('Ice platforms are slippery. Crumbly ones break.', w / 2, h * 0.84 + 18);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('BEST: LAP ' + highScore, w / 2, h * 0.94);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(26, 26, 42, 0.92)';
        ctx.fillRect(0, 0, w, h);

        const won = lap > TOTAL_LAPS;

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = won ? '#f1c40f' : C.danger;
        ctx.textAlign = 'center';
        ctx.fillText(won ? 'ALL 31 LAPS!' : 'FELL OFF', w / 2, h * 0.2);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#dde8f0';
        ctx.fillText('LAP ' + Math.min(score, TOTAL_LAPS), w / 2, h * 0.33);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText(Math.floor(totalGain) + ' FT GAINED', w / 2, h * 0.33 + 25);

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('NEW RECORD!', w / 2, h * 0.33 + 48);
        }

        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = C.snow;
        let flavor = '';
        if (won) flavor = 'You did the impossible. Kendall Mountain bows.';
        else if (score >= 20) flavor = 'So close to the summit. The mountain always wins eventually.';
        else if (score >= 10) flavor = 'Double digits. The altitude sickness is real.';
        else if (score >= 5) flavor = 'Solid effort. The boulders say hello.';
        else if (score >= 2) flavor = 'A few laps in. Kendall is just warming up.';
        else flavor = 'One lap? The parking lot was harder.';
        ctx.fillText(flavor, w / 2, h * 0.55);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.72);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }

        drawBackground();
        drawPlatforms();
        drawBoulders();
        drawPlayer();
        drawHUD();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
