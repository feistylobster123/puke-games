// Rogue Valley Runners Store 5k - PUKE Games
// Organize a totally unauthorized 5k that starts and finishes
// at someone else's running store. Non-sanctioned. Not affiliated.
// Place cones, recruit runners, dodge cease-and-desists. Don't get shut down.

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
        road: '#888',
        sidewalk: '#ccc',
        store: '#8b4513',
        storeFront: '#d4a06d',
        cone: '#ff6600',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#8b6914',
        suspicion: '#c0392b',
        news: '#4a90d9',
        bib: '#fff',
        dark: '#2a1506',
        grass: '#6b8e23',
        official: '#c0392b',
    };

    const STATE = { TITLE: 0, SETUP: 1, RACING: 2, EVENT: 3, SHUTDOWN: 4, GAMEOVER: 5 };
    let state = STATE.TITLE;

    // Resources
    let cones = 0;          // placed cones
    let runners = 0;        // recruited participants
    let bibs = 0;           // printed bibs
    let suspicion = 0;      // 0-100, store owner suspicion
    let style = 0;          // 0-100, bonus style points
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-roguevalley-high') || '0');

    // Phases
    let phase = 'setup';    // setup, recruiting, race, aftermath
    let phaseTimer = 0;
    let actions = 0;        // actions taken in current phase

    // Events
    let eventText = '';
    let eventChoices = [];

    // Race
    let raceProgress = 0;   // 0-100
    let finishers = 0;
    let raceTimer = 0;
    let raceTime = 0;       // elapsed in seconds

    // Opposition
    let ceaseDesists = 0;
    let newsPresent = false;
    let storeOwnerAngry = false;
    let rivalRace = false;

    // Town map (simple grid for placing cones)
    let townCones = [];      // {x, y}
    let townRunners = [];    // {x, y, speed}

    // Scroll
    let scrollX = 0;

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Input
    document.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            handleTap();
        }
        if (state === STATE.EVENT) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            if (e.code === 'Digit1' || e.code === 'KeyA') resolveEvent(0);
            if (e.code === 'Digit2' || e.code === 'KeyB') resolveEvent(1);
        }
        if (state === STATE.SETUP || state === STATE.RACING) {
            if (e.code === 'KeyC') placeCone();
            if (e.code === 'KeyR') recruitRunner();
            if (e.code === 'KeyB') printBib();
        }
    });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER || state === STATE.SHUTDOWN) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.EVENT) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            const t = e.touches[0];
            if (t.clientX < canvas.width / 2) resolveEvent(0);
            else resolveEvent(1);
            return;
        }
        handleTap();
    });

    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER || state === STATE.SHUTDOWN) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }
        if (state === STATE.EVENT) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            if (e.clientX < canvas.width / 2) resolveEvent(0);
            else resolveEvent(1);
            return;
        }
        handleTap();
    });

    function handleTap() {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER || state === STATE.SHUTDOWN) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; return; }

        if (state === STATE.SETUP) {
            // Tap cycles through actions
            const actionCycle = actions % 3;
            if (actionCycle === 0) placeCone();
            else if (actionCycle === 1) recruitRunner();
            else printBib();
            actions++;
        }

        if (state === STATE.RACING) {
            // Tap to manage the race
            doRaceAction();
        }
    }

    function startGame() {
        state = STATE.SETUP;
        cones = 0;
        runners = 0;
        bibs = 0;
        suspicion = 0;
        style = 0;
        score = 0;
        phase = 'setup';
        phaseTimer = 0;
        actions = 0;
        raceProgress = 0;
        finishers = 0;
        raceTimer = 0;
        raceTime = 0;
        ceaseDesists = 0;
        newsPresent = false;
        storeOwnerAngry = false;
        rivalRace = false;
        townCones = [];
        townRunners = [];
    }

    function placeCone() {
        cones++;
        suspicion += 2;
        style += 1;
        townCones.push({
            x: 100 + Math.random() * (canvas.width - 200),
            y: canvas.height * 0.55 + Math.random() * 30,
        });

        if (Math.random() < 0.15) {
            triggerEvent('cone');
        }
        checkPhaseTransition();
    }

    function recruitRunner() {
        runners++;
        suspicion += 3;
        townRunners.push({
            x: 50 + Math.random() * (canvas.width - 100),
            y: canvas.height * 0.62 + Math.random() * 20,
            speed: 0.5 + Math.random() * 1.5,
        });

        if (Math.random() < 0.2) {
            triggerEvent('recruit');
        }
        checkPhaseTransition();
    }

    function printBib() {
        bibs++;
        style += 3;
        suspicion += 1;

        if (Math.random() < 0.1) {
            triggerEvent('bib');
        }
        checkPhaseTransition();
    }

    function doRaceAction() {
        raceProgress += 2;
        raceTimer++;

        // Random race events
        if (Math.random() < 0.08) {
            triggerEvent('race');
        }
    }

    function checkPhaseTransition() {
        // Ready to race when we have enough setup
        if (cones >= 10 && runners >= 5 && bibs >= 5 && state === STATE.SETUP) {
            state = STATE.RACING;
            phase = 'race';
            raceProgress = 0;
        }

        // Suspicion check
        if (suspicion >= 100) {
            getShutDown();
        }
    }

    function triggerEvent(context) {
        state = STATE.EVENT;
        popupEnteredAt = Date.now();

        const events = {
            cone: [
                {
                    text: 'A pedestrian asks what the cones are for.',
                    choices: [
                        { label: 'It\'s a race!', effect: () => { runners += 2; suspicion += 5; } },
                        { label: 'City work', effect: () => { suspicion -= 3; } },
                    ],
                },
                {
                    text: 'Store employee sees you placing cones.',
                    choices: [
                        { label: 'Run away', effect: () => { cones--; suspicion -= 5; } },
                        { label: 'Act casual', effect: () => { suspicion += 8; } },
                    ],
                },
            ],
            recruit: [
                {
                    text: '"Is this a real race?" asks a jogger.',
                    choices: [
                        { label: 'Absolutely!', effect: () => { runners += 1; style += 5; suspicion += 3; } },
                        { label: 'Define "real"', effect: () => { style += 10; } },
                    ],
                },
                {
                    text: 'Someone from the actual running store walks by.',
                    choices: [
                        { label: 'Look busy elsewhere', effect: () => { suspicion -= 2; } },
                        { label: 'Recruit them too', effect: () => { runners++; suspicion += 12; style += 15; } },
                    ],
                },
            ],
            bib: [
                {
                    text: 'Your home printer is running low on ink.',
                    choices: [
                        { label: 'Light mode bibs', effect: () => { bibs += 2; style -= 5; } },
                        { label: 'Buy more ink', effect: () => { bibs += 3; style += 5; } },
                    ],
                },
                {
                    text: 'Someone asks why the bibs say "TOTALLY LEGIT 5K".',
                    choices: [
                        { label: 'Branding!', effect: () => { style += 10; } },
                        { label: 'Reprint them', effect: () => { suspicion -= 5; bibs--; } },
                    ],
                },
            ],
            race: [
                {
                    text: 'A cease-and-desist letter arrives mid-race!',
                    choices: [
                        { label: 'Ignore it', effect: () => { ceaseDesists++; suspicion += 15; style += 10; } },
                        { label: 'Eat it', effect: () => { ceaseDesists++; style += 25; } },
                    ],
                },
                {
                    text: 'Local news crew shows up!',
                    choices: [
                        { label: 'Interview!', effect: () => { newsPresent = true; runners += 3; suspicion += 20; style += 20; } },
                        { label: 'Duck behind a cone', effect: () => { suspicion += 5; } },
                    ],
                },
                {
                    text: 'The store starts setting up their OWN race on the same day!',
                    choices: [
                        { label: 'Merge races', effect: () => { rivalRace = true; runners += 5; suspicion += 25; style += 30; } },
                        { label: 'Announce: "OURS IS FREE"', effect: () => { runners += 8; suspicion += 15; style += 15; } },
                    ],
                },
                {
                    text: 'Runners confused about which race they\'re in.',
                    choices: [
                        { label: 'All races are one race', effect: () => { style += 10; suspicion += 5; } },
                        { label: 'Give clearer directions', effect: () => { style += 5; } },
                    ],
                },
                {
                    text: 'The store owner comes out, furious.',
                    choices: [
                        { label: 'Challenge to a sprint', effect: () => { storeOwnerAngry = true; suspicion += 20; style += 40; } },
                        { label: 'Apologize profusely', effect: () => { suspicion -= 10; style -= 10; } },
                    ],
                },
            ],
        };

        const pool = events[context] || events.race;
        const ev = pool[Math.floor(Math.random() * pool.length)];
        eventText = ev.text;
        eventChoices = ev.choices;
    }

    function resolveEvent(idx) {
        if (idx >= eventChoices.length) return;
        eventChoices[idx].effect();
        suspicion = Math.max(0, Math.min(100, suspicion));
        style = Math.max(0, style);
        state = phase === 'race' ? STATE.RACING : STATE.SETUP;

        if (suspicion >= 100) getShutDown();
    }

    function getShutDown() {
        finishers = Math.floor(runners * (raceProgress / 100));
        score = finishers * 10 + style + (newsPresent ? 50 : 0) + (ceaseDesists * 20);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('puke-roguevalley-high', highScore.toString());
        }
        state = STATE.SHUTDOWN;
        popupEnteredAt = Date.now();
    }

    function update() {
        if (state === STATE.RACING) {
            raceTime += 1/60;
            scrollX += 1;

            // Auto-progress race slowly
            raceProgress += 0.05;

            // Runners finish
            if (raceProgress >= 100) {
                finishers = runners;
                score = finishers * 10 + style + (newsPresent ? 50 : 0) + (ceaseDesists * 20);
                // Dennys bonus
                score += 25; // post-race ceremony
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-roguevalley-high', highScore.toString());
                }
                state = STATE.GAMEOVER;
                popupEnteredAt = Date.now();
            }

            // Suspicion creeps up during race
            suspicion += 0.02;
            if (suspicion >= 100) getShutDown();
        }

        // Animate town runners
        townRunners.forEach(r => {
            r.x += r.speed * 0.5;
            if (r.x > canvas.width + 20) r.x = -20;
        });
    }

    // Draw
    function drawTown() {
        const w = canvas.width, h = canvas.height;

        // Sky
        ctx.fillStyle = C.sky;
        ctx.fillRect(0, 0, w, h * 0.4);

        // Buildings
        for (let i = 0; i < 6; i++) {
            const bx = (i * 140 + 10);
            const bh = 40 + (i * 17) % 30;
            ctx.fillStyle = i === 2 ? C.storeFront : '#ddd';
            ctx.fillRect(bx, h * 0.4 - bh, 110, bh);

            // Windows
            ctx.fillStyle = '#8bc';
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 3; c++) {
                    ctx.fillRect(bx + 10 + c * 35, h * 0.4 - bh + 8 + r * 16, 12, 10);
                }
            }
        }

        // THE STORE (highlighted)
        const storeX = 2 * 140 + 10;
        ctx.fillStyle = C.store;
        ctx.fillRect(storeX, h * 0.37, 110, 4);
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('ROGUE VALLEY', storeX + 55, h * 0.4 - 45);
        ctx.fillText('RUNNERS', storeX + 55, h * 0.4 - 36);

        // Sidewalk
        ctx.fillStyle = C.sidewalk;
        ctx.fillRect(0, h * 0.4, w, 15);

        // Road
        ctx.fillStyle = C.road;
        ctx.fillRect(0, h * 0.4 + 15, w, 60);

        // Road lines
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 15]);
        const lineOff = (-scrollX) % 30;
        ctx.beginPath();
        ctx.moveTo(lineOff, h * 0.4 + 45);
        ctx.lineTo(w, h * 0.4 + 45);
        ctx.stroke();
        ctx.setLineDash([]);

        // Grass/park
        ctx.fillStyle = C.grass;
        ctx.fillRect(0, h * 0.4 + 75, w, h * 0.6 - 75);

        // Cones
        townCones.forEach(c => {
            ctx.fillStyle = C.cone;
            ctx.beginPath();
            ctx.moveTo(c.x - 5, c.y + 8);
            ctx.lineTo(c.x + 5, c.y + 8);
            ctx.lineTo(c.x, c.y - 5);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(c.x - 3, c.y, 6, 2);
        });

        // Runners
        townRunners.forEach(r => {
            ctx.fillStyle = C.runner;
            ctx.fillRect(r.x - 3, r.y - 12, 6, 10);
            ctx.fillRect(r.x - 2, r.y - 16, 4, 4);
            // Bib
            if (bibs > 0) {
                ctx.fillStyle = C.bib;
                ctx.fillRect(r.x - 2, r.y - 10, 4, 3);
            }
        });

        // News van
        if (newsPresent) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(w - 80, h * 0.4 + 20, 50, 25);
            ctx.fillStyle = C.news;
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NEWS', w - 55, h * 0.4 + 37);
            // Satellite dish
            ctx.fillStyle = '#888';
            ctx.fillRect(w - 60, h * 0.4 + 12, 2, 8);
            ctx.beginPath();
            ctx.arc(w - 60, h * 0.4 + 10, 6, Math.PI, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '9px "Press Start 2P", monospace';

        // Phase
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        const phaseLabel = state === STATE.SETUP ? 'SETUP PHASE' :
                          state === STATE.RACING ? 'RACE IN PROGRESS' : 'PUKE 5K';
        ctx.fillText(phaseLabel, 10, 18);

        // Stats
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.cone;
        ctx.fillText('CONES: ' + cones, 10, 32);
        ctx.fillStyle = C.runner;
        ctx.fillText('RUNNERS: ' + runners, 10, 44);
        ctx.fillStyle = C.bib;
        ctx.fillText('BIBS: ' + bibs, 10, 56);

        // Suspicion meter
        ctx.textAlign = 'right';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = suspicion > 70 ? C.suspicion : C.textDim;
        ctx.fillText('SUSPICION', w - 10, 18);

        ctx.fillStyle = C.dark;
        ctx.fillRect(w - 110, 22, 100, 8);
        ctx.fillStyle = suspicion > 70 ? C.suspicion : suspicion > 40 ? '#f1c40f' : C.grass;
        ctx.fillRect(w - 110, 22, 100 * (suspicion / 100), 8);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(w - 110, 22, 100, 8);

        // Style
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('STYLE: ' + Math.floor(style), w - 10, 44);

        // Race progress (during race)
        if (state === STATE.RACING) {
            ctx.textAlign = 'center';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText('RACE: ' + Math.floor(raceProgress) + '%', w / 2, 18);

            ctx.fillStyle = C.dark;
            ctx.fillRect(w / 2 - 60, 22, 120, 6);
            ctx.fillStyle = C.text;
            ctx.fillRect(w / 2 - 60, 22, 120 * (raceProgress / 100), 6);

            // Timer
            const mins = Math.floor(raceTime / 60);
            const secs = Math.floor(raceTime % 60);
            ctx.fillText(mins + ':' + (secs < 10 ? '0' : '') + secs, w / 2, 38);
        }

        // Setup instructions
        if (state === STATE.SETUP) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.textAlign = 'center';

            const needed = [];
            if (cones < 10) needed.push((10 - cones) + ' more cones');
            if (runners < 5) needed.push((5 - runners) + ' more runners');
            if (bibs < 5) needed.push((5 - bibs) + ' more bibs');

            if (needed.length > 0) {
                ctx.fillText('NEED: ' + needed.join(', '), w / 2, canvas.height - 22);
            } else {
                ctx.fillStyle = C.text;
                ctx.fillText('READY TO RACE!', w / 2, canvas.height - 22);
            }
            ctx.fillText('TAP = CONE/RECRUIT/BIB  |  C/R/B KEYS', w / 2, canvas.height - 8);
        }

        if (state === STATE.RACING) {
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.textAlign = 'center';
            ctx.fillText('TAP TO MANAGE RACE', w / 2, canvas.height - 8);
        }

        // Cease and desists
        if (ceaseDesists > 0) {
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillStyle = C.suspicion;
            ctx.textAlign = 'left';
            ctx.fillText('C&D LETTERS: ' + ceaseDesists, 10, 68);
        }
    }

    function drawEvent() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.85)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#fdf5e6';
        ctx.textAlign = 'center';

        // Wrap text
        const words = eventText.split(' ');
        let lines = [''];
        words.forEach(word => {
            const test = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + word;
            if (test.length > 42) lines.push(word);
            else lines[lines.length - 1] = test;
        });
        lines.forEach((line, i) => {
            ctx.fillText(line, w / 2, h * 0.28 + i * 20);
        });

        eventChoices.forEach((choice, i) => {
            const cx = i === 0 ? w * 0.28 : w * 0.72;
            const cy = h * 0.5;

            ctx.fillStyle = 'rgba(42, 21, 6, 0.9)';
            ctx.fillRect(cx - 80, cy - 15, 160, 35);
            ctx.strokeStyle = C.text;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 80, cy - 15, 160, 35);

            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText((i + 1) + '. ' + choice.label, cx, cy + 5);
        });

        ctx.font = '10px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('Press 1/2 or tap left/right', w / 2, h * 0.68);
    }

    function drawShutdown() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.92)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillStyle = C.suspicion;
        ctx.textAlign = 'center';
        ctx.fillText('SHUT DOWN!', w / 2, h * 0.15);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = '#fdf5e6';
        ctx.fillText('The authorities have been called.', w / 2, h * 0.15 + 25);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(finishers + ' FINISHERS', w / 2, h * 0.32);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('SCORE: ' + score, w / 2, h * 0.4);

        let details = [];
        if (newsPresent) details.push('Made the local news (+50)');
        if (ceaseDesists > 0) details.push(ceaseDesists + ' cease-and-desist letters (+' + (ceaseDesists * 20) + ')');
        if (storeOwnerAngry) details.push('Store owner challenged to sprint');
        if (rivalRace) details.push('Merged with the official race');

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        details.forEach((d, i) => {
            ctx.fillText(d, w / 2, h * 0.48 + i * 18);
        });

        ctx.font = '14px "VT323", monospace';
        let flavor = '';
        if (finishers >= 10) flavor = 'A truly non-sanctioned event. Not affiliated in any way.';
        else if (finishers >= 5) flavor = 'Some finished before the cops arrived.';
        else if (finishers > 0) flavor = 'A few brave souls crossed that line.';
        else flavor = 'Nobody finished. But the cones were beautiful.';
        ctx.fillText(flavor, w / 2, h * 0.7);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.85);
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.92)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'center';
        ctx.fillText('RACE COMPLETE!', w / 2, h * 0.12);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = '#fdf5e6';
        ctx.fillText('Non-sanctioned. Not affiliated with Rogue Valley Runners.', w / 2, h * 0.12 + 22);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(finishers + ' FINISHERS', w / 2, h * 0.28);

        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('SCORE: ' + score, w / 2, h * 0.36);

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('NEW HIGH SCORE!', w / 2, h * 0.42);
        }

        // Breakdown
        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('Finishers: ' + finishers + ' x 10 = ' + (finishers * 10), w / 2, h * 0.5);
        ctx.fillText('Style points: ' + Math.floor(style), w / 2, h * 0.5 + 18);
        if (newsPresent) ctx.fillText('News coverage bonus: +50', w / 2, h * 0.5 + 36);
        if (ceaseDesists > 0) ctx.fillText('C&D collection bonus: +' + (ceaseDesists * 20), w / 2, h * 0.5 + 54);
        ctx.fillText('Post-race Denny\'s ceremony: +25', w / 2, h * 0.5 + 72);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.text;
        let flavor = '';
        if (score > 300) flavor = 'Legendary. Matching shirts, Denny\'s trophies, and a police report.';
        else if (score > 200) flavor = 'A fine unauthorized event. The cones were *chef\'s kiss*.';
        else if (score > 100) flavor = 'Not bad for a totally fake race.';
        else flavor = 'The bibs were homemade but the spirit was real.';
        ctx.fillText(flavor, w / 2, h * 0.78);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO PLAY AGAIN', w / 2, h * 0.9);
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        // Store front
        ctx.fillStyle = C.storeFront;
        ctx.fillRect(w / 2 - 80, h * 0.35, 160, 60);
        ctx.fillStyle = C.store;
        ctx.fillRect(w / 2 - 80, h * 0.35, 160, 6);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('ROGUE VALLEY RUNNERS', w / 2, h * 0.35 + 22);

        // Cones in front
        for (let i = 0; i < 5; i++) {
            const cx = w / 2 - 60 + i * 30;
            ctx.fillStyle = C.cone;
            ctx.beginPath();
            ctx.moveTo(cx - 4, h * 0.35 + 55);
            ctx.lineTo(cx + 4, h * 0.35 + 55);
            ctx.lineTo(cx, h * 0.35 + 42);
            ctx.fill();
        }

        // Banner
        ctx.fillStyle = 'rgba(232, 127, 36, 0.9)';
        ctx.fillRect(w / 2 - 100, h * 0.35 + 58, 200, 20);
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText('TOTALLY LEGIT 5K', w / 2, h * 0.35 + 72);

        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('ROGUE VALLEY', w / 2, h * 0.08 + 10);
        ctx.fillText('RUNNERS 5K', w / 2, h * 0.08 + 32);

        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = C.suspicion;
        ctx.fillText('NON-SANCTIONED EVENT', w / 2, h * 0.08 + 48);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('Organize an unauthorized 5k at someone else\'s store.', w / 2, h * 0.63);
        ctx.fillText('Place cones. Print bibs. Recruit confused runners.', w / 2, h * 0.63 + 18);
        ctx.fillText('Dodge cease-and-desist letters. Finish before shutdown.', w / 2, h * 0.63 + 36);
        ctx.fillText('Awards ceremony at Denny\'s.', w / 2, h * 0.63 + 54);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.86);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('HIGH SCORE: ' + highScore, w / 2, h * 0.95);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.SHUTDOWN) { drawShutdown(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }

        drawTown();
        drawHUD();

        if (state === STATE.EVENT) drawEvent();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
