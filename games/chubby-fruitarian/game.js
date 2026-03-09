// Chubby Fruitarian - PUKE Games
// Run a marathon carrying 26.2 bananas (min 100g each).
// Physics-based balance. Eat one per mile. Stack wobbles.
// Aid stations toss more. Drop a banana = pick it up.

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
        sky: '#87CEEB',
        road: '#555',
        roadLine: '#f1c40f',
        runner: '#e87f24',
        banana: '#f1c40f',
        bananaDark: '#d4a017',
        text: '#e87f24',
        textDim: '#8b6914',
        green: '#6b8e23',
        cramp: '#c0392b',
        dark: '#2a1506',
        grass: '#5a8a2a',
    };

    const STATE = { TITLE: 0, RUNNING: 1, EATING: 2, PICKING: 3, GAMEOVER: 4 };
    let state = STATE.TITLE;

    // Player
    let mile = 0;           // current mile
    let mileProgress = 0;   // 0-100 within current mile
    let runSpeed = 0;
    let bananaCount = 5;    // start with 5, aid stations add more
    let bananasEaten = 0;
    let bananasToDrop = [];  // animations
    let droppedBananas = []; // on ground

    // Stack physics
    let stackTilt = 0;      // radians, how tilted the stack is
    let stackVel = 0;       // angular velocity
    let stackHeight = 0;    // visual height based on count

    // Cramp
    let crampLevel = 0;     // 0-100, eating too fast = cramp
    let crampTimer = 0;

    // Aid stations
    let nextAidMile = 3;
    let aidStationX = -100;
    let aidActive = false;
    let incomingBananas = []; // bananas flying from aid station

    // Road scroll
    let scrollX = 0;

    // Score
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-fruitarian-high') || '0');

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Input
    let keys = {};
    document.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'Space') {
            e.preventDefault();
            if (state === STATE.TITLE) startGame();
            else if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; }
            else if (state === STATE.RUNNING) eatBanana();
            else if (state === STATE.PICKING) pickUp();
        }
        if (e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'ArrowRight') keys.right = true;
    });
    document.addEventListener('keyup', e => {
        keys[e.code] = false;
        if (e.code === 'ArrowLeft') keys.left = false;
        if (e.code === 'ArrowRight') keys.right = false;
    });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.PICKING) { pickUp(); return; }

        const t = e.touches[0];
        if (t.clientX < canvas.width / 3) keys.left = true;
        else if (t.clientX > canvas.width * 2 / 3) keys.right = true;
        else eatBanana();
    });
    canvas.addEventListener('touchend', () => { keys.left = false; keys.right = false; });
    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.PICKING) { pickUp(); return; }
        if (e.clientX < canvas.width / 3) keys.left = true;
        else if (e.clientX > canvas.width * 2 / 3) keys.right = true;
        else eatBanana();
    });
    canvas.addEventListener('mouseup', () => { keys.left = false; keys.right = false; });

    function startGame() {
        state = STATE.RUNNING;
        mile = 0;
        mileProgress = 0;
        runSpeed = 0;
        bananaCount = 5;
        bananasEaten = 0;
        stackTilt = 0;
        stackVel = 0;
        crampLevel = 0;
        crampTimer = 0;
        nextAidMile = 3;
        droppedBananas = [];
        incomingBananas = [];
        bananasToDrop = [];
        scrollX = 0;
        score = 0;
    }

    function eatBanana() {
        if (bananaCount <= 0 || crampTimer > 0) return;
        bananaCount--;
        bananasEaten++;

        // Eating too fast = cramp risk
        crampLevel = Math.min(100, crampLevel + 25);
        if (crampLevel > 75 && Math.random() > 0.5) {
            crampTimer = 120; // 2 sec cramp
        }
    }

    function pickUp() {
        if (droppedBananas.length > 0) {
            droppedBananas.pop();
            bananaCount++;
            if (droppedBananas.length === 0) {
                state = STATE.RUNNING;
            }
        }
    }

    function dropBanana() {
        if (bananaCount <= 0) return;
        bananaCount--;
        droppedBananas.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 60,
            y: canvas.height * 0.65,
        });

        // If many dropped, force picking
        if (droppedBananas.length >= 3) {
            state = STATE.PICKING;
            runSpeed = 0;
        }
    }

    function update() {
        if (state === STATE.TITLE || state === STATE.GAMEOVER) return;

        if (state === STATE.PICKING) {
            // Can't run, picking up bananas
            return;
        }

        // Auto-run with tilt correction
        const baseSpeed = 2.5;
        const crampPenalty = crampTimer > 0 ? 0.3 : 1.0;
        const tiltPenalty = Math.max(0.3, 1 - Math.abs(stackTilt) * 2);

        runSpeed = baseSpeed * crampPenalty * tiltPenalty;
        mileProgress += runSpeed * 0.05;
        scrollX += runSpeed;

        // Mile complete
        if (mileProgress >= 100) {
            mileProgress = 0;
            mile++;
            score = mile;

            // Must eat one banana per mile
            if (bananasEaten < mile) {
                // Penalty: you forgot to eat!
                crampLevel = Math.min(100, crampLevel + 10);
            }

            // Marathon complete
            if (mile >= 26) {
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-fruitarian-high', highScore.toString());
                }
                state = STATE.GAMEOVER;
                popupEnteredAt = Date.now();
                return;
            }

            // Aid station every 3 miles
            if (mile >= nextAidMile) {
                nextAidMile = mile + 2 + Math.floor(Math.random() * 2);
                // Toss 2-4 bananas at you
                const tossCount = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < tossCount; i++) {
                    incomingBananas.push({
                        x: canvas.width + 50,
                        y: canvas.height * 0.2 + Math.random() * canvas.height * 0.2,
                        vx: -(4 + Math.random() * 3),
                        vy: -(2 + Math.random() * 4),
                        caught: false,
                    });
                }
            }
        }

        // Stack physics
        stackHeight = bananaCount * 4;

        // Tilt from movement
        if (keys.left) {
            stackVel -= 0.003;
        } else if (keys.right) {
            stackVel += 0.003;
        }

        // Random wobble (increases with banana count)
        stackVel += (Math.random() - 0.5) * 0.002 * Math.sqrt(bananaCount);

        // Running wobble
        stackVel += Math.sin(scrollX * 0.1) * 0.001 * bananaCount * 0.1;

        // Gravity restoring force
        stackVel -= stackTilt * 0.01;

        // Damping
        stackVel *= 0.97;

        stackTilt += stackVel;

        // Drop banana if tilted too far
        if (Math.abs(stackTilt) > 0.5 && bananaCount > 0) {
            dropBanana();
            stackTilt *= 0.7;
            stackVel *= -0.3;
        }

        // Clamp tilt
        stackTilt = Math.max(-0.8, Math.min(0.8, stackTilt));

        // Cramp timer
        if (crampTimer > 0) crampTimer--;

        // Cramp decay
        crampLevel = Math.max(0, crampLevel - 0.15);

        // Incoming bananas
        incomingBananas = incomingBananas.filter(b => {
            b.x += b.vx;
            b.y += b.vy;
            b.vy += 0.2; // gravity

            // Catch zone
            if (b.x < canvas.width / 2 + 30 && b.x > canvas.width / 2 - 30 &&
                b.y > canvas.height * 0.3 && b.y < canvas.height * 0.6 && !b.caught) {
                b.caught = true;
                bananaCount++;
                return false;
            }

            // Missed, falls to ground
            if (b.y > canvas.height * 0.7) {
                droppedBananas.push({ x: b.x, y: canvas.height * 0.65 });
                return false;
            }

            return b.x > -50;
        });

        // Game over: no bananas left and haven't eaten enough
        if (bananaCount <= 0 && droppedBananas.length === 0 && incomingBananas.length === 0 && bananasEaten < 26) {
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('puke-fruitarian-high', highScore.toString());
            }
            state = STATE.GAMEOVER;
            popupEnteredAt = Date.now();
        }
    }

    // Draw
    function drawScene() {
        const w = canvas.width, h = canvas.height;

        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(1, '#cce5f0');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Grass
        ctx.fillStyle = C.grass;
        ctx.fillRect(0, h * 0.6, w, h * 0.1);

        // Road
        ctx.fillStyle = C.road;
        ctx.fillRect(0, h * 0.68, w, h * 0.15);

        // Road lines
        ctx.strokeStyle = C.roadLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        const lineOffset = (-scrollX * 2) % 40;
        ctx.moveTo(lineOffset, h * 0.755);
        ctx.lineTo(w, h * 0.755);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dirt below road
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(0, h * 0.83, w, h * 0.17);

        // Mile markers
        const markerX = ((500 - scrollX * 2) % 500 + 500) % 500;
        ctx.fillStyle = '#fff';
        ctx.fillRect(markerX, h * 0.62, 3, h * 0.06);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MI ' + (mile + 1), markerX, h * 0.6);

        // Trees in background
        for (let i = 0; i < 5; i++) {
            const tx = ((i * 200 - scrollX * 0.3) % (w + 200) + w + 200) % (w + 200) - 100;
            ctx.fillStyle = '#4a7020';
            ctx.beginPath();
            ctx.moveTo(tx - 20, h * 0.6);
            ctx.lineTo(tx + 20, h * 0.6);
            ctx.lineTo(tx, h * 0.38);
            ctx.fill();
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(tx - 3, h * 0.58, 6, h * 0.04);
        }
    }

    function drawRunner() {
        const w = canvas.width, h = canvas.height;
        const rx = w / 2;
        const ry = h * 0.68;
        const bob = Math.sin(scrollX * 0.15) * 3;
        const legPhase = Math.sin(scrollX * 0.15);

        ctx.save();
        ctx.translate(rx, ry + bob);

        // Cramp visual
        if (crampTimer > 0) {
            ctx.translate(Math.sin(Date.now() / 50) * 2, 0);
        }

        // Body
        ctx.fillStyle = crampTimer > 0 ? C.cramp : C.runner;
        ctx.fillRect(-6, -30, 12, 20);
        // Head
        ctx.fillRect(-5, -38, 10, 8);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(-2, -35, 2, 2);
        ctx.fillRect(2, -35, 2, 2);
        // Arms (holding stack)
        ctx.fillStyle = C.runner;
        ctx.fillRect(-10, -28, 4, 8);
        ctx.fillRect(6, -28, 4, 8);

        // Banana stack on head
        drawBananaStack(0, -38);

        // Legs
        ctx.fillStyle = C.runner;
        ctx.save();
        ctx.translate(-3, -10);
        ctx.rotate(legPhase * 0.3);
        ctx.fillRect(-2, 0, 4, 14);
        ctx.restore();
        ctx.save();
        ctx.translate(3, -10);
        ctx.rotate(-legPhase * 0.3);
        ctx.fillRect(-2, 0, 4, 14);
        ctx.restore();

        ctx.restore();
    }

    function drawBananaStack(x, y) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(stackTilt);

        for (let i = 0; i < bananaCount; i++) {
            const by = -i * 5;
            const wobble = Math.sin(Date.now() / 300 + i * 0.7) * stackTilt * 10;

            ctx.fillStyle = C.banana;
            ctx.save();
            ctx.translate(wobble * (i * 0.15), by);
            ctx.rotate(stackTilt * (i * 0.05));

            // Banana shape
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 4, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Dark end
            ctx.fillStyle = C.bananaDark;
            ctx.fillRect(10, -2, 3, 2);

            ctx.restore();
        }

        ctx.restore();
    }

    function drawDroppedBananas() {
        droppedBananas.forEach(b => {
            ctx.fillStyle = C.banana;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(0.3);
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawIncomingBananas() {
        incomingBananas.forEach(b => {
            ctx.fillStyle = C.banana;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(Date.now() / 100);
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '10px "Press Start 2P", monospace';

        // Mile
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('MILE ' + (mile + 1) + '/26.2', 60, 25);

        // Mile progress
        ctx.fillStyle = C.dark;
        ctx.fillRect(60, 30, 120, 6);
        ctx.fillStyle = C.text;
        ctx.fillRect(60, 30, 120 * (mileProgress / 100), 6);

        // Banana count
        ctx.textAlign = 'right';
        ctx.fillStyle = C.banana;
        ctx.fillText('BANANAS: ' + bananaCount, w - 20, 25);

        // Eaten counter
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('EATEN: ' + bananasEaten + '/26', w - 20, 38);

        // Tilt indicator
        ctx.textAlign = 'center';
        ctx.font = '8px "Press Start 2P", monospace';

        const tiltPct = Math.abs(stackTilt) / 0.5 * 100;
        if (tiltPct > 60) {
            ctx.fillStyle = C.cramp;
            ctx.fillText('WOBBLING!', w / 2, 25);
        } else if (tiltPct > 30) {
            ctx.fillStyle = C.banana;
            ctx.fillText('TILTING', w / 2, 25);
        }

        // Cramp indicator
        if (crampLevel > 50) {
            ctx.fillStyle = crampTimer > 0 ? C.cramp : C.textDim;
            ctx.textAlign = 'center';
            ctx.fillText(crampTimer > 0 ? 'CRAMPING!' : 'CRAMP RISK', w / 2, 38);
        }

        // Controls
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('LEFT/RIGHT=BALANCE  SPACE=EAT', w / 2, canvas.height - 10);
    }

    function drawPicking() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.6)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = C.cramp;
        ctx.textAlign = 'center';
        ctx.fillText('DROPPED!', w / 2, h * 0.35);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText(droppedBananas.length + ' bananas on the ground', w / 2, h * 0.42);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.banana;
        const blink = Math.sin(Date.now() / 400) > 0;
        if (blink) ctx.fillText('TAP TO PICK UP', w / 2, h * 0.55);
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        // Banana pile
        for (let i = 0; i < 15; i++) {
            ctx.fillStyle = C.banana;
            ctx.save();
            ctx.translate(w / 2 + Math.sin(i * 2) * 40, h * 0.55 + Math.cos(i * 1.5) * 20);
            ctx.rotate(i * 0.5);
            ctx.beginPath();
            ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('CHUBBY', w / 2, h * 0.15);
        ctx.fillText('FRUITARIAN', w / 2, h * 0.15 + 28);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.banana;
        ctx.fillText('Run a marathon while eating 26.2 bananas.', w / 2, h * 0.32);
        ctx.fillText('Carry them on your head. Physics says no.', w / 2, h * 0.32 + 20);
        ctx.fillText('Aid stations keep tossing you more.', w / 2, h * 0.32 + 40);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.72);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('LEFT/RIGHT = Balance stack', w / 2, h * 0.82);
        ctx.fillText('SPACE/CENTER TAP = Eat a banana', w / 2, h * 0.82 + 18);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('BEST: MILE ' + highScore, w / 2, h * 0.94);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.92)';
        ctx.fillRect(0, 0, w, h);

        const won = mile >= 26;

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = won ? '#f1c40f' : C.cramp;
        ctx.textAlign = 'center';
        ctx.fillText(won ? 'MARATHON DONE!' : 'OUT OF BANANAS', w / 2, h * 0.2);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('MILE ' + score, w / 2, h * 0.35);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText(bananasEaten + ' BANANAS EATEN', w / 2, h * 0.35 + 25);

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('NEW RECORD!', w / 2, h * 0.35 + 48);
        }

        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = C.banana;
        let flavor = '';
        if (won) flavor = '26.2 bananas. 26.2 miles. You are the chubby fruitarian.';
        else if (score >= 20) flavor = 'So close. The banana gods were not kind.';
        else if (score >= 13) flavor = 'Half marathon of fruit. Respectable.';
        else if (score >= 5) flavor = 'A few miles. The stack had other plans.';
        else flavor = 'The bananas barely left the starting line.';
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

        drawScene();
        drawDroppedBananas();
        drawIncomingBananas();
        drawRunner();
        drawHUD();

        if (state === STATE.PICKING) {
            drawPicking();
        }
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
