// Night Pacer - PUKE Games
// Mile 80 of a 100-miler. 3 AM. Headlamp only.
// Trail markers flash briefly - remember the sequence to stay on course.
// Wrong turn = lost time. Hallucinations get worse with fatigue.

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
        night: '#050508',
        headlamp: '#ffe4a0',
        trail: '#2a2015',
        trailLight: '#3a3025',
        marker: '#ff6600',
        markerWrong: '#444',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#5c3a1e',
        fatigue: '#c0392b',
        star: '#ddd',
        tree: '#0a150a',
        pacer: '#6b8e23',
    };

    const STATE = { TITLE: 0, SHOWING: 1, CHOOSING: 2, RUNNING: 3, LOST: 4, GAMEOVER: 5 };
    let state = STATE.TITLE;

    // Game
    let mile = 80;
    let fatigue = 40;          // starts at 40 (already at mile 80)
    let timeElapsed = 0;       // seconds
    let timeLost = 0;          // seconds lost from wrong turns
    let streak = 0;            // correct choices in a row
    let bestStreak = 0;
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-nightpacer-high') || '0');

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Sequence
    let sequence = [];         // array of directions: 'left', 'right', 'straight'
    let seqLength = 3;         // starts at 3, grows
    let showIndex = 0;
    let showTimer = 0;
    let choiceIndex = 0;
    let playerChoice = null;
    let choiceResult = null;   // 'correct' or 'wrong'
    let resultTimer = 0;

    // Hallucinations
    let hallucinations = [];
    let hallucinationIntensity = 0;

    // Pacer voice
    let pacerMessages = [
        'Rock ahead!', 'Watch your step', 'Trail bends left',
        'Stay focused', 'You got this', 'Keep moving',
        'Branch low!', 'Roots here', 'Downhill coming',
        'Water crossing', 'Marker ahead', 'Easy now',
    ];
    let pacerMsg = '';
    let pacerTimer = 0;

    // Stars
    let stars = [];
    for (let i = 0; i < 60; i++) {
        stars.push({
            x: Math.random() * 800,
            y: Math.random() * 200,
            size: Math.random() + 0.5,
            twinkle: Math.random() * Math.PI * 2,
        });
    }

    // Input
    document.addEventListener('keydown', e => {
        if (state === STATE.TITLE && (e.code === 'Space' || e.code === 'Enter')) {
            e.preventDefault();
            startGame();
            return;
        }
        if (state === STATE.GAMEOVER && (e.code === 'Space' || e.code === 'Enter')) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            state = STATE.TITLE;
            return;
        }
        if (state === STATE.CHOOSING) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') makeChoice('left');
            if (e.code === 'ArrowRight' || e.code === 'KeyD') makeChoice('right');
            if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') makeChoice('straight');
        }
    });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.CHOOSING) {
            const t = e.touches[0];
            const x = t.clientX / canvas.width;
            if (x < 0.33) makeChoice('left');
            else if (x > 0.66) makeChoice('right');
            else makeChoice('straight');
        }
    });

    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.CHOOSING) {
            const x = e.clientX / canvas.width;
            if (x < 0.33) makeChoice('left');
            else if (x > 0.66) makeChoice('right');
            else makeChoice('straight');
        }
    });

    function startGame() {
        state = STATE.SHOWING;
        mile = 80;
        fatigue = 40;
        timeElapsed = 0;
        timeLost = 0;
        streak = 0;
        bestStreak = 0;
        score = 0;
        seqLength = 3;
        hallucinations = [];
        hallucinationIntensity = 0;
        generateSequence();
    }

    function generateSequence() {
        sequence = [];
        const dirs = ['left', 'right', 'straight'];
        for (let i = 0; i < seqLength; i++) {
            sequence.push(dirs[Math.floor(Math.random() * 3)]);
        }
        showIndex = 0;
        showTimer = 90; // 1.5 sec per marker
        choiceIndex = 0;
        state = STATE.SHOWING;

        // Pacer callout
        pacerMsg = pacerMessages[Math.floor(Math.random() * pacerMessages.length)];
        pacerTimer = 120;
    }

    function makeChoice(dir) {
        if (choiceIndex >= sequence.length) return;

        playerChoice = dir;
        const correct = sequence[choiceIndex] === dir;

        if (correct) {
            choiceResult = 'correct';
            choiceIndex++;
            streak++;
            score += 10 + streak * 2;

            if (choiceIndex >= sequence.length) {
                // Completed sequence
                bestStreak = Math.max(bestStreak, streak);
                mile += 0.5;
                fatigue += 2;
                timeElapsed += 30;

                // Increase difficulty
                if (streak % 3 === 0 && seqLength < 8) {
                    seqLength++;
                }

                // Check win
                if (mile >= 100) {
                    if (score > highScore) {
                        highScore = score;
                        localStorage.setItem('puke-nightpacer-high', highScore.toString());
                    }
                    state = STATE.GAMEOVER;
                    popupEnteredAt = Date.now();
                    return;
                }

                resultTimer = 40;
                state = STATE.RUNNING;
            }
        } else {
            choiceResult = 'wrong';
            streak = 0;
            timeLost += 120; // 2 minutes lost
            fatigue += 5;
            score = Math.max(0, score - 15);

            resultTimer = 60;
            state = STATE.LOST;
        }
    }

    function update() {
        if (state === STATE.SHOWING) {
            showTimer--;
            if (showTimer <= 0) {
                showIndex++;
                if (showIndex >= sequence.length) {
                    state = STATE.CHOOSING;
                    choiceIndex = 0;
                } else {
                    // Shorter display for higher fatigue
                    showTimer = Math.max(30, 90 - fatigue * 0.5);
                }
            }
        }

        if (state === STATE.RUNNING) {
            resultTimer--;
            if (resultTimer <= 0) {
                generateSequence();
            }
        }

        if (state === STATE.LOST) {
            resultTimer--;
            if (resultTimer <= 0) {
                generateSequence();
            }
        }

        // Pacer message timer
        if (pacerTimer > 0) pacerTimer--;

        // Hallucination intensity
        hallucinationIntensity = Math.max(0, (fatigue - 50) / 50);

        // Spawn hallucinations
        if (hallucinationIntensity > 0.1 && Math.random() < hallucinationIntensity * 0.015) {
            const types = ['rock_person', 'ghost_runner', 'glowing_eyes', 'moving_tree', 'phantom_marker'];
            hallucinations.push({
                type: types[Math.floor(Math.random() * types.length)],
                x: Math.random() * canvas.width,
                y: canvas.height * 0.3 + Math.random() * canvas.height * 0.3,
                life: 90 + Math.random() * 120,
                alpha: 0,
            });
        }

        hallucinations = hallucinations.filter(h => {
            h.life--;
            h.alpha = h.life > 30 ? Math.min(0.6, h.alpha + 0.02) : (h.life / 30) * 0.6;
            h.x += Math.sin(Date.now() / 400 + h.y) * 0.5;
            return h.life > 0;
        });

        // Fatigue game over
        if (fatigue >= 100) {
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('puke-nightpacer-high', highScore.toString());
            }
            state = STATE.GAMEOVER;
            popupEnteredAt = Date.now();
        }
    }

    // Draw
    function drawNight() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = C.night;
        ctx.fillRect(0, 0, w, h);

        // Stars
        stars.forEach(s => {
            const twinkle = Math.sin(Date.now() / 500 + s.twinkle) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(220,220,220,${twinkle * (1 - hallucinationIntensity * 0.5)})`;
            ctx.fillRect(s.x % w, s.y, s.size, s.size);
        });

        // Tree silhouettes
        for (let i = 0; i < 12; i++) {
            const tx = (i * 70 + 20) % w;
            const th = 80 + (i * 17) % 60;
            ctx.fillStyle = C.tree;
            ctx.beginPath();
            ctx.moveTo(tx - 15, h * 0.55);
            ctx.lineTo(tx + 15, h * 0.55);
            ctx.lineTo(tx, h * 0.55 - th);
            ctx.fill();
            ctx.fillRect(tx - 2, h * 0.55 - 5, 4, 10);
        }
    }

    function drawHeadlamp() {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2;
        const cy = h * 0.6;

        // Headlamp cone
        const grad = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy - 30, 200);
        grad.addColorStop(0, 'rgba(255, 228, 160, 0.2)');
        grad.addColorStop(0.5, 'rgba(255, 228, 160, 0.05)');
        grad.addColorStop(1, 'rgba(255, 228, 160, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 30);
        ctx.lineTo(cx - 180, cy - 200);
        ctx.lineTo(cx + 180, cy - 200);
        ctx.lineTo(cx + 10, cy - 30);
        ctx.fill();

        // Trail visible in headlamp
        ctx.fillStyle = C.trailLight;
        ctx.beginPath();
        ctx.moveTo(cx - 40, cy + 20);
        ctx.lineTo(cx - 100, cy - 120);
        ctx.lineTo(cx + 100, cy - 120);
        ctx.lineTo(cx + 40, cy + 20);
        ctx.fill();
    }

    function drawTrailMarkers() {
        const w = canvas.width, h = canvas.height;

        if (state === STATE.SHOWING && showIndex < sequence.length) {
            // Show current marker
            const dir = sequence[showIndex];
            const markerX = dir === 'left' ? w * 0.3 : dir === 'right' ? w * 0.7 : w / 2;
            const markerY = h * 0.35;

            // Glowing marker
            const glow = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 102, 0, ${glow})`;
            ctx.beginPath();
            ctx.arc(markerX, markerY, 12, 0, Math.PI * 2);
            ctx.fill();

            // Arrow
            ctx.fillStyle = '#fff';
            ctx.font = '20px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            const arrow = dir === 'left' ? '<' : dir === 'right' ? '>' : '^';
            ctx.fillText(arrow, markerX, markerY + 7);

            // Sequence progress
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.fillText((showIndex + 1) + '/' + sequence.length, w / 2, h * 0.25);
        }

        if (state === STATE.CHOOSING) {
            // Show choice prompts
            const dirs = ['left', 'straight', 'right'];
            const xs = [w * 0.25, w / 2, w * 0.75];
            const arrows = ['<', '^', '>'];
            const labels = ['LEFT', 'STRAIGHT', 'RIGHT'];

            dirs.forEach((dir, i) => {
                const isNext = sequence[choiceIndex] === dir; // don't show this obviously
                const alpha = Math.sin(Date.now() / 300 + i) * 0.2 + 0.8;

                ctx.fillStyle = `rgba(255, 102, 0, ${alpha})`;
                ctx.beginPath();
                ctx.arc(xs[i], h * 0.4, 18, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.font = '16px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(arrows[i], xs[i], h * 0.4 + 6);

                ctx.font = '8px "Press Start 2P", monospace';
                ctx.fillStyle = C.text;
                ctx.fillText(labels[i], xs[i], h * 0.4 + 28);
            });

            // Which marker to choose
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.headlamp;
            ctx.textAlign = 'center';
            ctx.fillText('MARKER ' + (choiceIndex + 1) + '/' + sequence.length, w / 2, h * 0.28);
        }
    }

    function drawChoiceResult() {
        const w = canvas.width, h = canvas.height;

        if (state === STATE.RUNNING) {
            ctx.font = '16px "Press Start 2P", monospace';
            ctx.fillStyle = C.pacer;
            ctx.textAlign = 'center';
            ctx.fillText('ON COURSE!', w / 2, h * 0.35);
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillText('+' + (10 + streak * 2), w / 2, h * 0.35 + 22);
        }

        if (state === STATE.LOST) {
            ctx.font = '16px "Press Start 2P", monospace';
            ctx.fillStyle = C.fatigue;
            ctx.textAlign = 'center';
            ctx.fillText('WRONG TURN!', w / 2, h * 0.35);
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.fatigue;
            ctx.fillText('-2 MINUTES', w / 2, h * 0.35 + 22);
        }
    }

    function drawHallucinations() {
        hallucinations.forEach(h => {
            ctx.globalAlpha = h.alpha;
            ctx.font = '14px "VT323", monospace';
            ctx.textAlign = 'center';

            switch(h.type) {
                case 'rock_person':
                    ctx.fillStyle = '#666';
                    ctx.fillRect(h.x - 8, h.y, 16, 25);
                    ctx.fillRect(h.x - 5, h.y - 10, 10, 10);
                    ctx.fillStyle = '#999';
                    ctx.fillText('...person?', h.x, h.y - 15);
                    break;
                case 'ghost_runner':
                    ctx.fillStyle = 'rgba(232, 127, 36, 0.3)';
                    ctx.fillRect(h.x - 5, h.y, 10, 20);
                    ctx.fillRect(h.x - 4, h.y - 8, 8, 8);
                    ctx.fillStyle = C.text;
                    ctx.fillText('runner ahead?', h.x, h.y - 15);
                    break;
                case 'glowing_eyes':
                    ctx.fillStyle = '#ff4444';
                    ctx.fillRect(h.x - 6, h.y, 3, 2);
                    ctx.fillRect(h.x + 3, h.y, 3, 2);
                    break;
                case 'moving_tree':
                    ctx.fillStyle = '#1a2a1a';
                    ctx.fillRect(h.x - 3, h.y, 6, 30);
                    ctx.beginPath();
                    ctx.moveTo(h.x - 15, h.y + 5);
                    ctx.lineTo(h.x + 15, h.y + 5);
                    ctx.lineTo(h.x, h.y - 25);
                    ctx.fill();
                    ctx.fillStyle = '#4a4';
                    ctx.fillText('did that move?', h.x, h.y - 30);
                    break;
                case 'phantom_marker':
                    ctx.fillStyle = C.marker;
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, 8, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
            ctx.globalAlpha = 1;
        });
    }

    function drawPacer() {
        if (pacerTimer <= 0) return;

        const w = canvas.width, h = canvas.height;
        const alpha = pacerTimer > 90 ? 1 : pacerTimer / 90;

        ctx.globalAlpha = alpha;
        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.pacer;
        ctx.textAlign = 'left';
        ctx.fillText('Pacer: "' + pacerMsg + '"', 60, h * 0.85);
        ctx.globalAlpha = 1;
    }

    function drawRunner() {
        const w = canvas.width, h = canvas.height;
        const rx = w / 2;
        const ry = h * 0.62;
        const bob = Math.sin(Date.now() / 200) * 2;

        ctx.save();
        ctx.translate(rx, ry + bob);

        // Body
        ctx.fillStyle = C.runner;
        ctx.fillRect(-5, -24, 10, 16);
        // Head
        ctx.fillRect(-4, -32, 8, 8);
        // Headlamp beam indicator
        ctx.fillStyle = C.headlamp;
        ctx.fillRect(-1, -30, 4, 2);

        // Fatigue lean
        const lean = fatigue > 70 ? Math.sin(Date.now() / 300) * 0.1 : 0;
        ctx.rotate(lean);

        // Legs
        const legPhase = Math.sin(Date.now() / 200);
        ctx.fillStyle = C.runner;
        ctx.fillRect(-4, -8 + legPhase * 2, 4, 12);
        ctx.fillRect(1, -8 - legPhase * 2, 4, 12);

        ctx.restore();
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '10px "Press Start 2P", monospace';

        // Mile
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('MILE ' + mile.toFixed(1) + '/100', 60, 25);

        // Mile progress bar
        ctx.fillStyle = C.night;
        ctx.fillRect(60, 30, 150, 6);
        ctx.fillStyle = C.text;
        ctx.fillRect(60, 30, 150 * ((mile - 80) / 20), 6);
        ctx.strokeStyle = C.textDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(60, 30, 150, 6);

        // Time
        const totalTime = timeElapsed + timeLost;
        const hours = Math.floor(totalTime / 3600);
        const mins = Math.floor((totalTime % 3600) / 60);
        ctx.textAlign = 'right';
        ctx.fillStyle = timeLost > 300 ? C.fatigue : C.text;
        ctx.fillText((hours > 0 ? hours + 'h ' : '') + mins + 'm', w - 20, 25);

        if (timeLost > 0) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.fatigue;
            ctx.fillText('LOST: ' + Math.floor(timeLost / 60) + 'm', w - 20, 38);
        }

        // Fatigue bar
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = fatigue > 75 ? C.fatigue : C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('FATIGUE', w / 2, 20);

        ctx.fillStyle = C.night;
        ctx.fillRect(w / 2 - 50, 24, 100, 8);
        ctx.fillStyle = fatigue > 75 ? C.fatigue : fatigue > 50 ? '#f1c40f' : C.pacer;
        ctx.fillRect(w / 2 - 50, 24, 100 * (fatigue / 100), 8);
        ctx.strokeStyle = C.textDim;
        ctx.strokeRect(w / 2 - 50, 24, 100, 8);

        // Streak
        if (streak > 0) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.textAlign = 'left';
            ctx.fillText('STREAK: ' + streak, 60, 50);
        }

        // Score
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('SCORE: ' + score, w - 20, 50);
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;
        drawNight();

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('NIGHT PACER', w / 2, h * 0.12);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.headlamp;
        ctx.fillText('MILE 80. 3 AM.', w / 2, h * 0.12 + 28);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('Trail markers flash in the darkness.', w / 2, h * 0.3);
        ctx.fillText('Remember the sequence. Choose correctly.', w / 2, h * 0.3 + 20);
        ctx.fillText('Wrong turn = lost time. Fatigue = hallucinations.', w / 2, h * 0.3 + 40);
        ctx.fillText('"They wake up at 3 AM and say', w / 2, h * 0.3 + 70);
        ctx.fillText('Man, those guys are STILL out there!!!"', w / 2, h * 0.3 + 90);
        ctx.font = '10px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('- Gary Cross', w / 2, h * 0.3 + 108);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.7);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('LEFT/RIGHT/UP ARROWS or tap LEFT/CENTER/RIGHT', w / 2, h * 0.8);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('HIGH SCORE: ' + highScore, w / 2, h * 0.92);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(5, 5, 8, 0.92)';
        ctx.fillRect(0, 0, w, h);

        const finished = mile >= 100;

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = finished ? '#f1c40f' : C.fatigue;
        ctx.textAlign = 'center';

        if (finished) {
            ctx.fillText('MILE 100!', w / 2, h * 0.18);
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.headlamp;
            ctx.fillText('THE SUN IS RISING', w / 2, h * 0.18 + 28);
        } else {
            ctx.fillText('COLLAPSED', w / 2, h * 0.18);
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.fatigue;
            ctx.fillText('MILE ' + mile.toFixed(1), w / 2, h * 0.18 + 28);
        }

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('SCORE: ' + score, w / 2, h * 0.38);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('BEST STREAK: ' + bestStreak, w / 2, h * 0.38 + 25);
        ctx.fillText('TIME LOST: ' + Math.floor(timeLost / 60) + ' MINUTES', w / 2, h * 0.38 + 45);

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('NEW HIGH SCORE!', w / 2, h * 0.38 + 65);
        }

        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        let flavor = '';
        if (finished) flavor = 'Mile 100. The sun rises. You made it through the night.';
        else if (mile >= 95) flavor = 'So close to dawn. The trail had other plans.';
        else if (mile >= 90) flavor = 'The hallucinations won. Almost there though.';
        else if (mile >= 85) flavor = 'Lost in the dark. Not the first, not the last.';
        else flavor = 'The night consumed you at mile ' + mile.toFixed(1) + '.';
        ctx.fillText(flavor, w / 2, h * 0.6);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.78);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }

        drawNight();
        drawHeadlamp();
        drawHallucinations();
        drawTrailMarkers();
        drawChoiceResult();
        drawRunner();
        drawPacer();
        drawHUD();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
