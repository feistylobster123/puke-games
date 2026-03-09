// McDowell Road Man - PUKE Games
// Desert mystery/exploration. A lonely figure appears in the distance.
// Run through Phoenix desert at dusk. Choose routes at forks.
// Get close enough to find what he leaves behind. Piece together fragments.

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
        skyTop: '#2a1040',
        skyMid: '#8b3a62',
        skyBottom: '#d4724a',
        horizon: '#c0804a',
        desert: '#c4956a',
        desertDark: '#8a6a4a',
        saguaro: '#4a6a3a',
        silhouette: '#1a0a05',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#8b6914',
        mystery: '#d4a0d4',
        fragment: '#f1c40f',
        road: '#555',
    };

    const STATE = { TITLE: 0, RUNNING: 1, FORK: 2, SIGHTING: 3, FRAGMENT: 4, GAMEOVER: 5 };
    let state = STATE.TITLE;

    // Locations
    const LOCATIONS = [
        'Below the White Tanks',
        'Near Pass Mountain',
        'Along the Salado',
        'Off McDowell Road',
        'By the interstate',
        'In the wash near Fountain Hills',
        'South of the Superstitions',
        'West toward Buckeye',
    ];

    // Fragments (story pieces)
    const FRAGMENTS = [
        { type: 'note', text: '"I walk because the road walks beneath me."' },
        { type: 'marker', text: 'A trail marker pointing nowhere.' },
        { type: 'shoe', text: 'A single worn running shoe, size unknown.' },
        { type: 'note', text: '"One dimension is enough when you can see forever."' },
        { type: 'map', text: 'A hand-drawn map of roads that don\'t exist.' },
        { type: 'note', text: '"The desert answers every question with silence."' },
        { type: 'photo', text: 'A faded polaroid of an empty road.' },
        { type: 'marker', text: 'Stones arranged in a line pointing west.' },
        { type: 'note', text: '"He was there below White Tanks, glancing near Pass."' },
        { type: 'shoe', text: 'Another shoe. Same wear pattern. Miles apart.' },
    ];

    let collectedFragments = [];
    let currentLocation = 0;
    let milesRun = 0;
    let sightings = 0;
    let manDist = 0;        // distance to the man (0 = right there, 100+ = far)
    let manVisible = false;
    let manTimer = 0;
    let approachCount = 0;  // how many times you got close
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-mcdowell-high') || '0');

    // Atmosphere
    let duskProgress = 0;   // 0-100, sky gets darker
    let windIntensity = 0;
    let dustParticles = [];

    // Fork choices
    let forkChoices = [];
    let forkTimer = 0;
    let nextForkMile = 2;

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Sighting
    let sightingTimer = 0;

    // Input
    document.addEventListener('keydown', e => {
        if (state === STATE.TITLE && (e.code === 'Space' || e.code === 'Enter')) {
            e.preventDefault(); startGame(); return;
        }
        if (state === STATE.GAMEOVER && (e.code === 'Space' || e.code === 'Enter')) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            state = STATE.TITLE; return;
        }
        if (state === STATE.RUNNING && e.code === 'Space') {
            e.preventDefault(); doRun(); return;
        }
        if (state === STATE.FORK) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            if (e.code === 'ArrowLeft' || e.code === 'Digit1' || e.code === 'KeyA') chooseFork(0);
            if (e.code === 'ArrowRight' || e.code === 'Digit2' || e.code === 'KeyD') chooseFork(1);
        }
        if (state === STATE.SIGHTING && e.code === 'Space') {
            e.preventDefault(); approachMan(); return;
        }
        if (state === STATE.FRAGMENT && (e.code === 'Space' || e.code === 'Enter')) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            e.preventDefault();
            state = STATE.RUNNING;
        }
    });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.FRAGMENT) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.RUNNING; return; }
        if (state === STATE.RUNNING) { doRun(); return; }
        if (state === STATE.SIGHTING) { approachMan(); return; }
        if (state === STATE.FORK) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            const t = e.touches[0];
            if (t.clientX < canvas.width / 2) chooseFork(0);
            else chooseFork(1);
        }
    });

    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.FRAGMENT) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.RUNNING; return; }
        if (state === STATE.RUNNING) { doRun(); return; }
        if (state === STATE.SIGHTING) { approachMan(); return; }
        if (state === STATE.FORK) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            if (e.clientX < canvas.width / 2) chooseFork(0);
            else chooseFork(1);
        }
    });

    function startGame() {
        state = STATE.RUNNING;
        collectedFragments = [];
        currentLocation = 0;
        milesRun = 0;
        sightings = 0;
        manDist = 80 + Math.random() * 40;
        manVisible = false;
        manTimer = 0;
        approachCount = 0;
        score = 0;
        duskProgress = 0;
        nextForkMile = 1.5;
        dustParticles = [];
    }

    function doRun() {
        milesRun += 0.15;
        duskProgress = Math.min(100, milesRun * 3);

        // Man appears/disappears
        if (!manVisible && Math.random() < 0.02) {
            manVisible = true;
            manDist = 50 + Math.random() * 80;
            manTimer = 300 + Math.random() * 300;
        }

        if (manVisible) {
            // Running naturally closes distance slowly
            manDist -= 0.3;
        }

        // Fork in the road
        if (milesRun >= nextForkMile) {
            triggerFork();
        }

        // Dust
        if (Math.random() < 0.1) {
            dustParticles.push({
                x: canvas.width + 10,
                y: canvas.height * 0.5 + Math.random() * canvas.height * 0.3,
                size: 1 + Math.random() * 3,
                speed: 1 + Math.random() * 2,
                life: 60 + Math.random() * 60,
            });
        }
    }

    function approachMan() {
        if (!manVisible) return;

        manDist -= 5;
        approachCount++;

        // Too aggressive = he disappears
        if (approachCount > 3 && manDist < 40) {
            manVisible = false;
            manTimer = 600; // gone for a long time
            approachCount = 0;
        }

        // Close enough = sighting
        if (manDist <= 15 && manDist > 5) {
            triggerSighting();
        }

        // Very close = he vanishes but leaves something
        if (manDist <= 5) {
            manVisible = false;
            approachCount = 0;
            leaveFragment();
        }
    }

    function triggerFork() {
        state = STATE.FORK;
        popupEnteredAt = Date.now();
        nextForkMile = milesRun + 1.5 + Math.random() * 2;

        // Two location choices
        const loc1 = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        let loc2 = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        while (loc2 === loc1) loc2 = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

        // One might lead to a sighting
        const sightingChance = manVisible ? 0.6 : 0.3;
        forkChoices = [
            { location: loc1, leadToSighting: Math.random() < sightingChance },
            { location: loc2, leadToSighting: Math.random() < sightingChance },
        ];
    }

    function chooseFork(idx) {
        const choice = forkChoices[idx];
        currentLocation = LOCATIONS.indexOf(choice.location);

        if (choice.leadToSighting && !manVisible) {
            manVisible = true;
            manDist = 40 + Math.random() * 40;
            manTimer = 200 + Math.random() * 200;
        }

        state = STATE.RUNNING;
    }

    function triggerSighting() {
        sightings++;
        sightingTimer = 180;
        state = STATE.SIGHTING;
        score += 20;
    }

    function leaveFragment() {
        if (collectedFragments.length < FRAGMENTS.length) {
            const available = FRAGMENTS.filter(f => !collectedFragments.includes(f));
            if (available.length > 0) {
                const frag = available[Math.floor(Math.random() * available.length)];
                collectedFragments.push(frag);
                score += 30;
                state = STATE.FRAGMENT;
                popupEnteredAt = Date.now();
                return;
            }
        }
        state = STATE.RUNNING;
    }

    function update() {
        if (state === STATE.TITLE || state === STATE.GAMEOVER) return;

        // Man timer (disappears after a while)
        if (manVisible) {
            manTimer--;
            if (manTimer <= 0) {
                manVisible = false;
                manTimer = 300 + Math.random() * 400;
                approachCount = 0;
            }
        } else {
            manTimer--;
        }

        // Sighting timer
        if (state === STATE.SIGHTING) {
            sightingTimer--;
            if (sightingTimer <= 0) {
                state = STATE.RUNNING;
            }
        }

        // Update dust
        dustParticles = dustParticles.filter(d => {
            d.x -= d.speed;
            d.life--;
            return d.life > 0 && d.x > -20;
        });

        // Game ends at full dark or after collecting many fragments
        if (duskProgress >= 100) {
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('puke-mcdowell-high', highScore.toString());
            }
            state = STATE.GAMEOVER;
            popupEnteredAt = Date.now();
        }
    }

    // Draw
    function drawDesertSky() {
        const w = canvas.width, h = canvas.height;
        const dusk = duskProgress / 100;

        // Multi-stop gradient: purple top, pink middle, orange horizon
        const grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
        // Darkens as dusk progresses
        const topR = Math.round(42 - dusk * 30);
        const topG = Math.round(16 - dusk * 10);
        const topB = Math.round(64 - dusk * 40);
        grad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
        grad.addColorStop(0.4, `rgb(${139 - dusk * 80},${58 - dusk * 30},${98 - dusk * 60})`);
        grad.addColorStop(0.7, `rgb(${212 - dusk * 100},${114 - dusk * 60},${74 - dusk * 40})`);
        grad.addColorStop(1, `rgb(${192 - dusk * 80},${128 - dusk * 60},${74 - dusk * 40})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h * 0.55);

        // Stars appear at dusk
        if (dusk > 0.3) {
            ctx.fillStyle = `rgba(255,255,255,${(dusk - 0.3) * 1.4})`;
            for (let i = 0; i < 30; i++) {
                const sx = (i * 97 + 13) % w;
                const sy = (i * 53 + 7) % (h * 0.3);
                ctx.fillRect(sx, sy, 1, 1);
            }
        }

        // Sun/moon near horizon
        if (dusk < 0.8) {
            const sunX = w * 0.6;
            const sunY = h * 0.45 + dusk * h * 0.12;
            const sunR = 20 - dusk * 10;
            ctx.fillStyle = `rgba(241, 196, 15, ${1 - dusk * 1.2})`;
            ctx.beginPath();
            ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawDesertGround() {
        const w = canvas.width, h = canvas.height;
        const groundY = h * 0.55;

        // Desert floor
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
        groundGrad.addColorStop(0, C.desert);
        groundGrad.addColorStop(1, C.desertDark);
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, w, h - groundY);

        // Road/trail
        ctx.fillStyle = C.road;
        ctx.beginPath();
        ctx.moveTo(w * 0.4, h);
        ctx.lineTo(w * 0.47, groundY + 10);
        ctx.lineTo(w * 0.53, groundY + 10);
        ctx.lineTo(w * 0.6, h);
        ctx.fill();

        // Saguaros
        const saguaros = [0.1, 0.25, 0.72, 0.9];
        saguaros.forEach(pos => {
            drawSaguaro(w * pos, groundY);
        });

        // Distant mountains
        ctx.fillStyle = `rgba(100, 80, 70, ${0.3 + duskProgress / 200})`;
        ctx.beginPath();
        ctx.moveTo(0, groundY + 5);
        ctx.lineTo(w * 0.1, groundY - 20);
        ctx.lineTo(w * 0.2, groundY);
        ctx.lineTo(w * 0.35, groundY - 30);
        ctx.lineTo(w * 0.5, groundY - 10);
        ctx.lineTo(w * 0.65, groundY - 25);
        ctx.lineTo(w * 0.8, groundY - 5);
        ctx.lineTo(w * 0.9, groundY - 15);
        ctx.lineTo(w, groundY + 5);
        ctx.fill();

        // Dust particles
        dustParticles.forEach(d => {
            ctx.fillStyle = `rgba(196, 149, 106, ${d.life / 60 * 0.3})`;
            ctx.fillRect(d.x, d.y, d.size, d.size);
        });
    }

    function drawSaguaro(x, groundY) {
        ctx.fillStyle = C.saguaro;
        ctx.fillRect(x - 3, groundY - 40, 6, 40);
        // Arms
        ctx.fillRect(x - 12, groundY - 35, 9, 4);
        ctx.fillRect(x - 12, groundY - 35, 4, 15);
        ctx.fillRect(x + 3, groundY - 28, 9, 4);
        ctx.fillRect(x + 8, groundY - 28, 4, 12);
    }

    function drawMcDowellRoadMan() {
        if (!manVisible) return;

        const w = canvas.width, h = canvas.height;
        const groundY = h * 0.55;

        // Scale by distance
        const scale = Math.max(0.15, 1 - manDist / 100);
        const manX = w * 0.5 + (Math.sin(Date.now() / 2000) * 20);
        const manY = groundY - 10 * scale;

        ctx.save();
        ctx.globalAlpha = Math.min(0.8, scale * 1.2);
        ctx.translate(manX, manY);
        ctx.scale(scale, scale);

        // Pure black silhouette
        ctx.fillStyle = C.silhouette;

        // Body (tall, lean figure)
        ctx.fillRect(-6, -50, 12, 30);
        // Head
        ctx.beginPath();
        ctx.arc(0, -56, 7, 0, Math.PI * 2);
        ctx.fill();
        // Legs (walking pose, slow)
        const walkPhase = Math.sin(Date.now() / 800);
        ctx.fillRect(-5, -20, 4, 22 + walkPhase * 2);
        ctx.fillRect(1, -20, 4, 22 - walkPhase * 2);
        // Arms (at sides, slight swing)
        ctx.fillRect(-9, -48, 3, 18 + walkPhase);
        ctx.fillRect(6, -48, 3, 18 - walkPhase);

        ctx.restore();

        // Atmospheric text when close
        if (manDist < 40 && manDist > 15) {
            ctx.font = '12px "VT323", monospace';
            ctx.fillStyle = C.mystery;
            ctx.globalAlpha = 0.6;
            ctx.textAlign = 'center';
            ctx.fillText('he\'s there', w / 2, groundY - 60 * scale);
            ctx.globalAlpha = 1;
        }
    }

    function drawRunner() {
        const w = canvas.width, h = canvas.height;
        const rx = w * 0.5;
        const ry = h * 0.82;
        const bob = Math.sin(Date.now() / 200) * 2;

        ctx.save();
        ctx.translate(rx, ry + bob);

        ctx.fillStyle = C.runner;
        ctx.fillRect(-5, -24, 10, 16);
        ctx.fillRect(-4, -32, 8, 8);

        // Legs
        const legPhase = Math.sin(Date.now() / 200);
        ctx.fillRect(-3, -8 + legPhase * 2, 3, 12);
        ctx.fillRect(1, -8 - legPhase * 2, 3, 12);

        ctx.restore();
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '9px "Press Start 2P", monospace';

        // Location
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText(LOCATIONS[currentLocation] || 'Off McDowell Road', 10, 20);

        // Miles
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText(milesRun.toFixed(1) + ' MI', 10, 34);

        // Fragments
        ctx.textAlign = 'right';
        ctx.fillStyle = C.fragment;
        ctx.fillText('FRAGMENTS: ' + collectedFragments.length + '/' + FRAGMENTS.length, w - 10, 20);

        // Sightings
        ctx.fillStyle = C.mystery;
        ctx.fillText('SIGHTINGS: ' + sightings, w - 10, 34);

        // Score
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('SCORE: ' + score, w - 10, 48);

        // Dusk progress (as a subtle bar)
        ctx.fillStyle = 'rgba(26, 10, 5, 0.3)';
        ctx.fillRect(0, canvas.height - 4, w, 4);
        ctx.fillStyle = C.silhouette;
        ctx.fillRect(0, canvas.height - 4, w * (duskProgress / 100), 4);

        // Man distance hint
        if (manVisible) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = manDist < 30 ? C.mystery : C.textDim;
            const hint = manDist < 15 ? 'ALMOST THERE...' :
                         manDist < 30 ? 'HE SEES YOU' :
                         manDist < 60 ? 'A FIGURE AHEAD' : 'SOMETHING IN THE DISTANCE';
            ctx.fillText(hint, w / 2, 20);
        }

        // Controls
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        if (state === STATE.RUNNING) {
            ctx.fillText('TAP TO RUN  |  DON\'T CHASE TOO HARD', w / 2, canvas.height - 12);
        }
    }

    function drawFork() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(26, 10, 5, 0.75)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('FORK IN THE ROAD', w / 2, h * 0.25);

        forkChoices.forEach((choice, i) => {
            const cx = i === 0 ? w * 0.28 : w * 0.72;
            const cy = h * 0.45;

            ctx.fillStyle = 'rgba(42, 21, 6, 0.9)';
            ctx.fillRect(cx - 100, cy - 25, 200, 55);
            ctx.strokeStyle = C.text;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 100, cy - 25, 200, 55);

            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText(choice.location, cx, cy);

            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.fillText(i === 0 ? '[LEFT / 1]' : '[RIGHT / 2]', cx, cy + 18);
        });

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.mystery;
        ctx.fillText('Which way did he go?', w / 2, h * 0.7);
    }

    function drawSighting() {
        const w = canvas.width, h = canvas.height;

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.mystery;
        ctx.textAlign = 'center';

        const msgs = [
            'He stands motionless, looking at something you cannot see.',
            'A traveler explores a one dimensional existence.',
            'He glances at you from near Pass Mountain. Then away.',
            'The McDowell Road Man. Just... walking.',
            'Is he real? The desert haze says maybe.',
        ];
        const msg = msgs[sightings % msgs.length];

        ctx.fillText(msg, w / 2, h * 0.92);

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('TAP TO APPROACH', w / 2, h * 0.96);
    }

    function drawFragment() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(26, 10, 5, 0.85)';
        ctx.fillRect(0, 0, w, h);

        const frag = collectedFragments[collectedFragments.length - 1];

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.fragment;
        ctx.textAlign = 'center';
        ctx.fillText('FOUND: ' + frag.type.toUpperCase(), w / 2, h * 0.3);

        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = C.mystery;

        // Wrap text
        const words = frag.text.split(' ');
        let lines = [''];
        words.forEach(word => {
            const test = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + word;
            if (test.length > 45) lines.push(word);
            else lines[lines.length - 1] = test;
        });
        lines.forEach((line, i) => {
            ctx.fillText(line, w / 2, h * 0.42 + i * 22);
        });

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText(collectedFragments.length + '/' + FRAGMENTS.length + ' FRAGMENTS', w / 2, h * 0.65);

        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO CONTINUE', w / 2, h * 0.78);
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        // Dusk sky
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#2a1040');
        grad.addColorStop(0.3, '#8b3a62');
        grad.addColorStop(0.55, '#d4724a');
        grad.addColorStop(0.7, '#c4956a');
        grad.addColorStop(1, '#8a6a4a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Silhouette figure
        ctx.fillStyle = C.silhouette;
        ctx.fillRect(w / 2 - 4, h * 0.35, 8, 30);
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.35 - 5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(w / 2 - 4, h * 0.35 + 28, 4, 16);
        ctx.fillRect(w / 2 + 1, h * 0.35 + 28, 4, 16);

        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('McDOWELL', w / 2, h * 0.1);
        ctx.fillText('ROAD MAN', w / 2, h * 0.1 + 24);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.mystery;
        ctx.fillText('A lonely figure seen wandering', w / 2, h * 0.62);
        ctx.fillText('near White Tanks, Pass Mountain, the Salado.', w / 2, h * 0.62 + 18);
        ctx.fillText('Chase without chasing.', w / 2, h * 0.62 + 36);
        ctx.fillText('Collect fragments of a story that may not end.', w / 2, h * 0.62 + 54);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO BEGIN', w / 2, h * 0.84);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('HIGH SCORE: ' + highScore, w / 2, h * 0.94);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;

        // Full night sky
        ctx.fillStyle = '#0a0510';
        ctx.fillRect(0, 0, w, h);

        // Stars
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            ctx.fillRect((i * 97 + 13) % w, (i * 53 + 7) % h, 1, 1);
        }

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = C.mystery;
        ctx.textAlign = 'center';
        ctx.fillText('NIGHT FALLS', w / 2, h * 0.12);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('The desert doesn\'t answer.', w / 2, h * 0.12 + 22);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('SCORE: ' + score, w / 2, h * 0.28);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText(sightings + ' SIGHTINGS', w / 2, h * 0.35);
        ctx.fillText(collectedFragments.length + ' FRAGMENTS FOUND', w / 2, h * 0.42);

        // Show collected fragments
        if (collectedFragments.length > 0) {
            ctx.font = '12px "VT323", monospace';
            ctx.fillStyle = C.mystery;
            collectedFragments.forEach((f, i) => {
                if (i < 5) { // show up to 5
                    ctx.fillText(f.text, w / 2, h * 0.52 + i * 18);
                }
            });
            if (collectedFragments.length > 5) {
                ctx.fillText('...and ' + (collectedFragments.length - 5) + ' more', w / 2, h * 0.52 + 5 * 18);
            }
        }

        let flavor = '';
        if (collectedFragments.length >= 8) flavor = 'You know who he is now. Or you know that you never will.';
        else if (collectedFragments.length >= 5) flavor = 'Pieces of a puzzle that may have no picture.';
        else if (sightings >= 3) flavor = 'You saw him. He saw you. That was enough.';
        else if (sightings >= 1) flavor = 'One glimpse. The desert keeps its secrets.';
        else flavor = 'You ran, but the McDowell Road Man stayed hidden.';

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText(flavor, w / 2, h * 0.82);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.92);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }

        drawDesertSky();
        drawDesertGround();
        drawMcDowellRoadMan();
        drawRunner();
        drawHUD();

        if (state === STATE.FORK) drawFork();
        if (state === STATE.SIGHTING) drawSighting();
        if (state === STATE.FRAGMENT) drawFragment();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
