// The PUKE-lette - PUKE Games
// Spin a wheel, get a random micro-challenge. 30 seconds of chaos.
// WarioWare meets ultrarunning. "PUKE" combines two challenges.

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
        bg: '#2a1506',
        orange: '#e87f24',
        green: '#6b8e23',
        brown: '#8b4513',
        cream: '#fdf5e6',
        red: '#c0392b',
        yellow: '#f1c40f',
        tan: '#d2b48c',
        dark: '#1a0a02',
    };

    // Wheel segments with colors
    const SEGMENTS = [
        { name: 'BURRITO\nBLAST', color: '#c0392b', challenge: 'burrito' },
        { name: 'TRAIL\nDODGE', color: '#e87f24', challenge: 'dodge' },
        { name: 'BANANA\nSTACK', color: '#f1c40f', challenge: 'banana' },
        { name: 'SPEED\nTAP', color: '#6b8e23', challenge: 'speed' },
        { name: 'SASQUATCH\nSNAP', color: '#8b4513', challenge: 'sasquatch' },
        { name: 'BALANCE\nRUN', color: '#4a90d9', challenge: 'balance' },
        { name: 'PUKE!', color: '#9acd32', challenge: 'puke' },
        { name: 'BOULDER\nDODGE', color: '#a0826e', challenge: 'boulder' },
    ];

    const STATE = { TITLE: 0, SPINNING: 1, CHALLENGE: 2, RESULT: 3 };
    let state = STATE.TITLE;

    // Wheel
    let wheelAngle = 0;
    let wheelSpeed = 0;
    let selectedSegment = null;

    // Score
    let totalScore = 0;
    let roundsPlayed = 0;
    let highScore = parseInt(localStorage.getItem('puke-lette-high') || '0');

    // Challenge state
    let challengeTimer = 0;
    let challengeScore = 0;
    let challengeData = {};

    // Combo (PUKE = two challenges)
    let isCombo = false;
    let comboChallenge = null;

    // Input state
    let tapCount = 0;
    let lastTapTime = 0;
    let mouseX = 0, mouseY = 0;
    let isHolding = false;

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    document.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            handleTap();
        }
        if (e.code === 'ArrowLeft') challengeData.moveDir = -1;
        if (e.code === 'ArrowRight') challengeData.moveDir = 1;
    });
    document.addEventListener('keyup', e => {
        if (e.code === 'ArrowLeft' && challengeData.moveDir === -1) challengeData.moveDir = 0;
        if (e.code === 'ArrowRight' && challengeData.moveDir === 1) challengeData.moveDir = 0;
        if (e.code === 'Space') isHolding = false;
    });

    canvas.addEventListener('touchstart', e => { e.preventDefault(); handleTap(); isHolding = true; });
    canvas.addEventListener('touchmove', e => {
        const t = e.touches[0];
        mouseX = t.clientX;
        mouseY = t.clientY;
    });
    canvas.addEventListener('touchend', () => { isHolding = false; });
    canvas.addEventListener('mousedown', e => { handleTap(); isHolding = true; mouseX = e.clientX; mouseY = e.clientY; });
    canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    canvas.addEventListener('mouseup', () => { isHolding = false; });

    function handleTap() {
        tapCount++;
        lastTapTime = Date.now();

        if (state === STATE.TITLE) {
            startSpin();
        } else if (state === STATE.RESULT) {
            if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return;
            if (roundsPlayed >= 10) {
                state = STATE.TITLE;
                totalScore = 0;
                roundsPlayed = 0;
            } else {
                startSpin();
            }
        } else if (state === STATE.CHALLENGE) {
            challengeTap();
        }
    }

    function startSpin() {
        state = STATE.SPINNING;
        wheelSpeed = 15 + Math.random() * 10;
        selectedSegment = null;
    }

    function startChallenge(segment) {
        state = STATE.CHALLENGE;
        selectedSegment = segment;
        challengeTimer = 30 * 60; // 30 seconds at 60fps
        challengeScore = 0;
        challengeData = { moveDir: 0 };
        tapCount = 0;
        isCombo = false;

        if (segment.challenge === 'puke') {
            // PUKE = combo of two random challenges
            isCombo = true;
            const others = SEGMENTS.filter(s => s.challenge !== 'puke');
            const a = others[Math.floor(Math.random() * others.length)];
            let b = others[Math.floor(Math.random() * others.length)];
            while (b === a) b = others[Math.floor(Math.random() * others.length)];
            selectedSegment = a;
            comboChallenge = b;
        }

        initChallenge(selectedSegment.challenge);
        if (isCombo) initChallenge(comboChallenge.challenge);
    }

    function initChallenge(type) {
        switch(type) {
            case 'burrito':
                challengeData.burritos = 0;
                challengeData.target = 5;
                challengeData.chewing = false;
                challengeData.chewProgress = 0;
                break;
            case 'dodge':
                challengeData.playerX = canvas.width / 2;
                challengeData.obstacles = [];
                challengeData.dodgeTimer = 0;
                challengeData.dodged = 0;
                break;
            case 'banana':
                challengeData.stack = 0;
                challengeData.wobble = 0;
                challengeData.stability = 50;
                break;
            case 'speed':
                challengeData.taps = 0;
                challengeData.speedTarget = 30;
                break;
            case 'sasquatch':
                challengeData.sqX = canvas.width / 2 + (Math.random() - 0.5) * 300;
                challengeData.sqVisible = true;
                challengeData.sqTimer = 0;
                challengeData.snaps = 0;
                break;
            case 'balance':
                challengeData.balX = canvas.width / 2;
                challengeData.balVel = 0;
                challengeData.balTime = 0;
                break;
            case 'boulder':
                challengeData.playerX = challengeData.playerX || canvas.width / 2;
                challengeData.boulders = [];
                challengeData.boulderTimer = 0;
                challengeData.survived = 0;
                break;
        }
    }

    function challengeTap() {
        const type = selectedSegment.challenge;
        switch(type) {
            case 'burrito':
                challengeData.chewing = true;
                challengeData.chewProgress += 15;
                if (challengeData.chewProgress >= 100) {
                    challengeData.burritos++;
                    challengeData.chewProgress = 0;
                    challengeData.chewing = false;
                    challengeScore += 20;
                }
                break;
            case 'banana':
                challengeData.stack++;
                challengeData.wobble += 3;
                challengeScore += 10;
                break;
            case 'speed':
                challengeData.taps++;
                challengeScore = challengeData.taps;
                break;
            case 'sasquatch':
                if (challengeData.sqVisible) {
                    challengeData.snaps++;
                    challengeScore += 15;
                    challengeData.sqX = canvas.width / 2 + (Math.random() - 0.5) * 400;
                    if (Math.random() > 0.5) {
                        challengeData.sqVisible = false;
                        challengeData.sqTimer = 60;
                    }
                }
                break;
            case 'balance':
                // Tap to correct balance
                if (challengeData.balVel > 0) challengeData.balVel -= 2;
                else challengeData.balVel += 2;
                break;
        }

        if (isCombo) {
            // Also process combo challenge tap
            const comboType = comboChallenge.challenge;
            if (comboType === 'speed') {
                challengeData.taps = (challengeData.taps || 0) + 1;
            }
        }
    }

    // Update
    function update() {
        if (state === STATE.SPINNING) {
            wheelAngle += wheelSpeed * 0.02;
            wheelSpeed *= 0.985;

            if (wheelSpeed < 0.3) {
                // Determine selected segment
                const segAngle = (Math.PI * 2) / SEGMENTS.length;
                const normalizedAngle = (((-wheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
                const segIndex = Math.floor(normalizedAngle / segAngle) % SEGMENTS.length;
                startChallenge(SEGMENTS[segIndex]);
            }
        }

        if (state === STATE.CHALLENGE) {
            challengeTimer--;

            // Update challenge-specific logic
            updateChallenge(selectedSegment.challenge);
            if (isCombo) updateChallenge(comboChallenge.challenge);

            if (challengeTimer <= 0) {
                endChallenge();
            }
        }
    }

    function updateChallenge(type) {
        switch(type) {
            case 'dodge':
                challengeData.dodgeTimer++;
                if (challengeData.dodgeTimer % 30 === 0) {
                    challengeData.obstacles.push({
                        x: Math.random() * canvas.width,
                        y: -20,
                        size: 10 + Math.random() * 15,
                    });
                }
                challengeData.obstacles.forEach(o => { o.y += 3; });
                // Move player with arrow keys or tilt
                challengeData.playerX += (challengeData.moveDir || 0) * 5;
                challengeData.playerX = Math.max(20, Math.min(canvas.width - 20, challengeData.playerX));
                // Check collisions
                challengeData.obstacles = challengeData.obstacles.filter(o => {
                    if (o.y > canvas.height) {
                        challengeData.dodged++;
                        challengeScore += 5;
                        return false;
                    }
                    if (Math.abs(o.x - challengeData.playerX) < 20 && Math.abs(o.y - canvas.height * 0.7) < 15) {
                        challengeScore = Math.max(0, challengeScore - 10);
                        return false;
                    }
                    return true;
                });
                break;

            case 'banana':
                challengeData.wobble += Math.sin(Date.now() / 200) * 0.3;
                challengeData.stability -= Math.abs(challengeData.wobble) * 0.02;
                if (challengeData.stack > 5) {
                    challengeData.wobble += (Math.random() - 0.5) * 0.5;
                }
                if (challengeData.stability <= 0) {
                    challengeData.stack = Math.max(0, challengeData.stack - 3);
                    challengeData.stability = 50;
                    challengeData.wobble = 0;
                }
                break;

            case 'sasquatch':
                if (!challengeData.sqVisible) {
                    challengeData.sqTimer--;
                    if (challengeData.sqTimer <= 0) {
                        challengeData.sqVisible = true;
                        challengeData.sqX = canvas.width / 2 + (Math.random() - 0.5) * 400;
                    }
                } else {
                    challengeData.sqX += Math.sin(Date.now() / 500) * 2;
                }
                break;

            case 'balance':
                challengeData.balVel += (Math.random() - 0.5) * 0.8;
                challengeData.balX += challengeData.balVel;
                if (challengeData.balX > 20 && challengeData.balX < canvas.width - 20) {
                    challengeData.balTime++;
                    challengeScore = Math.floor(challengeData.balTime / 6); // score per 0.1 sec balanced
                }
                if (challengeData.balX < 20 || challengeData.balX > canvas.width - 20) {
                    challengeData.balX = canvas.width / 2;
                    challengeData.balVel = 0;
                    challengeScore = Math.max(0, challengeScore - 5);
                }
                break;

            case 'boulder':
                challengeData.boulderTimer++;
                if (challengeData.boulderTimer % 40 === 0) {
                    challengeData.boulders.push({
                        x: Math.random() * canvas.width,
                        y: -30,
                        size: 15 + Math.random() * 20,
                        speed: 2 + Math.random() * 3,
                    });
                }
                challengeData.playerX += (challengeData.moveDir || 0) * 5;
                challengeData.playerX = Math.max(20, Math.min(canvas.width - 20, challengeData.playerX));
                challengeData.boulders.forEach(b => { b.y += b.speed; });
                challengeData.boulders = challengeData.boulders.filter(b => {
                    if (b.y > canvas.height) {
                        challengeData.survived++;
                        challengeScore += 8;
                        return false;
                    }
                    if (Math.abs(b.x - challengeData.playerX) < b.size && Math.abs(b.y - canvas.height * 0.7) < b.size) {
                        challengeScore = Math.max(0, challengeScore - 15);
                        return false;
                    }
                    return true;
                });
                break;
        }
    }

    function endChallenge() {
        totalScore += challengeScore;
        roundsPlayed++;
        if (totalScore > highScore) {
            highScore = totalScore;
            localStorage.setItem('puke-lette-high', highScore.toString());
        }
        state = STATE.RESULT;
        popupEnteredAt = Date.now();
    }

    // Draw
    function drawWheel() {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2;
        const cy = h / 2 - 20;
        const radius = Math.min(w, h) * 0.32;
        const segAngle = (Math.PI * 2) / SEGMENTS.length;

        // Wheel shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 4, radius + 5, 0, Math.PI * 2);
        ctx.fill();

        // Wheel segments
        SEGMENTS.forEach((seg, i) => {
            const startAngle = wheelAngle + i * segAngle;
            const endAngle = startAngle + segAngle;

            ctx.fillStyle = seg.color;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = C.dark;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Segment text
            const midAngle = startAngle + segAngle / 2;
            const textR = radius * 0.65;
            const tx = cx + Math.cos(midAngle) * textR;
            const ty = cy + Math.sin(midAngle) * textR;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            const lines = seg.name.split('\n');
            lines.forEach((line, li) => {
                ctx.fillText(line, 0, (li - (lines.length - 1) / 2) * 14);
            });
            ctx.restore();
        });

        // Center circle
        ctx.fillStyle = C.dark;
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.orange;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PUKE', cx, cy);
        ctx.textBaseline = 'alphabetic';

        // Pointer (triangle at top)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 15);
        ctx.lineTo(cx - 10, cy - radius - 30);
        ctx.lineTo(cx + 10, cy - radius - 30);
        ctx.closePath();
        ctx.fill();

        // Outer ring
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    function drawChallengeScreen() {
        const w = canvas.width, h = canvas.height;
        const type = selectedSegment.challenge;

        // Background
        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        // Timer bar
        const timerFrac = challengeTimer / (30 * 60);
        ctx.fillStyle = timerFrac > 0.3 ? C.green : C.red;
        ctx.fillRect(0, 0, w * timerFrac, 6);

        // Timer text
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = timerFrac > 0.3 ? C.cream : C.red;
        ctx.textAlign = 'right';
        ctx.fillText(Math.ceil(challengeTimer / 60) + 's', w - 10, 22);

        // Score
        ctx.fillStyle = C.yellow;
        ctx.textAlign = 'left';
        ctx.fillText('SCORE: ' + challengeScore, 10, 22);

        // Challenge name
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = selectedSegment.color;
        ctx.textAlign = 'center';
        const title = isCombo ? 'PUKE COMBO!' : selectedSegment.name.replace('\n', ' ');
        ctx.fillText(title, w / 2, 22);

        // Draw challenge-specific content
        drawChallengeContent(type, false);
        if (isCombo) drawChallengeContent(comboChallenge.challenge, true);
    }

    function drawChallengeContent(type, isOverlay) {
        const w = canvas.width, h = canvas.height;
        const yOffset = isOverlay ? -60 : 0;

        switch(type) {
            case 'burrito':
                // Burrito eating challenge
                ctx.font = '14px "VT323", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('EAT ' + challengeData.target + ' BURRITOS!', w / 2, h * 0.35 + yOffset);
                ctx.fillText('Eaten: ' + (challengeData.burritos || 0), w / 2, h * 0.42 + yOffset);

                // Burrito visual
                for (let i = 0; i < challengeData.target; i++) {
                    const bx = w / 2 - (challengeData.target * 30) / 2 + i * 30;
                    const by = h * 0.55 + yOffset;
                    ctx.fillStyle = i < (challengeData.burritos || 0) ? '#555' : '#c8a96e';
                    ctx.beginPath();
                    ctx.ellipse(bx + 12, by, 12, 8, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Chew progress
                if (challengeData.chewing) {
                    ctx.fillStyle = C.orange;
                    ctx.fillRect(w / 2 - 50, h * 0.65 + yOffset, 100 * (challengeData.chewProgress / 100), 10);
                    ctx.strokeStyle = C.cream;
                    ctx.strokeRect(w / 2 - 50, h * 0.65 + yOffset, 100, 10);
                }

                ctx.font = '10px "Press Start 2P", monospace';
                ctx.fillStyle = C.orange;
                ctx.fillText('TAP TO CHEW!', w / 2, h * 0.78 + yOffset);
                break;

            case 'dodge':
                // Trail dodge
                ctx.fillStyle = C.brown;
                ctx.fillRect(w * 0.2, h * 0.3, w * 0.6, h * 0.5);

                // Player
                ctx.fillStyle = C.orange;
                ctx.fillRect((challengeData.playerX || w/2) - 8, h * 0.68, 16, 20);

                // Obstacles
                (challengeData.obstacles || []).forEach(o => {
                    ctx.fillStyle = '#666';
                    ctx.beginPath();
                    ctx.arc(o.x, o.y, o.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                });

                ctx.font = '10px "Press Start 2P", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('ARROWS TO DODGE!', w / 2, h * 0.28);
                ctx.fillText('DODGED: ' + (challengeData.dodged || 0), w / 2, h * 0.85);
                break;

            case 'banana':
                // Banana stack
                const stackH = challengeData.stack || 0;
                const baseY = h * 0.75 + yOffset;
                for (let i = 0; i < stackH; i++) {
                    const wobbleOff = Math.sin(Date.now() / 300 + i * 0.5) * (i * 0.8);
                    ctx.fillStyle = '#f1c40f';
                    ctx.save();
                    ctx.translate(w / 2 + wobbleOff, baseY - i * 12);
                    ctx.rotate((challengeData.wobble || 0) * 0.02 * i);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 20, 6, 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                ctx.font = '14px "VT323", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('STACK BANANAS! (Tap to add)', w / 2, h * 0.25 + yOffset);
                ctx.fillText('Stack: ' + stackH, w / 2, h * 0.82 + yOffset);

                // Stability meter
                ctx.fillStyle = C.dark;
                ctx.fillRect(w / 2 - 40, h * 0.86 + yOffset, 80, 8);
                ctx.fillStyle = (challengeData.stability || 0) > 25 ? C.green : C.red;
                ctx.fillRect(w / 2 - 40, h * 0.86 + yOffset, 80 * ((challengeData.stability || 50) / 100), 8);
                break;

            case 'speed':
                // Speed tap
                ctx.font = '40px "Press Start 2P", monospace';
                ctx.fillStyle = C.yellow;
                ctx.textAlign = 'center';
                ctx.fillText(challengeData.taps || 0, w / 2, h * 0.5 + yOffset);

                ctx.font = '14px "VT323", monospace';
                ctx.fillStyle = C.cream;
                ctx.fillText('TAP AS FAST AS POSSIBLE!', w / 2, h * 0.35 + yOffset);

                // Target
                ctx.font = '10px "Press Start 2P", monospace';
                ctx.fillStyle = (challengeData.taps || 0) >= 30 ? C.green : C.tan;
                ctx.fillText('TARGET: 30', w / 2, h * 0.62 + yOffset);
                break;

            case 'sasquatch':
                // Quick sasquatch snap
                ctx.fillStyle = '#0a1a0a';
                ctx.fillRect(0, h * 0.3 + yOffset, w, h * 0.45);

                if (challengeData.sqVisible) {
                    ctx.fillStyle = '#4a3a2a';
                    const sx = challengeData.sqX || w / 2;
                    ctx.fillRect(sx - 10, h * 0.45 + yOffset, 20, 30);
                    ctx.beginPath();
                    ctx.arc(sx, h * 0.43 + yOffset, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ff4444';
                    ctx.fillRect(sx - 4, h * 0.42 + yOffset, 2, 2);
                    ctx.fillRect(sx + 2, h * 0.42 + yOffset, 2, 2);
                }

                ctx.font = '10px "Press Start 2P", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('TAP WHEN YOU SEE HIM!', w / 2, h * 0.28 + yOffset);
                ctx.fillText('SNAPS: ' + (challengeData.snaps || 0), w / 2, h * 0.82 + yOffset);
                break;

            case 'balance':
                // Balance run
                const balX = challengeData.balX || w / 2;

                // Trail
                ctx.fillStyle = C.brown;
                ctx.fillRect(40, h * 0.6 + yOffset, w - 80, 20);

                // Runner
                ctx.fillStyle = C.orange;
                ctx.fillRect(balX - 6, h * 0.5 + yOffset, 12, 20);

                // Balance indicator
                const offCenter = Math.abs(balX - w / 2) / (w / 2);
                ctx.fillStyle = offCenter < 0.3 ? C.green : offCenter < 0.6 ? C.yellow : C.red;
                ctx.fillRect(balX - 1, h * 0.45 + yOffset, 2, 8);

                ctx.font = '10px "Press Start 2P", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('TAP TO BALANCE!', w / 2, h * 0.35 + yOffset);
                ctx.fillText('TIME: ' + Math.floor((challengeData.balTime || 0) / 60) + 's', w / 2, h * 0.85 + yOffset);
                break;

            case 'boulder':
                // Boulder dodge
                ctx.fillStyle = '#5c3a1e';
                ctx.fillRect(0, h * 0.3, w, h * 0.5);

                // Player
                ctx.fillStyle = C.orange;
                ctx.fillRect((challengeData.playerX || w/2) - 8, h * 0.68, 16, 20);

                // Boulders
                (challengeData.boulders || []).forEach(b => {
                    ctx.fillStyle = '#888';
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#666';
                    ctx.beginPath();
                    ctx.arc(b.x - 2, b.y - 2, b.size / 3, 0, Math.PI * 2);
                    ctx.fill();
                });

                ctx.font = '10px "Press Start 2P", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('ARROWS TO DODGE BOULDERS!', w / 2, h * 0.28);
                ctx.fillText('SURVIVED: ' + (challengeData.survived || 0), w / 2, h * 0.85);
                break;
        }
    }

    function drawResult() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.92)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = C.orange;
        ctx.textAlign = 'center';

        if (roundsPlayed >= 10) {
            ctx.fillText('GAME OVER', w / 2, h * 0.2);
            ctx.font = '24px "Press Start 2P", monospace';
            ctx.fillStyle = C.yellow;
            ctx.fillText('TOTAL: ' + totalScore, w / 2, h * 0.35);

            if (totalScore >= highScore) {
                ctx.font = '12px "Press Start 2P", monospace';
                ctx.fillStyle = C.green;
                ctx.fillText('NEW HIGH SCORE!', w / 2, h * 0.43);
            }

            let flavor = '';
            if (totalScore > 500) flavor = 'PUKE Hall of Fame material.';
            else if (totalScore > 300) flavor = 'Solid performance. PUKE proud.';
            else if (totalScore > 150) flavor = 'Not bad. Not great. Very PUKE.';
            else flavor = 'The wheel spins but the player does not.';

            ctx.font = '16px "VT323", monospace';
            ctx.fillStyle = C.tan;
            ctx.fillText(flavor, w / 2, h * 0.55);

            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.orange;
            const blink = Math.sin(Date.now() / 500) > 0;
            if (blink) ctx.fillText('TAP TO PLAY AGAIN', w / 2, h * 0.75);
        } else {
            ctx.fillText('ROUND ' + roundsPlayed + ' COMPLETE', w / 2, h * 0.2);

            ctx.font = '20px "Press Start 2P", monospace';
            ctx.fillStyle = C.yellow;
            ctx.fillText('+' + challengeScore, w / 2, h * 0.38);

            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.cream;
            ctx.fillText('TOTAL: ' + totalScore, w / 2, h * 0.48);

            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.tan;
            ctx.fillText('ROUND ' + roundsPlayed + '/10', w / 2, h * 0.56);

            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.orange;
            const blink = Math.sin(Date.now() / 500) > 0;
            if (blink) ctx.fillText('TAP TO SPIN AGAIN', w / 2, h * 0.72);
        }
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = C.dark;
        ctx.fillRect(0, 0, w, h);

        drawWheel();

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = C.orange;
        ctx.textAlign = 'center';
        ctx.fillText('THE PUKE-LETTE', w / 2, h * 0.06);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = C.tan;
        ctx.fillText('Spin the wheel. 30 seconds of chaos.', w / 2, h * 0.88);
        ctx.fillText('10 rounds. Land on PUKE for a combo challenge.', w / 2, h * 0.88 + 18);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.orange;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO SPIN', w / 2, h * 0.95);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.yellow;
            ctx.fillText('HIGH SCORE: ' + highScore, w / 2, h * 0.12);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        switch(state) {
            case STATE.TITLE:
                drawTitle();
                break;
            case STATE.SPINNING:
                ctx.fillStyle = C.dark;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawWheel();
                ctx.font = '14px "Press Start 2P", monospace';
                ctx.fillStyle = C.cream;
                ctx.textAlign = 'center';
                ctx.fillText('SPINNING...', canvas.width / 2, canvas.height * 0.06);
                break;
            case STATE.CHALLENGE:
                drawChallengeScreen();
                break;
            case STATE.RESULT:
                drawResult();
                break;
        }
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
