// Mt. Ord Expedition - PUKE Games
// Guide Team PUKE up Mt. Ord in winter conditions.
// Manage warmth, energy, morale. Ice patches = QTEs.
// Someone always wants to turn back.

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
        sky: '#8ba4c0',
        snow: '#dde8f0',
        ice: '#a0c0e0',
        rock: '#7a7a6a',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#5c5c6c',
        cold: '#4a90d9',
        warm: '#c0392b',
        morale: '#f1c40f',
        dark: '#1a1a2a',
        tree: '#2a4a2a',
        flag: '#ff6600',
    };

    const STATE = { TITLE: 0, CLIMBING: 1, QTE: 2, EVENT: 3, SUMMIT: 4, GAMEOVER: 5 };
    let state = STATE.TITLE;

    // Team members with names
    const TEAM_NAMES = ['Jamil', 'Coury', 'Gopher', 'Speedgoat', 'Krar'];
    let team = [];

    // Resources
    let altitude = 0;       // 0-4000 ft
    let warmth = 80;         // 0-100
    let energy = 100;        // 0-100
    let morale = 75;         // 0-100

    // Progress
    let climbing = false;
    let climbSpeed = 0;
    let snowDepth = 0;       // 0-100, increases with altitude
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-mtord-high') || '0');

    // QTE (Quick Time Event) for ice patches
    let qteKey = '';
    let qteTimer = 0;
    let qteSuccess = false;

    // Events
    let eventText = '';
    let eventChoices = [];
    let eventTimer = 0;
    let nextEventAlt = 500;

    // Complaints
    let complaintTimer = 0;
    let complaintMsg = '';
    let complaintName = '';

    // Snow particles
    let snowflakes = [];
    for (let i = 0; i < 100; i++) {
        snowflakes.push({
            x: Math.random() * 800,
            y: Math.random() * 600,
            size: 1 + Math.random() * 2,
            speed: 0.5 + Math.random() * 1.5,
            drift: (Math.random() - 0.5) * 0.5,
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
            state = STATE.TITLE;
            return;
        }
        if (state === STATE.SUMMIT && (e.code === 'Space' || e.code === 'Enter')) {
            state = STATE.TITLE;
            return;
        }
        if (state === STATE.CLIMBING) {
            if (e.code === 'Space') {
                e.preventDefault();
                doClimb();
            }
        }
        if (state === STATE.QTE) {
            if (e.code === qteKey) {
                qteSuccess = true;
                resolveQTE();
            }
        }
        if (state === STATE.EVENT) {
            if (e.code === 'Digit1' || e.code === 'KeyA') resolveEvent(0);
            if (e.code === 'Digit2' || e.code === 'KeyB') resolveEvent(1);
        }
    });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER || state === STATE.SUMMIT) { state = STATE.TITLE; return; }
        if (state === STATE.CLIMBING) { doClimb(); return; }
        if (state === STATE.QTE) { qteSuccess = true; resolveQTE(); return; }
        if (state === STATE.EVENT) {
            const t = e.touches[0];
            if (t.clientX < canvas.width / 2) resolveEvent(0);
            else resolveEvent(1);
        }
    });

    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) { startGame(); return; }
        if (state === STATE.GAMEOVER || state === STATE.SUMMIT) { state = STATE.TITLE; return; }
        if (state === STATE.CLIMBING) { doClimb(); return; }
        if (state === STATE.QTE) { qteSuccess = true; resolveQTE(); return; }
        if (state === STATE.EVENT) {
            if (e.clientX < canvas.width / 2) resolveEvent(0);
            else resolveEvent(1);
        }
    });

    function startGame() {
        state = STATE.CLIMBING;
        team = TEAM_NAMES.map(name => ({
            name,
            morale: 70 + Math.random() * 30,
            active: true,
        }));
        altitude = 0;
        warmth = 80;
        energy = 100;
        morale = 75;
        climbSpeed = 0;
        snowDepth = 0;
        score = 0;
        nextEventAlt = 500;
        complaintTimer = 0;
    }

    function doClimb() {
        const snowPenalty = Math.max(0.3, 1 - snowDepth / 150);
        const energyMult = Math.max(0.2, energy / 100);
        const moraleMult = Math.max(0.3, morale / 100);

        climbSpeed = Math.min(8, climbSpeed + 2.5 * snowPenalty * energyMult * moraleMult);
    }

    function triggerQTE() {
        state = STATE.QTE;
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'];
        const labels = ['LEFT', 'RIGHT', 'UP', 'SPACE'];
        const idx = Math.floor(Math.random() * keys.length);
        qteKey = keys[idx];
        qteTimer = 90; // 1.5 seconds
        qteSuccess = false;
    }

    function resolveQTE() {
        if (qteSuccess) {
            morale = Math.min(100, morale + 5);
            complaintMsg = 'Nice save!';
            complaintName = 'Team';
            complaintTimer = 60;
        } else {
            // Slip! Lose altitude and warmth
            altitude = Math.max(0, altitude - 100);
            warmth = Math.max(0, warmth - 10);
            energy = Math.max(0, energy - 10);
            morale = Math.max(0, morale - 8);
            complaintMsg = 'ICE! Slipped back!';
            complaintName = team[Math.floor(Math.random() * team.filter(t => t.active).length)]?.name || 'Team';
            complaintTimer = 90;
        }
        state = STATE.CLIMBING;
    }

    function triggerEvent() {
        const events = [
            {
                text: 'The wind picks up. Someone wants to turn back.',
                choices: [
                    { label: 'Push on', effect: () => { morale -= 10; energy -= 5; } },
                    { label: 'Rest 10 min', effect: () => { warmth -= 8; energy += 15; morale += 5; } },
                ],
            },
            {
                text: 'You find a sheltered spot. Build a fire?',
                choices: [
                    { label: 'Build fire', effect: () => { warmth += 20; energy -= 10; } },
                    { label: 'Keep moving', effect: () => { warmth -= 5; morale -= 5; } },
                ],
            },
            {
                text: team[Math.floor(Math.random() * team.length)].name + ' is shivering badly.',
                choices: [
                    { label: 'Share jacket', effect: () => { warmth -= 15; morale += 15; } },
                    { label: 'Tough it out', effect: () => { morale -= 12; } },
                ],
            },
            {
                text: 'Deep snow drift blocks the path.',
                choices: [
                    { label: 'Power through', effect: () => { energy -= 20; } },
                    { label: 'Find a route around', effect: () => { energy -= 8; altitude -= 50; } },
                ],
            },
            {
                text: 'Someone spots the summit through the clouds!',
                choices: [
                    { label: 'Rally cry!', effect: () => { morale += 20; energy -= 5; } },
                    { label: 'Steady pace', effect: () => { morale += 5; } },
                ],
            },
            {
                text: 'A team member wants to quit. "This is insane."',
                choices: [
                    { label: 'Motivate them', effect: () => { morale += 10; energy -= 5; } },
                    { label: 'Let them go', effect: () => {
                        const active = team.filter(t => t.active);
                        if (active.length > 2) {
                            active[active.length - 1].active = false;
                            morale -= 5;
                        } else {
                            morale -= 15;
                        }
                    }},
                ],
            },
        ];

        const ev = events[Math.floor(Math.random() * events.length)];
        eventText = ev.text;
        eventChoices = ev.choices;
        state = STATE.EVENT;
    }

    function resolveEvent(choiceIdx) {
        if (choiceIdx >= eventChoices.length) return;
        eventChoices[choiceIdx].effect();

        // Clamp values
        warmth = Math.max(0, Math.min(100, warmth));
        energy = Math.max(0, Math.min(100, energy));
        morale = Math.max(0, Math.min(100, morale));

        nextEventAlt = altitude + 300 + Math.random() * 400;
        state = STATE.CLIMBING;
    }

    function update() {
        if (state === STATE.CLIMBING) {
            altitude += climbSpeed * 0.3;
            climbSpeed *= 0.9;

            // Snow depth increases with altitude
            snowDepth = Math.min(100, altitude / 40);

            // Resources drain
            warmth = Math.max(0, warmth - 0.02 - snowDepth * 0.001);
            energy = Math.max(0, energy - 0.015);
            morale = Math.max(0, morale - 0.008);

            // Random complaints
            if (complaintTimer <= 0 && Math.random() < 0.003) {
                const active = team.filter(t => t.active);
                if (active.length > 0) {
                    const member = active[Math.floor(Math.random() * active.length)];
                    const complaints = [
                        'My toes are numb!', 'How much further?', 'I can\'t feel my face',
                        'This snow is brutal', 'Are we lost?', 'I need a break',
                        'Why did I agree to this?', 'Is that ice?', 'The wind!',
                    ];
                    complaintMsg = complaints[Math.floor(Math.random() * complaints.length)];
                    complaintName = member.name;
                    complaintTimer = 120;
                }
            }
            if (complaintTimer > 0) complaintTimer--;

            // Ice patches (random QTEs)
            if (altitude > 1000 && Math.random() < 0.002 + altitude * 0.0001) {
                triggerQTE();
            }

            // Events
            if (altitude >= nextEventAlt) {
                triggerEvent();
            }

            // Summit!
            if (altitude >= 4000) {
                score = Math.floor(altitude);
                const activeCount = team.filter(t => t.active).length;
                score += activeCount * 100; // bonus for full team
                score += Math.floor(warmth) + Math.floor(energy) + Math.floor(morale);
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-mtord-high', highScore.toString());
                }
                state = STATE.SUMMIT;
                return;
            }

            // Game over conditions
            if (warmth <= 0 || energy <= 0 || morale <= 0) {
                score = Math.floor(altitude);
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-mtord-high', highScore.toString());
                }
                state = STATE.GAMEOVER;
            }
        }

        if (state === STATE.QTE) {
            qteTimer--;
            if (qteTimer <= 0 && !qteSuccess) {
                resolveQTE();
            }
        }

        // Snow animation
        snowflakes.forEach(s => {
            s.y += s.speed;
            s.x += s.drift + Math.sin(Date.now() / 1000 + s.x) * 0.3;
            if (s.y > canvas.height) { s.y = -5; s.x = Math.random() * canvas.width; }
            if (s.x < 0) s.x = canvas.width;
            if (s.x > canvas.width) s.x = 0;
        });
    }

    // Draw
    function drawMountain() {
        const w = canvas.width, h = canvas.height;
        const altFrac = altitude / 4000;

        // Sky darkens with altitude
        const skyR = Math.round(139 - altFrac * 50);
        const skyG = Math.round(164 - altFrac * 50);
        const skyB = Math.round(192 - altFrac * 30);
        ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`;
        ctx.fillRect(0, 0, w, h);

        // Distant peaks
        ctx.fillStyle = '#8898a8';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.4);
        ctx.lineTo(w * 0.15, h * 0.2);
        ctx.lineTo(w * 0.3, h * 0.35);
        ctx.lineTo(w * 0.5, h * 0.15);
        ctx.lineTo(w * 0.7, h * 0.3);
        ctx.lineTo(w * 0.85, h * 0.2);
        ctx.lineTo(w, h * 0.35);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fill();

        // Snow on peaks
        ctx.fillStyle = C.snow;
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.18);
        ctx.lineTo(w * 0.5, h * 0.15);
        ctx.lineTo(w * 0.55, h * 0.2);
        ctx.fill();

        // Foreground slope
        const slopeColor = altFrac > 0.7 ? C.snow : altFrac > 0.3 ? C.rock : C.tree;
        ctx.fillStyle = slopeColor;
        ctx.fillRect(0, h * 0.6, w, h * 0.4);

        // Snow cover on ground
        if (altFrac > 0.2) {
            ctx.fillStyle = `rgba(221, 232, 240, ${Math.min(1, altFrac * 1.5)})`;
            ctx.fillRect(0, h * 0.6, w, h * 0.4);
        }

        // Trees (fewer at higher altitude)
        if (altFrac < 0.7) {
            const treeCount = Math.floor(8 * (1 - altFrac));
            for (let i = 0; i < treeCount; i++) {
                const tx = (i * 100 + 30) % w;
                const ty = h * 0.58;
                ctx.fillStyle = C.tree;
                ctx.beginPath();
                ctx.moveTo(tx - 10, ty + 20);
                ctx.lineTo(tx + 10, ty + 20);
                ctx.lineTo(tx, ty);
                ctx.fill();
                ctx.fillRect(tx - 2, ty + 18, 4, 8);
            }
        }

        // Snow particles
        const intensity = 0.5 + altFrac;
        ctx.fillStyle = '#fff';
        snowflakes.forEach(s => {
            if (Math.random() < intensity) {
                ctx.globalAlpha = 0.6 + Math.random() * 0.4;
                ctx.fillRect(s.x, s.y, s.size, s.size);
            }
        });
        ctx.globalAlpha = 1;
    }

    function drawTeam() {
        const w = canvas.width, h = canvas.height;
        const baseY = h * 0.6;
        const activeTeam = team.filter(t => t.active);

        activeTeam.forEach((member, i) => {
            const mx = w * 0.3 + i * 40;
            const my = baseY - 5;
            const bob = Math.sin(Date.now() / 300 + i * 1.2) * 2;

            ctx.save();
            ctx.translate(mx, my + bob);

            // Body
            ctx.fillStyle = i === 0 ? C.runner : '#d47020';
            ctx.fillRect(-4, -20, 8, 14);
            // Head
            ctx.fillRect(-3, -26, 6, 6);
            // Hat
            ctx.fillStyle = C.cold;
            ctx.fillRect(-4, -28, 8, 3);
            // Legs
            ctx.fillStyle = i === 0 ? C.runner : '#d47020';
            ctx.fillRect(-3, -6, 3, 8);
            ctx.fillRect(1, -6, 3, 8);

            ctx.restore();

            // Name below
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.textAlign = 'center';
            ctx.fillText(member.name, mx, baseY + 15);
        });
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '10px "Press Start 2P", monospace';

        // Altitude
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText(Math.floor(altitude) + ' / 4000 FT', 10, 20);

        // Altitude bar
        ctx.fillStyle = C.dark;
        ctx.fillRect(10, 24, 140, 6);
        ctx.fillStyle = C.text;
        ctx.fillRect(10, 24, 140 * (altitude / 4000), 6);

        // Resources
        const meters = [
            { label: 'WARMTH', value: warmth, color: warmth < 30 ? C.cold : C.warm },
            { label: 'ENERGY', value: energy, color: energy < 30 ? C.warm : C.text },
            { label: 'MORALE', value: morale, color: morale < 30 ? C.warm : C.morale },
        ];

        meters.forEach((m, i) => {
            const mx = w - 160;
            const my = 14 + i * 16;

            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.textAlign = 'right';
            ctx.fillText(m.label, mx - 5, my + 4);

            ctx.fillStyle = C.dark;
            ctx.fillRect(mx, my - 2, 100, 8);
            ctx.fillStyle = m.color;
            ctx.fillRect(mx, my - 2, 100 * (m.value / 100), 8);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(mx, my - 2, 100, 8);
        });

        // Team count
        const activeCount = team.filter(t => t.active).length;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = activeCount < 3 ? C.warm : C.text;
        ctx.textAlign = 'left';
        ctx.fillText('TEAM: ' + activeCount + '/' + team.length, 10, 45);

        // Snow depth
        ctx.fillStyle = C.snow;
        ctx.textAlign = 'right';
        ctx.fillText('SNOW: ' + Math.floor(snowDepth) + '%', w - 10, 60);

        // Complaint bubble
        if (complaintTimer > 0) {
            const alpha = complaintTimer > 30 ? 1 : complaintTimer / 30;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(42, 21, 6, 0.8)';
            ctx.fillRect(w / 2 - 120, canvas.height * 0.48, 240, 30);
            ctx.font = '10px "VT323", monospace';
            ctx.fillStyle = C.morale;
            ctx.textAlign = 'center';
            ctx.fillText(complaintName + ': "' + complaintMsg + '"', w / 2, canvas.height * 0.48 + 18);
            ctx.globalAlpha = 1;
        }

        // Controls
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('TAP/SPACE = CLIMB', w / 2, canvas.height - 8);
    }

    function drawQTE() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = 'rgba(26, 26, 42, 0.7)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = C.ice;
        ctx.textAlign = 'center';
        ctx.fillText('ICE PATCH!', w / 2, h * 0.35);

        // Key prompt
        const keyLabel = qteKey.replace('Arrow', '').toUpperCase();
        ctx.font = '24px "Press Start 2P", monospace';

        const urgency = qteTimer / 90;
        ctx.fillStyle = urgency > 0.5 ? '#fff' : C.warm;
        ctx.fillText('PRESS ' + keyLabel + '!', w / 2, h * 0.5);

        // Timer bar
        ctx.fillStyle = C.dark;
        ctx.fillRect(w / 2 - 80, h * 0.58, 160, 10);
        ctx.fillStyle = urgency > 0.3 ? C.ice : C.warm;
        ctx.fillRect(w / 2 - 80, h * 0.58, 160 * urgency, 10);

        ctx.font = '10px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('(or TAP anywhere)', w / 2, h * 0.66);
    }

    function drawEvent() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = 'rgba(26, 26, 42, 0.85)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.snow;
        ctx.textAlign = 'center';

        // Wrap text
        const words = eventText.split(' ');
        let lines = [''];
        words.forEach(word => {
            const test = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + word;
            if (test.length > 40) lines.push(word);
            else lines[lines.length - 1] = test;
        });

        lines.forEach((line, i) => {
            ctx.fillText(line, w / 2, h * 0.3 + i * 20);
        });

        // Choices
        eventChoices.forEach((choice, i) => {
            const cx = i === 0 ? w * 0.3 : w * 0.7;
            const cy = h * 0.55;

            ctx.fillStyle = 'rgba(42, 21, 6, 0.8)';
            ctx.fillRect(cx - 70, cy - 15, 140, 30);
            ctx.strokeStyle = C.text;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 70, cy - 15, 140, 30);

            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText((i + 1) + '. ' + choice.label, cx, cy + 4);
        });

        ctx.font = '10px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('Press 1/2 or tap left/right', w / 2, h * 0.7);
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        // Mountain silhouette
        ctx.fillStyle = '#3a4a5a';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.3, h * 0.3);
        ctx.lineTo(w * 0.5, h * 0.15);
        ctx.lineTo(w * 0.7, h * 0.3);
        ctx.lineTo(w, h);
        ctx.fill();
        ctx.fillStyle = C.snow;
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.2);
        ctx.lineTo(w * 0.5, h * 0.15);
        ctx.lineTo(w * 0.55, h * 0.2);
        ctx.fill();

        // Flag at summit
        ctx.fillStyle = '#888';
        ctx.fillRect(w * 0.5 - 1, h * 0.15 - 15, 2, 15);
        ctx.fillStyle = C.flag;
        ctx.fillRect(w * 0.5 + 1, h * 0.15 - 15, 12, 8);

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('MT. ORD', w / 2, h * 0.06 + 10);
        ctx.fillText('EXPEDITION', w / 2, h * 0.06 + 38);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.snow;
        ctx.fillText('Guide Team PUKE up Mt. Ord in winter.', w / 2, h * 0.52);
        ctx.fillText('4,000 ft through ice and snow.', w / 2, h * 0.52 + 20);
        ctx.fillText('Manage warmth, energy, morale.', w / 2, h * 0.52 + 40);
        ctx.fillText('Keep the team together. Plant the flag.', w / 2, h * 0.52 + 60);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.78);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('HIGH SCORE: ' + highScore, w / 2, h * 0.92);
        }
    }

    function drawSummit() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(26, 26, 42, 0.92)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'center';
        ctx.fillText('SUMMIT!', w / 2, h * 0.18);

        // Flag
        ctx.fillStyle = '#888';
        ctx.fillRect(w / 2 - 1, h * 0.24, 2, 30);
        ctx.fillStyle = C.flag;
        ctx.fillRect(w / 2 + 1, h * 0.24, 20, 12);
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText('PUKE', w / 2 + 11, h * 0.24 + 9);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = C.snow;
        ctx.fillText('4,000 FT', w / 2, h * 0.38);

        const activeCount = team.filter(t => t.active).length;
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText(activeCount + '/' + team.length + ' TEAM MEMBERS', w / 2, h * 0.45);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('SCORE: ' + score, w / 2, h * 0.55);

        if (score >= highScore) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillText('NEW RECORD!', w / 2, h * 0.6);
        }

        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = C.snow;
        const flavor = activeCount === team.length
            ? 'Full team on the summit. The PUKE flag flies.'
            : 'Flag planted. Some didn\'t make it, but the mountain was climbed.';
        ctx.fillText(flavor, w / 2, h * 0.7);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO CONTINUE', w / 2, h * 0.85);
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(26, 26, 42, 0.92)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        let reason = '';
        if (warmth <= 0) { ctx.fillStyle = C.cold; reason = 'HYPOTHERMIA'; }
        else if (energy <= 0) { ctx.fillStyle = C.warm; reason = 'EXHAUSTED'; }
        else { ctx.fillStyle = C.morale; reason = 'MORALE BROKEN'; }
        ctx.fillText(reason, w / 2, h * 0.2);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = C.snow;
        ctx.fillText('REACHED: ' + Math.floor(altitude) + ' FT', w / 2, h * 0.35);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('SCORE: ' + score, w / 2, h * 0.45);

        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        let flavor = '';
        if (altitude >= 3000) flavor = 'So close. The summit was right there.';
        else if (altitude >= 2000) flavor = 'Halfway up. The mountain wins this round.';
        else if (altitude >= 1000) flavor = 'The snow got deep fast.';
        else flavor = 'Barely started. Mt. Ord doesn\'t mess around.';
        ctx.fillText(flavor, w / 2, h * 0.58);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.75);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) { drawTitle(); return; }
        if (state === STATE.SUMMIT) { drawSummit(); return; }
        if (state === STATE.GAMEOVER) { drawGameOver(); return; }

        drawMountain();
        drawTeam();
        drawHUD();

        if (state === STATE.QTE) drawQTE();
        if (state === STATE.EVENT) drawEvent();
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
