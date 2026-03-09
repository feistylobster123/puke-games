// UDAM: Up and Down A Mountain - PUKE Games
// 100 miles. 800 loops of A Mountain at ASU, Tempe. July 4th.
// $8 in pennies entry fee. Metal spikes permitted. Tripping allowed.
// 100% Asphalt, 0% Flat. Pure Sisyphus.

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
        sky: '#ff8c42',
        skyHot: '#ff5722',
        asphalt: '#3a3a3a',
        asphaltHot: '#555',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#8b6914',
        penny: '#b87333',
        pennyShine: '#daa06d',
        firework: '#ff4444',
        heat: '#c0392b',
        dark: '#1a0a02',
        mountain: '#6a5a4a',
        sun: '#f1c40f',
        rival: '#c0392b',
    };

    const STATE = { TITLE: 0, CLIMBING: 1, DESCENDING: 2, TRIPPED: 3, GAMEOVER: 4 };
    let state = STATE.TITLE;

    // Game
    let loop = 0;            // current loop (0-799)
    let loopProgress = 0;    // 0-100 within loop
    let climbing = true;     // up or down
    let speed = 0;
    let pennies = 0;         // pennies collected (one per loop)
    let pennyWeight = 0;     // slows climb, 0-100
    let heat = 50;           // starts hot (July 4th)
    let exhaustion = 0;      // 0-100
    let tripTimer = 0;       // stunned from being tripped
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-udam-high') || '0');

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Rivals (other PUKE runners)
    let rivals = [];
    let rivalTripCooldown = 0;

    // Fireworks
    let fireworks = [];
    let fireworkTimer = 0;

    // Time
    let gameTime = 0;        // game seconds (starts at dawn July 4th)

    // Runner
    let runnerY = 0;
    let runnerBob = 0;

    // Mountain profile (A Mountain is short and steep)
    const MOUNTAIN_ANGLE = 0.45; // 45% grade

    // Input
    let tapRate = 0;
    let lastTapTime = 0;

    document.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            handleTap();
        }
    });
    canvas.addEventListener('touchstart', e => { e.preventDefault(); handleTap(); });
    canvas.addEventListener('mousedown', handleTap);

    function handleTap() {
        const now = Date.now();
        if (now - lastTapTime < 500) {
            tapRate = 1000 / (now - lastTapTime);
        } else {
            tapRate = 1;
        }
        lastTapTime = now;

        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.TRIPPED) return; // can't move while tripped

        doStride();
    }

    function startGame() {
        state = STATE.CLIMBING;
        loop = 0;
        loopProgress = 0;
        climbing = true;
        speed = 0;
        pennies = 0;
        pennyWeight = 0;
        heat = 50;
        exhaustion = 0;
        tripTimer = 0;
        score = 0;
        gameTime = 0;
        rivals = [];
        fireworks = [];

        // Spawn some rival runners
        for (let i = 0; i < 4; i++) {
            rivals.push({
                progress: Math.random() * 100,
                speed: 0.3 + Math.random() * 0.5,
                loopNum: Math.floor(Math.random() * 5),
                aggressive: Math.random() > 0.6,
                name: ['Spike', 'Razorfoot', 'Tripper', 'Pennybag'][i],
            });
        }
    }

    function doStride() {
        const weightPenalty = Math.max(0.2, 1 - pennyWeight / 150);
        const heatPenalty = Math.max(0.3, 1 - (heat - 50) / 100);
        const fatiguePenalty = Math.max(0.2, 1 - exhaustion / 120);

        let strideForce = 3.0 * weightPenalty * heatPenalty * fatiguePenalty;

        if (!climbing) strideForce *= 1.8; // downhill is easier

        speed = Math.min(10, speed + strideForce);
    }

    function triggerTrip() {
        state = STATE.TRIPPED;
        tripTimer = 60; // 1 second stun
        speed = 0;
        // Lose some pennies on trip
        if (pennies > 0 && Math.random() > 0.7) {
            pennies = Math.max(0, pennies - 1);
            pennyWeight = pennies * 0.1;
        }
    }

    function spawnFirework() {
        fireworks.push({
            x: Math.random() * canvas.width,
            y: canvas.height * 0.1 + Math.random() * canvas.height * 0.2,
            particles: [],
            timer: 60,
            color: ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'][Math.floor(Math.random() * 6)],
        });

        // Create particles
        const fw = fireworks[fireworks.length - 1];
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            fw.particles.push({
                x: fw.x, y: fw.y,
                vx: Math.cos(angle) * (2 + Math.random() * 2),
                vy: Math.sin(angle) * (2 + Math.random() * 2),
                life: 40 + Math.random() * 20,
            });
        }
    }

    function update() {
        if (state === STATE.TITLE || state === STATE.GAMEOVER) return;

        // Game time advances
        gameTime += 0.3;

        // Heat: peaks midday, cools evening. July 4th Tempe = brutal
        const hourFrac = (gameTime % 86400) / 3600;
        heat = 85 + Math.sin((hourFrac - 6) / 12 * Math.PI) * 25; // 85-110F range

        // Trip recovery
        if (state === STATE.TRIPPED) {
            tripTimer--;
            if (tripTimer <= 0) {
                state = climbing ? STATE.CLIMBING : STATE.DESCENDING;
            }
            return;
        }

        // Movement
        if (climbing) {
            loopProgress += speed * 0.1;
            speed *= 0.88;
        } else {
            loopProgress -= speed * 0.15; // downhill is faster
            speed *= 0.9;
        }

        // Exhaustion builds
        exhaustion = Math.min(100, exhaustion + 0.008 + (heat > 100 ? 0.01 : 0));
        if (speed > 5) exhaustion += 0.005;

        // Top of mountain
        if (climbing && loopProgress >= 100) {
            loopProgress = 100;
            climbing = false;
            state = STATE.DESCENDING;
        }

        // Bottom of mountain (loop complete)
        if (!climbing && loopProgress <= 0) {
            loopProgress = 0;
            loop++;
            pennies++;
            pennyWeight = pennies * 0.1;
            score = loop;

            // Small recovery between loops
            exhaustion = Math.max(0, exhaustion - 2);

            if (loop >= 800) {
                // WINNER
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-udam-high', highScore.toString());
                }
                state = STATE.GAMEOVER;
                popupEnteredAt = Date.now();
                return;
            }

            climbing = true;
            state = STATE.CLIMBING;
        }

        // Rival runners
        rivalTripCooldown = Math.max(0, rivalTripCooldown - 1);
        rivals.forEach(r => {
            r.progress += r.speed * (0.5 + Math.random() * 0.3);
            if (r.progress > 100) {
                r.progress = 100;
                r.speed = -Math.abs(r.speed); // turn around
            }
            if (r.progress < 0) {
                r.progress = 0;
                r.speed = Math.abs(r.speed);
                r.loopNum++;
            }

            // Rival trips you if aggressive and nearby and you're passing their PR
            if (r.aggressive && rivalTripCooldown <= 0 &&
                Math.abs(r.progress - loopProgress) < 10 &&
                loop >= r.loopNum && Math.random() < 0.005) {
                triggerTrip();
                rivalTripCooldown = 300; // 5 sec between trips
            }
        });

        // Fireworks (July 4th!)
        fireworkTimer++;
        if (fireworkTimer % 120 === 0) spawnFirework();

        // Update fireworks
        fireworks = fireworks.filter(fw => {
            fw.timer--;
            fw.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.life--;
            });
            fw.particles = fw.particles.filter(p => p.life > 0);
            return fw.timer > 0 || fw.particles.length > 0;
        });

        // Occasionally firework lands on course and causes chaos
        if (Math.random() < 0.001) {
            // Firework on course!
            speed = Math.max(0, speed - 2);
            exhaustion = Math.min(100, exhaustion + 3);
        }

        // Tap rate decay
        if (Date.now() - lastTapTime > 500) tapRate *= 0.85;

        // Game over: total exhaustion
        if (exhaustion >= 100) {
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('puke-udam-high', highScore.toString());
            }
            state = STATE.GAMEOVER;
            popupEnteredAt = Date.now();
        }

        // Runner animation
        if (speed > 0.5) runnerBob += speed * 0.2;
    }

    // Draw
    function drawScene() {
        const w = canvas.width, h = canvas.height;
        const heatFrac = Math.max(0, (heat - 85) / 25);

        // Sky (hot July 4th)
        const r = Math.round(255 - heatFrac * 40);
        const g = Math.round(140 - heatFrac * 60);
        const b = Math.round(66 - heatFrac * 30);
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        skyGrad.addColorStop(0, `rgb(${r},${g},${b})`);
        skyGrad.addColorStop(1, '#fdf5e6');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Sun
        ctx.fillStyle = C.sun;
        ctx.beginPath();
        ctx.arc(w * 0.8, h * 0.1, 25 + heatFrac * 10, 0, Math.PI * 2);
        ctx.fill();

        // Tempe skyline in background
        ctx.fillStyle = '#ccc';
        for (let i = 0; i < 8; i++) {
            const bx = (i * 100 + 20) % w;
            const bh = 20 + (i * 13) % 40;
            ctx.fillRect(bx, h * 0.35 - bh, 30, bh);
        }

        // A Mountain
        const baseY = h * 0.75;
        const peakY = h * 0.3;
        ctx.fillStyle = C.mountain;
        ctx.beginPath();
        ctx.moveTo(w * 0.15, baseY);
        ctx.lineTo(w * 0.5, peakY);
        ctx.lineTo(w * 0.85, baseY);
        ctx.closePath();
        ctx.fill();

        // The "A" on A Mountain
        ctx.font = '40px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('A', w * 0.5, h * 0.42);

        // Asphalt trail (the road up)
        ctx.strokeStyle = C.asphalt;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(w * 0.25, baseY - 5);
        ctx.lineTo(w * 0.5, peakY + 20);
        ctx.lineTo(w * 0.75, baseY - 5);
        ctx.stroke();

        // Ground
        ctx.fillStyle = '#c4a66a';
        ctx.fillRect(0, baseY, w, h - baseY);

        // ASU buildings
        ctx.fillStyle = '#8c1d40'; // ASU maroon
        ctx.fillRect(w * 0.05, baseY - 25, 30, 25);
        ctx.fillRect(w * 0.88, baseY - 20, 25, 20);
    }

    function drawRunner() {
        const w = canvas.width, h = canvas.height;
        const baseY = h * 0.75;
        const peakY = h * 0.3;

        // Position on mountain
        const frac = loopProgress / 100;
        let rx, ry;
        if (climbing) {
            rx = w * 0.25 + frac * (w * 0.25);
            ry = baseY - frac * (baseY - peakY - 20);
        } else {
            rx = w * 0.5 + (1 - frac) * (w * 0.25);
            ry = peakY + 20 + (1 - frac) * (baseY - peakY - 20);
        }

        const bob = speed > 0.5 ? Math.sin(runnerBob) * 2 : 0;
        const lean = climbing ? -0.2 : 0.15;

        ctx.save();
        ctx.translate(rx, ry - 10 + bob);

        if (state === STATE.TRIPPED) {
            // Fallen over
            ctx.rotate(Math.PI / 2);
        } else {
            ctx.rotate(lean);
        }

        // Body
        ctx.fillStyle = exhaustion > 80 ? C.heat : C.runner;
        ctx.fillRect(-5, -24, 10, 16);
        // Head
        ctx.fillRect(-4, -32, 8, 8);
        // Headband
        ctx.fillStyle = '#fff';
        ctx.fillRect(-4, -30, 8, 2);

        // Penny sack on back (grows with pennies)
        if (pennies > 0) {
            const sackSize = Math.min(20, 5 + pennies * 0.02);
            ctx.fillStyle = C.penny;
            ctx.beginPath();
            ctx.ellipse(-8, -18, sackSize / 2, sackSize / 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = C.pennyShine;
            ctx.fillRect(-9, -20, 2, 2);
        }

        // Metal spikes on shoes!
        ctx.fillStyle = '#aaa';
        ctx.fillRect(-4, 4, 2, 4);
        ctx.fillRect(0, 4, 2, 4);
        ctx.fillRect(4, 4, 2, 4);

        // Legs
        ctx.fillStyle = C.runner;
        const legPhase = Math.sin(runnerBob);
        ctx.fillRect(-3, -8 + legPhase * 2, 3, 12);
        ctx.fillRect(1, -8 - legPhase * 2, 3, 12);

        ctx.restore();

        // Altitude label
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(loopProgress) + '%', rx, ry - 45);
    }

    function drawRivals() {
        const w = canvas.width, h = canvas.height;
        const baseY = h * 0.75;
        const peakY = h * 0.3;

        rivals.forEach(r => {
            const frac = Math.max(0, Math.min(100, r.progress)) / 100;
            const goingUp = r.speed > 0;
            let rx, ry;
            if (goingUp) {
                rx = w * 0.25 + frac * (w * 0.25);
                ry = baseY - frac * (baseY - peakY - 20);
            } else {
                rx = w * 0.5 + (1 - frac) * (w * 0.25);
                ry = peakY + 20 + (1 - frac) * (baseY - peakY - 20);
            }

            ctx.fillStyle = r.aggressive ? C.rival : '#888';
            ctx.fillRect(rx - 3, ry - 18, 6, 12);
            ctx.fillRect(rx - 2, ry - 22, 4, 4);

            // Spikes if aggressive
            if (r.aggressive) {
                ctx.fillStyle = '#aaa';
                ctx.fillRect(rx - 3, ry - 4, 2, 3);
                ctx.fillRect(rx + 1, ry - 4, 2, 3);
            }
        });
    }

    function drawFireworks() {
        fireworks.forEach(fw => {
            fw.particles.forEach(p => {
                ctx.fillStyle = fw.color;
                ctx.globalAlpha = Math.min(1, p.life / 20);
                ctx.fillRect(p.x, p.y, 3, 3);
            });
        });
        ctx.globalAlpha = 1;
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '10px "Press Start 2P", monospace';

        // Loop counter
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('LOOP ' + (loop + 1) + ' / 800', 10, 20);

        // Direction
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = climbing ? '#f1c40f' : '#6b8e23';
        ctx.fillText(climbing ? 'CLIMBING' : 'DESCENDING', 10, 33);

        // Soul counter (counts down from 800)
        ctx.textAlign = 'right';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(Math.max(0, 800 - loop) + ' TO GO', w - 10, 20);

        // Pennies
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.penny;
        ctx.fillText(pennies + ' PENNIES', w - 10, 33);

        // Heat
        ctx.textAlign = 'center';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = heat > 100 ? C.heat : C.textDim;
        ctx.fillText(Math.floor(heat) + 'F', w / 2, 16);

        // Exhaustion meter
        ctx.fillStyle = C.dark;
        ctx.fillRect(w / 2 - 60, 20, 120, 8);
        ctx.fillStyle = exhaustion > 70 ? C.heat : exhaustion > 40 ? '#f1c40f' : '#6b8e23';
        ctx.fillRect(w / 2 - 60, 20, 120 * (exhaustion / 100), 8);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(w / 2 - 60, 20, 120, 8);
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('EXHAUSTION', w / 2, 40);

        // Weight indicator
        if (pennyWeight > 5) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = pennyWeight > 30 ? C.heat : C.penny;
            ctx.textAlign = 'left';
            ctx.fillText('WEIGHT: ' + Math.floor(pennyWeight) + '%', 10, 50);
        }

        // Tripped indicator
        if (state === STATE.TRIPPED) {
            ctx.font = '16px "Press Start 2P", monospace';
            ctx.fillStyle = C.heat;
            ctx.textAlign = 'center';
            ctx.fillText('TRIPPED!', w / 2, canvas.height * 0.55);
        }

        // Controls
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('TAP/SPACE = STRIDE', w / 2, canvas.height - 8);
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        // A Mountain silhouette
        ctx.fillStyle = C.mountain;
        ctx.beginPath();
        ctx.moveTo(w * 0.2, h * 0.75);
        ctx.lineTo(w * 0.5, h * 0.35);
        ctx.lineTo(w * 0.8, h * 0.75);
        ctx.fill();
        ctx.font = '30px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('A', w * 0.5, h * 0.52);

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('UDAM', w / 2, h * 0.1 + 14);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.penny;
        ctx.fillText('UP AND DOWN A MOUNTAIN', w / 2, h * 0.1 + 34);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('100 miles. 800 loops. A Mountain, Tempe.', w / 2, h * 0.22);
        ctx.fillText('July 4th. 100% Asphalt. 0% Flat.', w / 2, h * 0.22 + 20);
        ctx.fillText('Entry fee: $8 in pennies (refunded 1/loop).', w / 2, h * 0.22 + 40);
        ctx.fillText('Metal spikes permitted. Tripping allowed.', w / 2, h * 0.22 + 60);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.82);

        ctx.font = '10px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('Nobody will reach 800.', w / 2, h * 0.9);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('BEST: LOOP ' + highScore, w / 2, h * 0.95);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(26, 10, 2, 0.92)';
        ctx.fillRect(0, 0, w, h);

        const won = loop >= 800;

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = won ? '#f1c40f' : C.heat;
        ctx.textAlign = 'center';

        if (won) {
            ctx.fillText('ALL 800 LOOPS!', w / 2, h * 0.15);
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText('100 MILES. YOU MADMAN.', w / 2, h * 0.15 + 28);
        } else {
            ctx.fillText('COLLAPSED', w / 2, h * 0.15);
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.heat;
            ctx.fillText('ON LOOP ' + (loop + 1), w / 2, h * 0.15 + 28);
        }

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(loop + ' LOOPS', w / 2, h * 0.35);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.penny;
        ctx.fillText(pennies + ' PENNIES EARNED', w / 2, h * 0.35 + 22);
        ctx.fillStyle = C.text;
        ctx.fillText('$' + (pennies * 0.01).toFixed(2) + ' REFUNDED', w / 2, h * 0.35 + 40);

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('NEW RECORD!', w / 2, h * 0.35 + 58);
        }

        // Wimp out award
        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        let flavor = '';
        if (won) flavor = 'The A on A Mountain now stands for you. Legend.';
        else if (loop >= 400) flavor = 'Halfway through Sisyphus. The rock almost budged.';
        else if (loop >= 100) flavor = 'Triple digits. The asphalt remembers your footprints.';
        else if (loop >= 50) flavor = 'Fifty loops. The sun is laughing.';
        else if (loop >= 10) flavor = 'Ten loops. Wimp Out Award incoming.';
        else flavor = 'The pennies barely jingled.';
        ctx.fillText(flavor, w / 2, h * 0.58);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.75);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }

        drawScene();
        drawRivals();
        drawRunner();
        drawFireworks();
        drawHUD();
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
})();
