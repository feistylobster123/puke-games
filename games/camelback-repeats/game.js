// Camelback Repeats - PUKE Games
// 10 round trips up Camelback Mountain in Phoenix heat.
// Tap to climb. Heat rises throughout the day. Manage your water.
// Hallucinations at high temps. 9am-3pm cutoff.

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
        skyHot: '#f4a460',
        mountain: '#8b6914',
        mountainDark: '#5c3a1e',
        rock: '#a0826e',
        runner: '#e87f24',
        text: '#e87f24',
        textDim: '#8b6914',
        water: '#4a90d9',
        heat: '#c0392b',
        sun: '#f1c40f',
        trail: '#d4a026',
        cactus: '#6b8e23',
    };

    // State machine
    const STATE = { TITLE: 0, CLIMBING: 1, DESCENDING: 2, WATER_STATION: 3, HALLUCINATING: 4, GAMEOVER: 5 };
    let state = STATE.TITLE;

    // Game vars
    let trips = 0;            // completed round trips (up + down = 1 trip)
    let climbing = true;       // true = going up, false = going down
    let altitude = 0;          // 0-100 (bottom to summit)
    let climbSpeed = 0;
    let water = 100;           // 0-100
    let heat = 0;              // 0-100 (rises with game time)
    let gameTime = 0;          // seconds since 9am (0 = 9am, 21600 = 3pm)
    let tapEfficiency = 1.0;   // decreases with heat
    let score = 0;
    let highScore = parseInt(localStorage.getItem('puke-camelback-high') || '0');
    let tapRate = 0;
    let lastTapTime = 0;

    // Hallucination
    let hallucinationTimer = 0;
    let hallucinations = [];   // {type, x, y, life}
    let hallucinationIntensity = 0;

    // Runner
    let runnerBob = 0;
    let runnerFrame = 0;

    // Toast notifications (show for fixed duration, no dismiss needed)
    let toasts = [];  // {text, color, life, maxLife}
    function showToast(text, color, durationFrames) {
        toasts.push({ text, color: color || C.text, life: durationFrames || 120, maxLife: durationFrames || 120 });
    }

    // Water station input lockout
    let waterStationEnteredAt = 0;
    const WATER_STATION_LOCKOUT = 800; // ms before taps register
    let waterStationDrank = false; // track if they drank already

    // Game over lockout
    let gameOverEnteredAt = 0;
    const GAMEOVER_LOCKOUT = 600;

    // Mountain profile (simple peaks)
    let mountainPoints = [];
    function generateMountain() {
        mountainPoints = [];
        const segments = 40;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            // Camelback shape: two humps
            const h1 = Math.sin(t * Math.PI) * 0.7;
            const h2 = Math.sin(t * Math.PI * 2.2 + 0.5) * 0.25;
            const noise = Math.sin(t * 30) * 0.03;
            mountainPoints.push({ x: t, y: Math.max(0, h1 + h2 + noise) });
        }
    }
    generateMountain();

    // Water stations at specific altitudes
    const waterStations = [25, 50, 75];

    // Input
    document.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            handleTap();
        }
        if (e.code === 'KeyW' || e.code === 'KeyD') {
            handleDrink();
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

        if (state === STATE.TITLE) {
            startGame();
        } else if (state === STATE.GAMEOVER) {
            if (Date.now() - gameOverEnteredAt < GAMEOVER_LOCKOUT) return;
            state = STATE.TITLE;
        } else if (state === STATE.WATER_STATION) {
            // Input lockout: ignore taps for WATER_STATION_LOCKOUT ms after entering
            if (now - waterStationEnteredAt < WATER_STATION_LOCKOUT) return;
            handleDrink();
        } else if (state === STATE.CLIMBING || state === STATE.DESCENDING || state === STATE.HALLUCINATING) {
            doClimb();
        }
    }

    function handleDrink() {
        if (state === STATE.WATER_STATION) {
            if (!waterStationDrank) {
                // First valid tap: drink
                water = Math.min(100, water + 25);
                waterStationDrank = true;
                showToast('+25% WATER', C.water, 60);
            } else {
                // Already drank, second tap: leave
                state = climbing ? STATE.CLIMBING : STATE.DESCENDING;
            }
        }
    }

    function startGame() {
        state = STATE.CLIMBING;
        trips = 0;
        climbing = true;
        altitude = 0;
        climbSpeed = 0;
        water = 100;
        heat = 0;
        gameTime = 0;
        tapEfficiency = 1.0;
        score = 0;
        hallucinations = [];
        hallucinationIntensity = 0;
        toasts = [];
    }

    function doClimb() {
        // Tap efficiency drops with heat
        tapEfficiency = Math.max(0.15, 1.0 - (heat / 100) * 0.75);

        // Water boost
        const waterBonus = water > 50 ? 1.0 : water > 20 ? 0.7 : 0.4;

        const stride = 2.5 * tapEfficiency * waterBonus;

        if (climbing) {
            climbSpeed = Math.min(8, climbSpeed + stride);
        } else {
            // Descending is easier
            climbSpeed = Math.min(12, climbSpeed + stride * 1.5);
        }
    }

    function getTimeString() {
        const totalMinutes = Math.floor(gameTime / 60);
        let hours = 9 + Math.floor(totalMinutes / 60);
        let mins = totalMinutes % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        if (hours > 12) hours -= 12;
        return hours + ':' + (mins < 10 ? '0' : '') + mins + ' ' + ampm;
    }

    function getTemperature() {
        // 85F at 9am, peaks at 115F around 2pm
        const hoursFraction = gameTime / 3600;
        const peak = 5; // 5 hours in = 2pm
        const dist = Math.abs(hoursFraction - peak);
        return Math.round(85 + 30 * Math.max(0, 1 - dist / 5));
    }

    function spawnHallucination() {
        const types = ['mirage', 'phantom', 'oasis', 'animal'];
        const type = types[Math.floor(Math.random() * types.length)];
        hallucinations.push({
            type: type,
            x: Math.random() * canvas.width * 0.6 + canvas.width * 0.2,
            y: canvas.height * 0.3 + Math.random() * canvas.height * 0.3,
            life: 120 + Math.random() * 120,
            alpha: 0,
            scale: 0.5 + Math.random() * 0.5,
        });
    }

    // Update
    function update() {
        if (state === STATE.TITLE || state === STATE.GAMEOVER) return;

        // Game time advances (1 real second = ~30 game seconds for 6hr in ~12min)
        gameTime += 0.5;

        // Heat rises with time
        heat = Math.min(100, (gameTime / 21600) * 100);

        // Water depletes from heat and exertion
        const waterDrain = 0.015 + (heat / 100) * 0.03 + (climbSpeed > 0 ? 0.01 : 0);
        water = Math.max(0, water - waterDrain);

        // Movement
        if (state === STATE.CLIMBING || state === STATE.HALLUCINATING) {
            altitude += climbSpeed * 0.12;
            climbSpeed *= 0.88;

            // Check water stations
            for (const ws of waterStations) {
                if (Math.abs(altitude - ws) < 2 && climbSpeed < 2) {
                    if (water < 80) {
                        state = STATE.WATER_STATION;
                        waterStationEnteredAt = Date.now();
                        waterStationDrank = false;
                    }
                }
            }

            // Summit reached
            if (altitude >= 100) {
                altitude = 100;
                climbing = false;
                state = STATE.DESCENDING;
                showToast('SUMMIT! HEADING DOWN', '#f1c40f', 150);
            }
        } else if (state === STATE.DESCENDING) {
            altitude -= climbSpeed * 0.15;
            climbSpeed *= 0.9;

            // Check water stations on way down
            for (const ws of waterStations) {
                if (Math.abs(altitude - ws) < 2 && climbSpeed < 2) {
                    if (water < 60) {
                        state = STATE.WATER_STATION;
                        waterStationEnteredAt = Date.now();
                        waterStationDrank = false;
                    }
                }
            }

            // Bottom reached
            if (altitude <= 0) {
                altitude = 0;
                trips++;
                score = trips;
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('puke-camelback-high', highScore.toString());
                }
                if (trips >= 10) {
                    state = STATE.GAMEOVER;
                    gameOverEnteredAt = Date.now();
                    return;
                }
                climbing = true;
                state = STATE.CLIMBING;
                showToast('TRIP ' + trips + ' DONE! CLIMBING AGAIN', C.cactus, 150);
            }
        }

        // Hallucinations at high heat + low water
        hallucinationIntensity = Math.max(0, (heat - 50) / 50 + (1 - water / 100) * 0.5);
        if (hallucinationIntensity > 0.3 && Math.random() < hallucinationIntensity * 0.02) {
            spawnHallucination();
        }
        hallucinations = hallucinations.filter(h => {
            h.life--;
            h.alpha = h.life > 30 ? Math.min(1, h.alpha + 0.03) : h.life / 30;
            return h.life > 0;
        });

        // Time's up at 3pm
        if (gameTime >= 21600) {
            state = STATE.GAMEOVER;
            gameOverEnteredAt = Date.now();
        }

        // Dehydration game over
        if (water <= 0 && heat > 70) {
            state = STATE.GAMEOVER;
            gameOverEnteredAt = Date.now();
        }

        // Runner anim
        if (climbSpeed > 0.5) {
            runnerBob += climbSpeed * 0.3;
            runnerFrame += climbSpeed * 0.1;
        }

        // Tap rate decay
        if (Date.now() - lastTapTime > 500) {
            tapRate *= 0.85;
        }

        // Update toasts
        toasts = toasts.filter(t => { t.life--; return t.life > 0; });
    }

    // Draw
    function drawSky() {
        const w = canvas.width, h = canvas.height;
        const heatFrac = heat / 100;

        // Sky color shifts from blue to oppressive orange
        const r1 = Math.round(135 + heatFrac * 109);
        const g1 = Math.round(206 - heatFrac * 42);
        const b1 = Math.round(235 - heatFrac * 139);
        const skyColor = `rgb(${r1},${g1},${b1})`;

        const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        grad.addColorStop(0, skyColor);
        grad.addColorStop(1, '#fdf5e6');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Sun
        const sunY = h * 0.08 + (1 - Math.sin(gameTime / 21600 * Math.PI)) * h * 0.15;
        const sunSize = 20 + heatFrac * 15;
        ctx.fillStyle = C.sun;
        ctx.beginPath();
        ctx.arc(w * 0.75, sunY, sunSize, 0, Math.PI * 2);
        ctx.fill();

        // Heat shimmer
        if (heat > 60) {
            ctx.globalAlpha = (heat - 60) / 100;
            for (let i = 0; i < 5; i++) {
                const shimX = Math.random() * w;
                const shimY = h * 0.5 + Math.random() * h * 0.2;
                ctx.fillStyle = 'rgba(255, 200, 100, 0.3)';
                ctx.fillRect(shimX, shimY, 30, 1);
            }
            ctx.globalAlpha = 1;
        }
    }

    function drawMountainProfile() {
        const w = canvas.width, h = canvas.height;
        const baseY = h * 0.75;
        const peakHeight = h * 0.45;

        // Mountain fill
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        mountainPoints.forEach(p => {
            ctx.lineTo(p.x * w, baseY - p.y * peakHeight);
        });
        ctx.lineTo(w, baseY);
        ctx.closePath();

        const mGrad = ctx.createLinearGradient(0, baseY - peakHeight, 0, baseY);
        mGrad.addColorStop(0, C.mountain);
        mGrad.addColorStop(0.6, C.mountainDark);
        mGrad.addColorStop(1, '#3a1e0a');
        ctx.fillStyle = mGrad;
        ctx.fill();

        // Trail line
        ctx.strokeStyle = C.trail;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        mountainPoints.forEach((p, i) => {
            const tx = p.x * w;
            const ty = baseY - p.y * peakHeight + 5;
            if (i === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Cacti
        const cactiPositions = [0.1, 0.25, 0.65, 0.85];
        cactiPositions.forEach(pos => {
            const ci = Math.floor(pos * mountainPoints.length);
            if (ci < mountainPoints.length) {
                const cp = mountainPoints[ci];
                drawCactus(cp.x * w, baseY - cp.y * peakHeight - 2);
            }
        });

        // Water station markers
        waterStations.forEach(ws => {
            const frac = ws / 100;
            const mi = Math.floor(frac * (mountainPoints.length - 1));
            const mp = mountainPoints[mi];
            const wx = mp.x * w;
            const wy = baseY - mp.y * peakHeight - 5;
            ctx.fillStyle = C.water;
            ctx.fillRect(wx - 4, wy - 8, 8, 8);
            ctx.fillStyle = '#fff';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('W', wx, wy - 1);
        });

        // Ground below mountain
        ctx.fillStyle = '#3a1e0a';
        ctx.fillRect(0, baseY, w, h - baseY);
    }

    function drawCactus(x, y) {
        ctx.fillStyle = C.cactus;
        ctx.fillRect(x - 2, y - 15, 4, 15);
        ctx.fillRect(x - 8, y - 12, 6, 3);
        ctx.fillRect(x - 8, y - 12, 3, 8);
        ctx.fillRect(x + 3, y - 9, 6, 3);
        ctx.fillRect(x + 6, y - 9, 3, 6);
    }

    function drawRunner() {
        const w = canvas.width, h = canvas.height;
        const baseY = h * 0.75;
        const peakHeight = h * 0.45;

        // Runner position on mountain
        const frac = altitude / 100;
        const mi = Math.floor(frac * (mountainPoints.length - 1));
        const mp = mountainPoints[Math.min(mi, mountainPoints.length - 1)];
        const rx = mp.x * w;
        const ry = baseY - mp.y * peakHeight - 10;

        const bob = climbSpeed > 0.5 ? Math.sin(runnerBob) * 2 : 0;
        const lean = climbing ? -0.15 : 0.1;

        ctx.save();
        ctx.translate(rx, ry + bob);
        ctx.rotate(lean);

        // Body
        ctx.fillStyle = C.runner;
        ctx.fillRect(-5, -24, 10, 16);
        // Head
        ctx.fillRect(-4, -32, 8, 8);
        // Legs
        const legPhase = Math.sin(runnerFrame);
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

        // Water bottle (if has water)
        if (water > 0) {
            ctx.fillStyle = C.water;
            ctx.fillRect(6, -20, 4, 8);
            // Water level
            const wLevel = (water / 100) * 6;
            ctx.fillStyle = '#2a6cb5';
            ctx.fillRect(7, -14 + (6 - wLevel), 2, wLevel);
        }

        // Heat effects on face
        if (heat > 60) {
            // Sweat drops
            ctx.fillStyle = C.water;
            const sweatY = -28 + (Date.now() % 1000) / 100;
            ctx.fillRect(-2, sweatY, 1, 2);
            ctx.fillRect(3, sweatY + 3, 1, 2);
        }

        ctx.restore();

        // Altitude marker
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(altitude) + '%', rx, ry - 38);
    }

    function drawHallucinations() {
        hallucinations.forEach(h => {
            ctx.globalAlpha = h.alpha * 0.6;
            ctx.font = (16 * h.scale) + 'px "VT323", monospace';
            ctx.textAlign = 'center';

            switch(h.type) {
                case 'mirage':
                    ctx.fillStyle = C.water;
                    ctx.fillText('~~ water ~~', h.x, h.y);
                    break;
                case 'phantom':
                    ctx.fillStyle = C.runner;
                    ctx.fillText('is that a runner?', h.x, h.y);
                    // Ghost runner shape
                    ctx.fillStyle = 'rgba(232, 127, 36, 0.3)';
                    ctx.fillRect(h.x - 4, h.y + 5, 8, 20);
                    break;
                case 'oasis':
                    ctx.fillStyle = '#4a90d9';
                    ctx.fillText('pool ahead!', h.x, h.y);
                    break;
                case 'animal':
                    ctx.fillStyle = C.cactus;
                    ctx.fillText('was that a javelina?', h.x, h.y);
                    break;
            }
            ctx.globalAlpha = 1;
        });
    }

    function drawHUD() {
        const w = canvas.width;

        ctx.font = '12px "Press Start 2P", monospace';

        // Trips
        ctx.fillStyle = C.text;
        ctx.textAlign = 'left';
        ctx.fillText('TRIP ' + (trips + 1) + '/10', 60, 30);

        // Direction
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = climbing ? '#f1c40f' : C.cactus;
        ctx.fillText(climbing ? 'CLIMBING' : 'DESCENDING', 60, 46);

        // Time
        ctx.textAlign = 'right';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = gameTime > 18000 ? C.heat : C.text;
        ctx.fillText(getTimeString(), w - 20, 30);

        // Temperature
        const temp = getTemperature();
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = temp > 105 ? C.heat : temp > 95 ? '#f1c40f' : C.text;
        ctx.fillText(temp + 'F', w - 20, 46);

        // Water meter
        const meterX = w / 2 - 80;
        const meterY = 18;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.water;
        ctx.textAlign = 'center';
        ctx.fillText('WATER', w / 2, meterY - 2);

        ctx.fillStyle = '#1a0a02';
        ctx.fillRect(meterX, meterY, 160, 12);
        ctx.strokeStyle = water < 25 ? C.heat : C.water;
        ctx.lineWidth = 1;
        ctx.strokeRect(meterX, meterY, 160, 12);

        ctx.fillStyle = water < 25 ? C.heat : C.water;
        ctx.fillRect(meterX, meterY, 160 * (water / 100), 12);

        // Heat meter
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.heat;
        ctx.fillText('HEAT', w / 2, meterY + 28);

        ctx.fillStyle = '#1a0a02';
        ctx.fillRect(meterX, meterY + 30, 160, 12);
        ctx.strokeStyle = C.heat;
        ctx.strokeRect(meterX, meterY + 30, 160, 12);

        ctx.fillStyle = heat > 70 ? C.heat : '#f1c40f';
        ctx.fillRect(meterX, meterY + 30, 160 * (heat / 100), 12);

        // Efficiency indicator
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = tapEfficiency > 0.6 ? C.cactus : tapEfficiency > 0.3 ? '#f1c40f' : C.heat;
        ctx.textAlign = 'left';
        ctx.fillText('EFF: ' + Math.round(tapEfficiency * 100) + '%', 60, 64);

        // Score
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f1c40f';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText('TRIPS: ' + trips, w - 20, 64);
    }

    function drawToasts() {
        const w = canvas.width;
        toasts.forEach((t, i) => {
            const fadeIn = Math.min(1, (t.maxLife - t.life) / 10);
            const fadeOut = Math.min(1, t.life / 20);
            const alpha = Math.min(fadeIn, fadeOut);
            const y = canvas.height * 0.55 + i * 30;

            ctx.globalAlpha = alpha;
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = t.color;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, w / 2, y);
            ctx.globalAlpha = 1;
        });
    }

    function drawWaterStation() {
        const w = canvas.width, h = canvas.height;
        const locked = Date.now() - waterStationEnteredAt < WATER_STATION_LOCKOUT;

        ctx.fillStyle = 'rgba(42, 21, 6, 0.7)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = C.water;
        ctx.textAlign = 'center';
        ctx.fillText('WATER STATION', w / 2, h * 0.32);

        ctx.font = '20px "VT323", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('Water: ' + Math.floor(water) + '%', w / 2, h * 0.43);

        if (locked) {
            // Show "arriving" state during lockout
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = C.textDim;
            ctx.fillText('...', w / 2, h * 0.55);
        } else if (!waterStationDrank) {
            // Ready to drink
            ctx.font = '12px "Press Start 2P", monospace';
            const blink = Math.sin(Date.now() / 400) > 0;
            if (blink) {
                ctx.fillStyle = C.water;
                ctx.fillText('TAP TO DRINK', w / 2, h * 0.55);
            }
        } else {
            // Already drank, prompt to continue
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = C.water;
            ctx.fillText('REFRESHED!', w / 2, h * 0.53);

            ctx.font = '10px "Press Start 2P", monospace';
            const blink = Math.sin(Date.now() / 400) > 0;
            if (blink) {
                ctx.fillStyle = C.text;
                ctx.fillText('TAP TO CONTINUE', w / 2, h * 0.62);
            }
        }
    }

    function drawTitle() {
        const w = canvas.width, h = canvas.height;

        drawSky();
        drawMountainProfile();

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('CAMELBACK', w / 2, h * 0.15);
        ctx.fillText('REPEATS', w / 2, h * 0.15 + 32);

        ctx.font = '14px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        ctx.fillText('10 round trips up Camelback Mountain.', w / 2, h * 0.3);
        ctx.fillText('20,000ft of gain. Phoenix heat. Your water.', w / 2, h * 0.3 + 20);
        ctx.fillText('9am to 3pm. Clock is ticking.', w / 2, h * 0.3 + 40);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO START', w / 2, h * 0.52);

        ctx.font = '12px "VT323", monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText('SPACE / TAP to climb', w / 2, h * 0.62);
        ctx.fillText('Water stations refill at 25%, 50%, 75% altitude', w / 2, h * 0.62 + 18);

        if (highScore > 0) {
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText('BEST: ' + highScore + ' TRIPS', w / 2, h * 0.9);
        }
    }

    function drawGameOver() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgba(42, 21, 6, 0.88)';
        ctx.fillRect(0, 0, w, h);

        const won = trips >= 10;

        ctx.font = '24px "Press Start 2P", monospace';
        ctx.fillStyle = won ? '#f1c40f' : C.heat;
        ctx.textAlign = 'center';

        if (won) {
            ctx.fillText('SUMMIT KING', w / 2, h * 0.2);
        } else if (water <= 0) {
            ctx.fillText('DEHYDRATED', w / 2, h * 0.2);
        } else {
            ctx.fillText('TIME\'S UP', w / 2, h * 0.2);
        }

        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(trips + ' TRIPS', w / 2, h * 0.35);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText(Math.floor(trips * 2000) + ' FT GAINED', w / 2, h * 0.35 + 28);

        if (trips >= highScore && trips > 0) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText(won ? 'ALL 10 TRIPS!' : 'NEW RECORD!', w / 2, h * 0.35 + 50);
        }

        // Flavor
        ctx.font = '16px "VT323", monospace';
        ctx.fillStyle = '#d2b48c';
        let flavor = '';
        if (trips >= 10) flavor = 'You did all 10. Camelback has nothing left.';
        else if (trips >= 7) flavor = 'So close. The mountain barely won.';
        else if (trips >= 4) flavor = 'The heat got you. Phoenix always wins.';
        else if (trips >= 2) flavor = 'A couple trips. Camelback laughs.';
        else if (trips === 1) flavor = 'One trip. The tourists do that before brunch.';
        else flavor = 'Didn\'t even finish one. The heat is no joke.';
        ctx.fillText(flavor, w / 2, h * 0.55);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) ctx.fillText('TAP TO RETRY', w / 2, h * 0.72);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) {
            drawTitle();
            return;
        }
        if (state === STATE.GAMEOVER) {
            drawSky();
            drawMountainProfile();
            drawGameOver();
            return;
        }

        drawSky();
        drawMountainProfile();
        drawRunner();
        drawHallucinations();
        drawHUD();
        drawToasts();

        if (state === STATE.WATER_STATION) {
            drawWaterStation();
        }
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
})();
