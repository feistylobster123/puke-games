// Sasquatch Chase - PUKE Games
// Night trail in the Mazatzals. Sasquatch appears in the darkness.
// Get close enough for a clear photo without spooking him.
// Obstacles slow you down. Score = best photo clarity rating.

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
        night: '#0a0505',
        treeDark: '#1a2e1a',
        treeLight: '#2d4a2d',
        trail: '#3a2a1a',
        headlamp: '#ffe4a0',
        runner: '#e87f24',
        sasquatch: '#4a3a2a',
        sasquatchEye: '#ff4444',
        text: '#e87f24',
        textDim: '#5c3a1e',
        rock: '#555',
        cactus: '#3a5a2a',
        flash: '#fff',
        star: '#ddd',
    };

    const STATE = { TITLE: 0, RUNNING: 1, PHOTO: 2, REVIEW: 3, GAMEOVER: 4 };
    let state = STATE.TITLE;

    // Game vars
    let playerX = 0;         // horizontal position on trail
    let playerSpeed = 0;
    let distance = 0;        // total distance run
    let sasquatchDist = 300;  // distance ahead of player
    let sasquatchVisible = false;
    let sasquatchSkittish = 1.0; // multiplier, increases each round
    let sasquatchTimer = 0;
    let round = 1;

    // Photo
    let photoReady = true;
    let photoCooldown = 0;
    let lastPhotoClarity = 0;
    let bestClarity = 0;
    let photos = [];         // {clarity, round}
    let flashTimer = 0;

    // Obstacles
    let obstacles = [];      // {x, type, passed}
    let nextObstacle = 200;

    // Terrain scrolling
    let scrollX = 0;
    let trees = [];
    let stars = [];

    // Score
    let highScore = parseInt(localStorage.getItem('puke-sasquatch-high') || '0');

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Init stars
    function initStars() {
        stars = [];
        for (let i = 0; i < 80; i++) {
            stars.push({
                x: Math.random() * 1600,
                y: Math.random() * canvas.height * 0.4,
                size: Math.random() * 1.5 + 0.5,
                twinkle: Math.random() * Math.PI * 2,
            });
        }
    }

    // Init trees
    function initTrees() {
        trees = [];
        for (let i = 0; i < 60; i++) {
            trees.push({
                x: i * 50 + Math.random() * 30,
                height: 40 + Math.random() * 80,
                width: 15 + Math.random() * 15,
                layer: Math.random() > 0.5 ? 0 : 1, // foreground or background
            });
        }
    }

    // Generate obstacles
    function spawnObstacle() {
        const types = ['rock', 'cactus', 'wash', 'root'];
        obstacles.push({
            x: nextObstacle,
            type: types[Math.floor(Math.random() * types.length)],
            passed: false,
            width: 20 + Math.random() * 20,
        });
        nextObstacle += 80 + Math.random() * 150;
    }

    initStars();
    initTrees();

    // Input
    let holdingRun = false;

    document.addEventListener('keydown', e => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (state === STATE.TITLE) { startGame(); return; }
            if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
            if (state === STATE.REVIEW) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; nextRound(); return; }
            holdingRun = true;
        }
        if (e.code === 'KeyF' || e.code === 'Enter') {
            e.preventDefault();
            if (state === STATE.RUNNING) takePhoto();
        }
    });
    document.addEventListener('keyup', e => {
        if (e.code === 'Space') holdingRun = false;
    });

    // Touch: left half = run, right half = photo
    let touchRun = false;
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.REVIEW) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; nextRound(); return; }

        const touch = e.touches[0];
        if (touch.clientX > canvas.width / 2) {
            takePhoto();
        } else {
            touchRun = true;
            holdingRun = true;
        }
    });
    canvas.addEventListener('touchend', e => {
        touchRun = false;
        holdingRun = false;
    });
    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.REVIEW) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; nextRound(); return; }
        if (e.clientX > canvas.width / 2) takePhoto();
        else holdingRun = true;
    });
    canvas.addEventListener('mouseup', () => { holdingRun = false; });

    function startGame() {
        state = STATE.RUNNING;
        playerX = 0;
        playerSpeed = 0;
        distance = 0;
        sasquatchDist = 250 + Math.random() * 100;
        sasquatchVisible = false;
        sasquatchSkittish = 1.0;
        sasquatchTimer = 0;
        round = 1;
        photoReady = true;
        photoCooldown = 0;
        lastPhotoClarity = 0;
        bestClarity = 0;
        photos = [];
        obstacles = [];
        nextObstacle = 200;
        flashTimer = 0;
        initTrees();
    }

    function nextRound() {
        state = STATE.RUNNING;
        round++;
        sasquatchDist = 200 + Math.random() * 150;
        sasquatchVisible = false;
        sasquatchTimer = 0;
        sasquatchSkittish = 1.0 + round * 0.3; // gets more skittish each round
        photoReady = true;
        photoCooldown = 0;
    }

    function takePhoto() {
        if (!photoReady || photoCooldown > 0) return;

        flashTimer = 10;
        photoCooldown = 90; // 1.5 sec cooldown

        // Calculate clarity based on distance to sasquatch
        let clarity = 0;
        if (sasquatchVisible) {
            // Closer = clearer. Perfect at ~30 distance, blurry at 200+
            if (sasquatchDist < 30) clarity = 95 + Math.random() * 5;
            else if (sasquatchDist < 60) clarity = 80 + Math.random() * 15;
            else if (sasquatchDist < 100) clarity = 50 + Math.random() * 20;
            else if (sasquatchDist < 150) clarity = 20 + Math.random() * 20;
            else clarity = 5 + Math.random() * 10;
        } else {
            clarity = Math.random() * 3; // nothing there, just darkness
        }

        clarity = Math.round(clarity);
        lastPhotoClarity = clarity;
        photos.push({ clarity, round });

        if (clarity > bestClarity) {
            bestClarity = clarity;
            if (bestClarity > highScore) {
                highScore = bestClarity;
                localStorage.setItem('puke-sasquatch-high', highScore.toString());
            }
        }

        // Flash spooks sasquatch
        if (sasquatchVisible && sasquatchDist < 120) {
            // Close flash = big spook
            const spookForce = (120 - sasquatchDist) * 0.8 * sasquatchSkittish;
            sasquatchDist += spookForce;
            if (spookForce > 40) {
                sasquatchVisible = false;
                sasquatchTimer = 180 + Math.random() * 180; // disappears for a while
            }
        }

        // Show review screen
        state = STATE.REVIEW;
        popupEnteredAt = Date.now();
    }

    // Update
    function update() {
        if (state !== STATE.RUNNING) return;

        // Player movement
        if (holdingRun) {
            playerSpeed = Math.min(5, playerSpeed + 0.3);
        } else {
            playerSpeed *= 0.95;
        }

        // Check obstacles
        let slowed = false;
        for (const obs of obstacles) {
            const relX = obs.x - distance;
            if (relX > -10 && relX < obs.width && playerSpeed > 1) {
                playerSpeed *= 0.7;
                slowed = true;
            }
        }

        distance += playerSpeed;
        scrollX = distance;

        // Spawn obstacles
        while (nextObstacle < distance + canvas.width) {
            spawnObstacle();
        }

        // Sasquatch AI
        if (!sasquatchVisible) {
            sasquatchTimer--;
            if (sasquatchTimer <= 0) {
                sasquatchVisible = true;
                sasquatchDist = 150 + Math.random() * 200;
            }
        } else {
            // Sasquatch moves -- sometimes closer, sometimes farther
            // He's curious but skittish
            if (sasquatchDist > 80) {
                // Wander closer slowly
                sasquatchDist -= 0.2 + Math.random() * 0.3;
            }

            // If player runs fast, sasquatch notices
            if (playerSpeed > 3.5) {
                sasquatchDist += playerSpeed * 0.3 * sasquatchSkittish;
            }

            // Random movements
            sasquatchDist += (Math.random() - 0.5) * 2;

            // If too close, bolt
            if (sasquatchDist < 20) {
                sasquatchDist += 50 * sasquatchSkittish;
                if (Math.random() > 0.5) {
                    sasquatchVisible = false;
                    sasquatchTimer = 120 + Math.random() * 120;
                }
            }

            // If way too far, disappear
            if (sasquatchDist > 400) {
                sasquatchVisible = false;
                sasquatchTimer = 60 + Math.random() * 120;
            }
        }

        // Photo cooldown
        if (photoCooldown > 0) photoCooldown--;

        // Flash timer
        if (flashTimer > 0) flashTimer--;

        // Round ends after running enough distance (auto, after some time)
        if (distance > (round * 800 + 600) && !sasquatchVisible) {
            // Sasquatch has been gone too long, round over
            if (photos.length >= round) {
                if (round >= 5) {
                    state = STATE.GAMEOVER;
                    popupEnteredAt = Date.now();
                }
            }
        }

        // Game ends after 5 rounds
        if (round > 5) {
            state = STATE.GAMEOVER;
            popupEnteredAt = Date.now();
        }
    }

    // Draw
    function drawNightSky() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = C.night;
        ctx.fillRect(0, 0, w, h);

        // Stars
        stars.forEach(s => {
            const sx = ((s.x - scrollX * 0.05) % w + w) % w;
            const twinkle = Math.sin(Date.now() / 300 + s.twinkle) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(220,220,220,${twinkle})`;
            ctx.fillRect(sx, s.y, s.size, s.size);
        });

        // Moon
        ctx.fillStyle = '#ddd';
        ctx.beginPath();
        ctx.arc(w * 0.85, 50, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.night;
        ctx.beginPath();
        ctx.arc(w * 0.85 + 5, 47, 13, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawTrees() {
        const w = canvas.width, h = canvas.height;
        const trailY = h * 0.72;

        trees.forEach(t => {
            const tx = ((t.x - scrollX * (t.layer === 0 ? 0.3 : 0.15)) % 1600 + 1600) % 1600 - 200;
            if (tx < -50 || tx > w + 50) return;

            const shade = t.layer === 0 ? C.treeDark : '#0f1f0f';
            ctx.fillStyle = shade;

            // Tree trunk
            ctx.fillRect(tx - 3, trailY - t.height, 6, t.height);

            // Canopy (triangle)
            ctx.beginPath();
            ctx.moveTo(tx - t.width / 2, trailY - t.height + 20);
            ctx.lineTo(tx + t.width / 2, trailY - t.height + 20);
            ctx.lineTo(tx, trailY - t.height - 20);
            ctx.fill();
        });
    }

    function drawTrail() {
        const w = canvas.width, h = canvas.height;
        const trailY = h * 0.72;

        // Trail
        ctx.fillStyle = C.trail;
        ctx.fillRect(0, trailY, w, 40);

        // Trail texture
        ctx.fillStyle = '#2a1a0a';
        for (let i = 0; i < 20; i++) {
            const rx = ((i * 67 + scrollX * 0.5) % w + w) % w;
            ctx.fillRect(rx, trailY + 5 + (i % 3) * 10, 8, 2);
        }

        // Ground
        ctx.fillStyle = '#1a0f05';
        ctx.fillRect(0, trailY + 40, w, h - trailY - 40);
    }

    function drawObstacles() {
        const w = canvas.width, h = canvas.height;
        const trailY = h * 0.72;

        obstacles.forEach(obs => {
            const ox = obs.x - distance + 100; // relative to player
            if (ox < -50 || ox > w + 50) return;

            switch(obs.type) {
                case 'rock':
                    ctx.fillStyle = C.rock;
                    ctx.beginPath();
                    ctx.moveTo(ox, trailY + 30);
                    ctx.lineTo(ox + obs.width / 2, trailY + 10);
                    ctx.lineTo(ox + obs.width, trailY + 30);
                    ctx.fill();
                    break;
                case 'cactus':
                    ctx.fillStyle = C.cactus;
                    ctx.fillRect(ox + 5, trailY + 5, 4, 20);
                    ctx.fillRect(ox, trailY + 10, 4, 8);
                    ctx.fillRect(ox + 10, trailY + 8, 4, 10);
                    break;
                case 'wash':
                    ctx.fillStyle = '#2a3a4a';
                    ctx.fillRect(ox, trailY + 15, obs.width, 10);
                    // Water ripples
                    ctx.strokeStyle = '#4a5a6a';
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(ox + i * 8, trailY + 18);
                        ctx.quadraticCurveTo(ox + i * 8 + 4, trailY + 16, ox + i * 8 + 8, trailY + 18);
                        ctx.stroke();
                    }
                    break;
                case 'root':
                    ctx.strokeStyle = '#5a4a3a';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(ox, trailY + 25);
                    ctx.quadraticCurveTo(ox + obs.width / 2, trailY + 15, ox + obs.width, trailY + 28);
                    ctx.stroke();
                    break;
            }
        });
    }

    function drawHeadlamp() {
        const w = canvas.width, h = canvas.height;
        const trailY = h * 0.72;
        const playerScreenX = 100;

        // Headlamp cone
        const grad = ctx.createRadialGradient(
            playerScreenX + 20, trailY + 10, 5,
            playerScreenX + 20, trailY + 10, 250
        );
        grad.addColorStop(0, 'rgba(255, 228, 160, 0.25)');
        grad.addColorStop(0.4, 'rgba(255, 228, 160, 0.08)');
        grad.addColorStop(1, 'rgba(255, 228, 160, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(playerScreenX + 10, trailY);
        ctx.lineTo(playerScreenX + 350, trailY - 100);
        ctx.lineTo(playerScreenX + 350, trailY + 100);
        ctx.closePath();
        ctx.fill();

        // Darkness mask (everything outside headlamp)
        ctx.fillStyle = 'rgba(10, 5, 5, 0.6)';
        ctx.fillRect(0, 0, playerScreenX - 20, h);
        ctx.fillRect(playerScreenX + 300, 0, w - playerScreenX - 300, h * 0.65);
    }

    function drawPlayer() {
        const h = canvas.height;
        const trailY = h * 0.72;
        const px = 100;
        const bob = playerSpeed > 0.5 ? Math.sin(distance * 0.15) * 3 : 0;

        ctx.save();
        ctx.translate(px, trailY + 15 + bob);

        // Body
        ctx.fillStyle = C.runner;
        ctx.fillRect(-5, -24, 10, 16);
        // Head
        ctx.fillRect(-4, -32, 8, 8);
        // Headlamp
        ctx.fillStyle = C.headlamp;
        ctx.fillRect(2, -30, 4, 3);

        // Arms (one holding phone/camera)
        ctx.fillStyle = C.runner;
        ctx.fillRect(6, -22, 10, 4);
        // Phone
        ctx.fillStyle = '#333';
        ctx.fillRect(14, -24, 6, 10);
        ctx.fillStyle = photoCooldown > 0 ? '#666' : '#88f';
        ctx.fillRect(15, -23, 4, 8);

        // Legs
        const legPhase = Math.sin(distance * 0.15);
        ctx.fillStyle = C.runner;
        ctx.save();
        ctx.translate(-3, -8);
        ctx.rotate(legPhase * 0.3);
        ctx.fillRect(-2, 0, 4, 12);
        ctx.restore();
        ctx.save();
        ctx.translate(3, -8);
        ctx.rotate(-legPhase * 0.3);
        ctx.fillRect(-2, 0, 4, 12);
        ctx.restore();

        ctx.restore();
    }

    function drawSasquatch() {
        if (!sasquatchVisible) return;

        const h = canvas.height;
        const trailY = h * 0.72;
        const screenX = 100 + sasquatchDist * 1.2; // scale distance to screen space

        if (screenX > canvas.width + 50 || screenX < 0) return;

        // Distance affects visibility and size
        const scale = Math.max(0.3, 1 - sasquatchDist / 300);
        const alpha = Math.max(0.1, Math.min(0.9, 1 - sasquatchDist / 250));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(screenX, trailY + 10);
        ctx.scale(scale, scale);

        // Big dark figure
        ctx.fillStyle = C.sasquatch;
        // Body (large, hunched)
        ctx.fillRect(-12, -50, 24, 35);
        // Head
        ctx.beginPath();
        ctx.arc(0, -55, 10, 0, Math.PI * 2);
        ctx.fill();
        // Arms (long)
        ctx.fillRect(-18, -40, 8, 25);
        ctx.fillRect(10, -40, 8, 25);
        // Legs
        ctx.fillRect(-10, -15, 8, 20);
        ctx.fillRect(2, -15, 8, 20);

        // Eyes (red glint when close)
        if (sasquatchDist < 120) {
            ctx.fillStyle = C.sasquatchEye;
            ctx.fillRect(-5, -58, 3, 2);
            ctx.fillRect(2, -58, 3, 2);
        }

        // Fur texture
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-10 + i * 5, -48);
            ctx.lineTo(-10 + i * 5 + 2, -42);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawFlash() {
        if (flashTimer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashTimer / 10 * 0.5})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '10px "Press Start 2P", monospace';

        // Round
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('ROUND ' + round + '/5', 60, 25);

        // Best photo
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('BEST: ' + bestClarity + '%', w - 20, 25);

        // Camera status
        ctx.textAlign = 'center';
        if (photoCooldown > 0) {
            ctx.fillStyle = C.textDim;
            ctx.fillText('RELOADING...', w / 2, 25);
        } else {
            ctx.fillStyle = C.headlamp;
            ctx.fillText('CAMERA READY', w / 2, 25);
        }

        // Sasquatch distance hint
        if (sasquatchVisible && sasquatchDist < 200) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = sasquatchDist < 60 ? '#ff4444' : sasquatchDist < 120 ? '#f1c40f' : C.textDim;
            ctx.textAlign = 'left';
            const hint = sasquatchDist < 60 ? 'VERY CLOSE!' : sasquatchDist < 120 ? 'NEARBY' : 'IN THE DISTANCE';
            ctx.fillText(hint, 60, 42);
        }

        // Controls reminder
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('HOLD SPACE=RUN  F=PHOTO', w / 2, canvas.height - 10);
    }

    function drawReview() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(10, 5, 5, 0.9)';
        ctx.fillRect(0, 0, w, h);

        // Photo frame
        const frameW = 240;
        const frameH = 180;
        const fx = w / 2 - frameW / 2;
        const fy = h * 0.15;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(fx, fy, frameW, frameH);

        // Photo content (blurry sasquatch based on clarity)
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(fx + 2, fy + 2, frameW - 4, frameH - 4);

        if (lastPhotoClarity > 5) {
            // Draw sasquatch at varying blur levels
            const blur = Math.max(0, (100 - lastPhotoClarity) / 15);
            ctx.save();
            ctx.translate(fx + frameW / 2, fy + frameH / 2 + 20);

            // "Blur" by drawing multiple offset copies
            for (let b = 0; b < blur; b++) {
                ctx.globalAlpha = 0.2;
                const ox = (Math.random() - 0.5) * blur * 2;
                const oy = (Math.random() - 0.5) * blur * 2;
                ctx.fillStyle = C.sasquatch;
                ctx.fillRect(-12 + ox, -50 + oy, 24, 35);
                ctx.beginPath();
                ctx.arc(ox, -55 + oy, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(-18 + ox, -40 + oy, 8, 25);
                ctx.fillRect(10 + ox, -40 + oy, 8, 25);
            }

            // Main image
            ctx.globalAlpha = Math.min(1, lastPhotoClarity / 60);
            ctx.fillStyle = C.sasquatch;
            ctx.fillRect(-12, -50, 24, 35);
            ctx.beginPath();
            ctx.arc(0, -55, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-18, -40, 8, 25);
            ctx.fillRect(10, -40, 8, 25);
            ctx.fillRect(-10, -15, 8, 20);
            ctx.fillRect(2, -15, 8, 20);

            if (lastPhotoClarity > 50) {
                ctx.fillStyle = C.sasquatchEye;
                ctx.fillRect(-5, -58, 3, 2);
                ctx.fillRect(2, -58, 3, 2);
            }

            ctx.restore();

            // Trees in background of photo
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = C.treeDark;
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(fx + 20 + i * 45, fy + 10, 6, 80);
                ctx.beginPath();
                ctx.moveTo(fx + 10 + i * 45, fy + 40);
                ctx.lineTo(fx + 30 + i * 45, fy + 40);
                ctx.lineTo(fx + 20 + i * 45, fy + 10);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else {
            // Just darkness
            ctx.font = '14px "VT323", monospace';
            ctx.fillStyle = '#444';
            ctx.textAlign = 'center';
            ctx.fillText('just darkness...', w / 2, fy + frameH / 2);
        }

        // Clarity rating
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        let clarityColor = C.textDim;
        let clarityLabel = 'NOTHING';
        if (lastPhotoClarity >= 90) { clarityColor = '#f1c40f'; clarityLabel = 'CRYSTAL CLEAR!'; }
        else if (lastPhotoClarity >= 70) { clarityColor = '#9acd32'; clarityLabel = 'GOOD SHOT!'; }
        else if (lastPhotoClarity >= 50) { clarityColor = C.text; clarityLabel = 'DECENT'; }
        else if (lastPhotoClarity >= 25) { clarityColor = '#d2b48c'; clarityLabel = 'BLURRY'; }
        else if (lastPhotoClarity >= 10) { clarityColor = C.textDim; clarityLabel = 'IS THAT A BUSH?'; }
        else { clarityColor = C.textDim; }

        ctx.fillStyle = clarityColor;
        ctx.fillText(clarityLabel, w / 2, fy + frameH + 35);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(lastPhotoClarity + '% CLARITY', w / 2, fy + frameH + 60);

        // Best so far
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('BEST: ' + bestClarity + '%', w / 2, fy + frameH + 85);

        // Continue prompt
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) {
            const promptText = round >= 5 ? 'TAP FOR RESULTS' : 'TAP TO CONTINUE';
            ctx.fillText(promptText, w / 2, h * 0.85);
        }
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;
        drawNightSky();
        drawTrees();
        drawTrail();

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('SASQUATCH', w / 2, h * 0.18);
        ctx.fillText('CHASE', w / 2, h * 0.18 + 32);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('Night trail in the Mazatzals.', w / 2, h * 0.34);
        ctx.fillText('Sasquatch appears in the darkness.', w / 2, h * 0.34 + 20);
        ctx.fillText('Get close enough for a clear photo.', w / 2, h * 0.34 + 40);
        ctx.fillText('Too close and he bolts.', w / 2, h * 0.34 + 60);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.6);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('HOLD SPACE = Run  |  F / RIGHT TAP = Photo', w / 2, h * 0.72);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('BEST PHOTO: ' + highScore + '% CLARITY', w / 2, h * 0.85);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(10, 5, 5, 0.92)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('EXPEDITION OVER', w / 2, h * 0.15);

        // Photo gallery
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('YOUR PHOTOS:', w / 2, h * 0.25);

        photos.forEach((p, i) => {
            const y = h * 0.3 + i * 28;
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = p.clarity === bestClarity ? '#f1c40f' : C.textDim;
            ctx.textAlign = 'center';
            ctx.fillText('Round ' + p.round + ': ' + p.clarity + '% clarity', w / 2, y);
        });

        // Best result
        const resultY = h * 0.3 + photos.length * 28 + 30;
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('BEST SHOT: ' + bestClarity + '%', w / 2, resultY);

        // Rating
        ctx.font = '14px "VT323", monospace';
        let rating = '';
        if (bestClarity >= 90) rating = 'National Geographic would publish this.';
        else if (bestClarity >= 70) rating = 'Definitely something bipedal. Compelling evidence.';
        else if (bestClarity >= 50) rating = 'Could be bigfoot. Could be a bear. The internet will argue.';
        else if (bestClarity >= 30) rating = 'A dark blob. Like every other sasquatch photo ever.';
        else if (bestClarity >= 10) rating = 'You photographed a tree. Nice tree though.';
        else rating = 'Your camera roll is just darkness. Classic Mazatzal night.';

        ctx.fillStyle = '#d2b48c';
        ctx.fillText(rating, w / 2, resultY + 30);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.88);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }
        if (state === STATE.REVIEW) { drawReview(); return; }

        // Active gameplay
        drawNightSky();
        drawTrees();
        drawTrail();
        drawObstacles();
        drawSasquatch();
        drawHeadlamp();
        drawPlayer();
        drawFlash();
        drawHUD();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
