// Copper Canyon - PUKE Games
// Side-scrolling racer through Copper Canyon, Mexico.
// Chase Tarahumara runners in huaraches through 50 miles of canyon.
// 95F heat, river crossings, altitude changes. Beat 6:38 (Will Harlam's record).

(function() {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = Math.min(window.innerWidth, 900);
        canvas.height = Math.min(window.innerHeight, 600);
    }
    resize();
    window.addEventListener('resize', resize);

    // Colors
    const C = {
        // Canyon palette
        skyTop: '#ff7043',
        skyBottom: '#ffcc80',
        sunGlow: '#fff3e0',
        terracotta: '#c75b39',
        terracottaLight: '#d4724a',
        ochre: '#cc8833',
        deepOrange: '#bf360c',
        sandstone: '#e6a96f',
        canyonShadow: '#7a3315',
        canyonFar: '#d4845a',
        canyonMid: '#b85c3a',
        canyonNear: '#8b3a1a',
        // Ground
        dirt: '#a0703c',
        dirtDark: '#7a5530',
        rock: '#8a7560',
        rockLight: '#a89880',
        river: '#3d8eb9',
        riverLight: '#5bb5d5',
        riverFoam: '#c8e6f0',
        // Runner
        player: '#e87f24',
        playerShorts: '#2a4a7a',
        playerShoes: '#ddd',
        tarahumara: '#7a4520',
        tarahumaraCloth: '#e8e0d0',
        huaraches: '#c8a060',
        // UI
        text: '#e87f24',
        textLight: '#fdf5e6',
        green: '#6b8e23',
        red: '#c0392b',
        yellow: '#f1c40f',
        dark: '#2a1506',
        // Vegetation
        cactus: '#3a6620',
        cactusDark: '#2a4a15',
        bush: '#5a7a28',
    };

    // States
    const STATE = { TITLE: 0, RACING: 1, GAMEOVER: 2 };
    let state = STATE.TITLE;

    // Game constants
    const TOTAL_DISTANCE = 50;          // miles
    const TARGET_TIME = 6 * 60 + 38;    // 6:38 in seconds (Will Harlam's record)
    const GAME_TIME_SCALE = 0.6;        // seconds of game time per real second (makes it playable)
    const MAX_HEAT = 100;
    const HEAT_STROKE_THRESHOLD = 95;

    // Terrain types
    const TERRAIN = { FLAT: 0, UPHILL: 1, DOWNHILL: 2, RIVER: 3 };

    // Terrain segments - each is a chunk of the course
    let terrainSegments = [];
    let currentSegment = 0;

    // Player state
    let playerX, playerY;
    let playerDist = 0;         // distance in miles
    let playerSpeed = 0;        // current px/frame speed
    let sprinting = false;
    let heat = 20;              // start warm, it's 95F
    let altitude = 5000;        // feet, Copper Canyon range
    let raceTime = 0;           // seconds elapsed
    let legFrame = 0;           // animation frame for legs
    let playerAlive = true;

    // Tarahumara AI
    let tarahDist = 0;
    let tarahX = 0;
    let tarahSpeed = 0;
    let tarahLegFrame = 0;

    // Parallax layers
    let bgScroll = 0;
    let mgScroll = 0;
    let fgScroll = 0;

    // River crossing
    let riverRocks = [];
    let onRock = false;
    let rockJumpCooldown = 0;
    let inRiver = false;

    // Particles (dust, sweat, splash)
    let particles = [];

    // Score
    let highScore = localStorage.getItem('puke-copper-high') || null;

    // Popup lockout (prevent accidental dismissal from rapid tapping)
    let popupEnteredAt = 0;
    const POPUP_LOCKOUT = 600;

    // Input
    let spaceHeld = false;
    let spaceJustPressed = false;

    document.addEventListener('keydown', e => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!spaceHeld) spaceJustPressed = true;
            spaceHeld = true;
            if (state === STATE.TITLE) startGame();
            else if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; }
        }
    });
    document.addEventListener('keyup', e => {
        if (e.code === 'Space') {
            spaceHeld = false;
        }
    });

    // Touch support
    let touching = false;
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        touching = true;
        if (!spaceHeld) spaceJustPressed = true;
        spaceHeld = true;
        if (state === STATE.TITLE) startGame();
        else if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; }
    });
    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        touching = false;
        spaceHeld = false;
    });
    canvas.addEventListener('mousedown', e => {
        if (state === STATE.TITLE) startGame();
        else if (state === STATE.GAMEOVER) { if (Date.now() - popupEnteredAt < POPUP_LOCKOUT) return; state = STATE.TITLE; }
        else {
            if (!spaceHeld) spaceJustPressed = true;
            spaceHeld = true;
        }
    });
    canvas.addEventListener('mouseup', () => { spaceHeld = false; });

    // Generate terrain for the whole course
    function generateTerrain() {
        terrainSegments = [];
        let dist = 0;
        while (dist < TOTAL_DISTANCE) {
            let type, length;
            let r = Math.random();
            if (r < 0.35) {
                type = TERRAIN.FLAT;
                length = 1.5 + Math.random() * 3;
            } else if (r < 0.55) {
                type = TERRAIN.UPHILL;
                length = 1 + Math.random() * 2;
            } else if (r < 0.75) {
                type = TERRAIN.DOWNHILL;
                length = 1 + Math.random() * 2;
            } else {
                type = TERRAIN.RIVER;
                length = 0.3 + Math.random() * 0.5;
            }
            terrainSegments.push({ type, start: dist, end: dist + length });
            dist += length;
        }
        // Make sure last segment covers the finish
        terrainSegments[terrainSegments.length - 1].end = TOTAL_DISTANCE + 1;
    }

    function getTerrainAt(dist) {
        for (let i = 0; i < terrainSegments.length; i++) {
            if (dist >= terrainSegments[i].start && dist < terrainSegments[i].end) {
                return terrainSegments[i];
            }
        }
        return { type: TERRAIN.FLAT, start: 0, end: 1 };
    }

    function generateRiverRocks() {
        riverRocks = [];
        let rx = 80;
        while (rx < canvas.width - 40) {
            riverRocks.push({
                x: rx + Math.random() * 30,
                w: 25 + Math.random() * 20,
                safe: Math.random() > 0.2   // most rocks are safe to land on
            });
            rx += 50 + Math.random() * 40;
        }
    }

    function startGame() {
        state = STATE.RACING;
        playerDist = 0;
        playerSpeed = 0;
        heat = 20;
        altitude = 5000;
        raceTime = 0;
        playerAlive = true;
        sprinting = false;
        tarahDist = 0.15;  // Tarahumara starts slightly ahead
        tarahSpeed = 0;
        particles = [];
        bgScroll = 0;
        mgScroll = 0;
        fgScroll = 0;
        legFrame = 0;
        tarahLegFrame = 0;
        onRock = false;
        inRiver = false;
        rockJumpCooldown = 0;
        generateTerrain();
        generateRiverRocks();
    }

    // Format time as H:MM:SS
    function formatTime(seconds) {
        let h = Math.floor(seconds / 3600);
        let m = Math.floor((seconds % 3600) / 60);
        let s = Math.floor(seconds % 60);
        return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatTimePrecise(seconds) {
        let h = Math.floor(seconds / 3600);
        let m = Math.floor((seconds % 3600) / 60);
        let s = Math.floor(seconds % 60);
        return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    // Spawn particle
    function spawnParticle(x, y, type) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2 - 1,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            type  // 'dust', 'sweat', 'splash'
        });
    }

    // === UPDATE ===
    function update(dt) {
        if (state !== STATE.RACING) return;

        let seg = getTerrainAt(playerDist);
        let terrain = seg.type;

        // Update altitude based on terrain
        if (terrain === TERRAIN.UPHILL) altitude += dt * 80;
        else if (terrain === TERRAIN.DOWNHILL) altitude -= dt * 80;
        altitude = Math.max(3000, Math.min(8000, altitude));

        // Sprint / jog
        sprinting = spaceHeld;

        // Player speed based on terrain and sprint
        let baseJog = 0.008;    // miles per second of game time
        let baseSprint = 0.016;

        let speedMult = 1;
        if (terrain === TERRAIN.UPHILL) speedMult = 0.55;
        else if (terrain === TERRAIN.DOWNHILL) speedMult = 1.3;
        else if (terrain === TERRAIN.RIVER) speedMult = 0.35;

        let targetSpeed = sprinting ? baseSprint * speedMult : baseJog * speedMult;

        // River crossing: jump on rocks mechanic
        if (terrain === TERRAIN.RIVER) {
            inRiver = true;
            if (spaceJustPressed && rockJumpCooldown <= 0) {
                onRock = true;
                rockJumpCooldown = 15;
                targetSpeed = baseSprint * 0.6;  // hopping on rocks is faster than wading
                spawnParticle(canvas.width * 0.3, canvas.height * 0.65, 'splash');
                spawnParticle(canvas.width * 0.3 + 10, canvas.height * 0.65, 'splash');
            }
            if (onRock) targetSpeed = baseSprint * 0.55;
            rockJumpCooldown -= 1;
        } else {
            inRiver = false;
            onRock = false;
        }

        // Smooth speed transition
        playerSpeed += (targetSpeed - playerSpeed) * 0.1;
        playerDist += playerSpeed * dt;

        // Heat management
        let heatRate = 0.8;  // base heat rise (it's 95F)
        if (sprinting) heatRate += 1.5;
        if (terrain === TERRAIN.UPHILL) heatRate += 0.5;
        if (terrain === TERRAIN.RIVER) heatRate = -3;  // river cools you down
        if (altitude > 6500) heatRate -= 0.3;  // higher altitude, slightly cooler

        heat += heatRate * dt;
        heat = Math.max(0, Math.min(MAX_HEAT, heat));

        // Heat stroke = game over
        if (heat >= MAX_HEAT) {
            playerAlive = false;
            endGame(false);
            return;
        }

        // Slow down when heat is high
        if (heat > 75) {
            let heatPenalty = (heat - 75) / 25;  // 0 to 1
            playerSpeed *= (1 - heatPenalty * 0.4);
        }

        // Race time
        raceTime += dt * GAME_TIME_SCALE;

        // === Tarahumara AI ===
        let tarahSeg = getTerrainAt(tarahDist);
        let tarahTerrain = tarahSeg.type;

        let tarahBase = 0.012;  // faster base than player
        let tarahMult = 1;
        if (tarahTerrain === TERRAIN.UPHILL) tarahMult = 0.85;      // barely slows down
        else if (tarahTerrain === TERRAIN.DOWNHILL) tarahMult = 1.25;
        else if (tarahTerrain === TERRAIN.RIVER) tarahMult = 0.7;   // fast river crosser
        else tarahMult = 0.9;  // on flats, player can close the gap if sprinting

        // Small random variation
        tarahBase += Math.sin(raceTime * 0.5) * 0.001;

        let tarahTarget = tarahBase * tarahMult;
        tarahSpeed += (tarahTarget - tarahSpeed) * 0.08;
        tarahDist += tarahSpeed * dt;

        // Leg animation
        let animSpeed = playerSpeed * 5000;
        legFrame += animSpeed * dt * 0.15;
        tarahLegFrame += tarahSpeed * 5000 * dt * 0.15;

        // Dust particles when running on dirt
        if (terrain !== TERRAIN.RIVER && Math.random() < 0.3) {
            spawnParticle(canvas.width * 0.3 - 5, canvas.height * 0.72, 'dust');
        }
        // Sweat when hot
        if (heat > 60 && Math.random() < (heat - 60) / 80) {
            spawnParticle(canvas.width * 0.3 + 5, canvas.height * 0.55, 'sweat');
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.type === 'dust') p.vy -= 0.02;
            if (p.type === 'splash') p.vy += 0.1;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // Scroll backgrounds
        let scrollAmt = playerSpeed * 4000 * dt;
        bgScroll += scrollAmt * 0.15;
        mgScroll += scrollAmt * 0.4;
        fgScroll += scrollAmt * 1;

        // Check finish
        if (playerDist >= TOTAL_DISTANCE) {
            endGame(true);
        }

        spaceJustPressed = false;
    }

    function endGame(finished) {
        state = STATE.GAMEOVER;
        popupEnteredAt = Date.now();
        if (finished) {
            let timeStr = formatTime(raceTime);
            let prev = highScore;
            if (!prev || raceTime < parseFloat(prev)) {
                highScore = raceTime;
                localStorage.setItem('puke-copper-high', raceTime.toString());
            }
        }
    }

    // === DRAW ===

    function drawSky() {
        let w = canvas.width, h = canvas.height;
        // Gradient sky - warm sunset tones
        let grad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        grad.addColorStop(0, C.skyTop);
        grad.addColorStop(0.4, '#ff8a65');
        grad.addColorStop(0.7, '#ffab91');
        grad.addColorStop(1, C.skyBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h * 0.5);

        // Sun glow
        ctx.save();
        ctx.globalAlpha = 0.3;
        let sunX = w * 0.75 - (bgScroll * 0.02 % w);
        let sunGrad = ctx.createRadialGradient(sunX, h * 0.15, 10, sunX, h * 0.15, 100);
        sunGrad.addColorStop(0, '#fff8e1');
        sunGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, w, h * 0.5);
        ctx.restore();
    }

    function drawCanyonWalls() {
        let w = canvas.width, h = canvas.height;

        // Far canyon wall (parallax slow)
        ctx.fillStyle = C.canyonFar;
        let farOff = -(bgScroll * 0.3) % 400;
        for (let x = farOff - 400; x < w + 400; x += 200) {
            let wallH = 100 + Math.sin(x * 0.008 + 1.5) * 50 + Math.cos(x * 0.003) * 30;
            ctx.beginPath();
            ctx.moveTo(x - 100, h * 0.5);
            ctx.lineTo(x - 60, h * 0.5 - wallH * 0.7);
            ctx.lineTo(x - 20, h * 0.5 - wallH);
            ctx.lineTo(x + 20, h * 0.5 - wallH * 0.85);
            ctx.lineTo(x + 60, h * 0.5 - wallH * 0.6);
            ctx.lineTo(x + 100, h * 0.5);
            ctx.fill();
        }

        // Mid canyon wall (parallax medium)
        ctx.fillStyle = C.canyonMid;
        let midOff = -(mgScroll * 0.3) % 350;
        for (let x = midOff - 350; x < w + 350; x += 175) {
            let wallH = 80 + Math.sin(x * 0.01 + 3) * 40 + Math.cos(x * 0.005 + 1) * 25;
            ctx.beginPath();
            ctx.moveTo(x - 88, h * 0.52);
            ctx.lineTo(x - 50, h * 0.52 - wallH * 0.8);
            ctx.lineTo(x - 10, h * 0.52 - wallH);
            ctx.lineTo(x + 30, h * 0.52 - wallH * 0.75);
            ctx.lineTo(x + 70, h * 0.52 - wallH * 0.5);
            ctx.lineTo(x + 88, h * 0.52);
            ctx.fill();
        }

        // Canyon wall detail lines
        ctx.strokeStyle = C.canyonShadow;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        let detOff = -(mgScroll * 0.3) % 350;
        for (let x = detOff - 350; x < w + 350; x += 60) {
            let baseY = h * 0.52;
            ctx.beginPath();
            ctx.moveTo(x, baseY - 20);
            ctx.lineTo(x + 3, baseY - 55 - Math.sin(x * 0.02) * 15);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Near canyon top overhang (top of screen, parallax)
        ctx.fillStyle = C.canyonNear;
        let nearOff = -(fgScroll * 0.15) % 300;
        for (let x = nearOff - 300; x < w + 300; x += 150) {
            let hangH = 30 + Math.sin(x * 0.012) * 20;
            ctx.beginPath();
            ctx.moveTo(x - 75, 0);
            ctx.lineTo(x - 75, hangH);
            ctx.quadraticCurveTo(x, hangH + 15, x + 75, hangH);
            ctx.lineTo(x + 75, 0);
            ctx.fill();
        }
    }

    function drawGround(terrain) {
        let w = canvas.width, h = canvas.height;
        let groundY = h * 0.72;

        if (terrain === TERRAIN.RIVER) {
            // River water
            let waterGrad = ctx.createLinearGradient(0, groundY - 15, 0, h);
            waterGrad.addColorStop(0, C.riverLight);
            waterGrad.addColorStop(0.3, C.river);
            waterGrad.addColorStop(1, '#1a5276');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, groundY - 15, w, h - groundY + 15);

            // Water ripple effect
            ctx.strokeStyle = C.riverFoam;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            for (let rx = -(fgScroll % 60); rx < w; rx += 60) {
                ctx.beginPath();
                ctx.moveTo(rx, groundY + 5 + Math.sin(rx * 0.05 + raceTime * 3) * 3);
                ctx.quadraticCurveTo(
                    rx + 15, groundY + 2 + Math.sin(rx * 0.05 + raceTime * 3 + 1) * 3,
                    rx + 30, groundY + 5 + Math.sin(rx * 0.05 + raceTime * 3 + 2) * 3
                );
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // River rocks
            for (let rock of riverRocks) {
                let rx = rock.x - (fgScroll % canvas.width);
                if (rx < -50) rx += canvas.width + 100;
                ctx.fillStyle = C.rockLight;
                ctx.beginPath();
                ctx.ellipse(rx, groundY - 3, rock.w / 2, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = C.rock;
                ctx.beginPath();
                ctx.ellipse(rx, groundY - 5, rock.w / 2 - 3, 6, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Banks
            ctx.fillStyle = C.dirt;
            ctx.fillRect(0, groundY - 25, w, 12);
        } else {
            // Trail surface
            let trailGrad = ctx.createLinearGradient(0, groundY, 0, h);
            trailGrad.addColorStop(0, C.dirt);
            trailGrad.addColorStop(0.15, C.dirtDark);
            trailGrad.addColorStop(1, '#3a2510');
            ctx.fillStyle = trailGrad;
            ctx.fillRect(0, groundY, w, h - groundY);

            // Trail texture - rocks and pebbles
            ctx.fillStyle = C.rock;
            ctx.globalAlpha = 0.3;
            for (let rx = -(fgScroll % 40); rx < w; rx += 40) {
                let ry = groundY + 4 + Math.sin(rx * 0.3) * 2;
                ctx.fillRect(rx, ry, 3 + Math.sin(rx) * 2, 2);
            }
            ctx.globalAlpha = 1;

            // Slope indicator
            if (terrain === TERRAIN.UPHILL) {
                // Uphill arrows drawn subtly on trail
                ctx.strokeStyle = C.dirtDark;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.3;
                for (let ax = -(fgScroll % 80); ax < w; ax += 80) {
                    ctx.beginPath();
                    ctx.moveTo(ax, groundY + 15);
                    ctx.lineTo(ax + 8, groundY + 8);
                    ctx.lineTo(ax + 16, groundY + 15);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            } else if (terrain === TERRAIN.DOWNHILL) {
                ctx.strokeStyle = C.green;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.2;
                for (let ax = -(fgScroll % 80); ax < w; ax += 80) {
                    ctx.beginPath();
                    ctx.moveTo(ax, groundY + 8);
                    ctx.lineTo(ax + 8, groundY + 15);
                    ctx.lineTo(ax + 16, groundY + 8);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
        }

        // Foreground vegetation (cacti, shrubs) that scroll
        let vegOff = -(fgScroll * 0.8) % 250;
        for (let vx = vegOff - 250; vx < w + 250; vx += 125) {
            if (terrain === TERRAIN.RIVER) continue;
            let seed = Math.abs(Math.sin(vx * 7.3)) * 100;
            if (seed > 60) {
                // Cactus
                drawCactus(vx, groundY - 2, 8 + (seed % 15));
            } else if (seed > 30) {
                // Small bush
                ctx.fillStyle = C.bush;
                ctx.beginPath();
                ctx.arc(vx, groundY - 3, 6 + (seed % 5), 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawCactus(x, y, height) {
        ctx.fillStyle = C.cactus;
        ctx.fillRect(x - 3, y - height, 6, height);
        // Arms
        if (height > 12) {
            ctx.fillRect(x - 12, y - height * 0.7, 10, 4);
            ctx.fillRect(x - 12, y - height * 0.7 - 8, 4, 10);
            ctx.fillRect(x + 5, y - height * 0.5, 10, 4);
            ctx.fillRect(x + 11, y - height * 0.5 - 6, 4, 8);
        }
    }

    function drawRunner(x, y, legPhase, colors, isTarah) {
        let w = canvas.width;
        // Body
        let bodyH = 22;
        let headR = 6;
        let legLen = 14;

        // Head
        ctx.fillStyle = colors.skin;
        ctx.beginPath();
        ctx.arc(x, y - bodyH - headR, headR, 0, Math.PI * 2);
        ctx.fill();

        // Hair/headband
        if (isTarah) {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(x, y - bodyH - headR - 1, headR + 1, Math.PI, Math.PI * 2);
            ctx.fill();
            // Headband
            ctx.fillStyle = C.red;
            ctx.fillRect(x - headR - 1, y - bodyH - headR - 1, headR * 2 + 2, 3);
        }

        // Torso
        ctx.fillStyle = isTarah ? colors.cloth : colors.skin;
        ctx.fillRect(x - 5, y - bodyH, 10, 14);

        // Shorts / loincloth
        ctx.fillStyle = isTarah ? colors.cloth : colors.shorts;
        ctx.fillRect(x - 6, y - bodyH + 12, 12, 6);

        // Arms (pumping)
        let armSwing = Math.sin(legPhase) * 0.4;
        ctx.strokeStyle = colors.skin;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - bodyH + 4);
        ctx.lineTo(x - 12, y - bodyH + 10 + armSwing * 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 5, y - bodyH + 4);
        ctx.lineTo(x + 12, y - bodyH + 10 - armSwing * 10);
        ctx.stroke();

        // Legs
        let legSwing1 = Math.sin(legPhase) * 0.5;
        let legSwing2 = Math.sin(legPhase + Math.PI) * 0.5;

        ctx.strokeStyle = colors.skin;
        ctx.lineWidth = 3;
        // Left leg
        let lx1 = x - 3 + legSwing1 * legLen;
        let ly1 = y - 2;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - bodyH + 16);
        ctx.lineTo(lx1, ly1);
        ctx.stroke();
        // Right leg
        let lx2 = x + 3 + legSwing2 * legLen;
        let ly2 = y - 2;
        ctx.beginPath();
        ctx.moveTo(x + 3, y - bodyH + 16);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();

        // Shoes
        ctx.fillStyle = isTarah ? colors.huaraches : colors.shoes;
        ctx.fillRect(lx1 - 3, ly1 - 1, 7, 3);
        ctx.fillRect(lx2 - 3, ly2 - 1, 7, 3);
    }

    function drawParticles() {
        for (let p of particles) {
            let alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha * 0.6;
            if (p.type === 'dust') {
                ctx.fillStyle = C.sandstone;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'sweat') {
                ctx.fillStyle = '#87ceeb';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'splash') {
                ctx.fillStyle = C.riverFoam;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawHUD() {
        let w = canvas.width, h = canvas.height;
        let pad = 12;
        let fontSize = Math.max(10, Math.min(14, w * 0.016));
        ctx.font = fontSize + 'px "Press Start 2P", monospace';

        // Top-left: Time
        ctx.fillStyle = C.textLight;
        ctx.textAlign = 'left';
        ctx.fillText('TIME ' + formatTime(raceTime), pad, 28);

        // Terrain indicator
        let seg = getTerrainAt(playerDist);
        let terrainLabel = '';
        let terrainColor = C.textLight;
        if (seg.type === TERRAIN.FLAT) { terrainLabel = 'FLAT'; terrainColor = C.green; }
        else if (seg.type === TERRAIN.UPHILL) { terrainLabel = 'UPHILL'; terrainColor = C.red; }
        else if (seg.type === TERRAIN.DOWNHILL) { terrainLabel = 'DOWNHILL'; terrainColor = C.green; }
        else if (seg.type === TERRAIN.RIVER) { terrainLabel = 'RIVER'; terrainColor = '#5bb5d5'; }
        ctx.fillStyle = terrainColor;
        ctx.fillText(terrainLabel, pad, 48);

        // Top-right: Altitude
        ctx.textAlign = 'right';
        ctx.fillStyle = C.textLight;
        ctx.fillText(Math.floor(altitude) + ' FT', w - pad, 28);

        // Sprint indicator
        if (sprinting && state === STATE.RACING) {
            ctx.fillStyle = C.yellow;
            ctx.fillText('SPRINT', w - pad, 48);
        }

        // Heat meter - bottom left
        let meterX = pad;
        let meterY = h - 40;
        let meterW = Math.min(160, w * 0.2);
        let meterH = 12;

        ctx.font = Math.max(8, fontSize - 2) + 'px "Press Start 2P", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = C.textLight;
        ctx.fillText('HEAT', meterX, meterY - 4);

        ctx.strokeStyle = C.text;
        ctx.lineWidth = 2;
        ctx.strokeRect(meterX, meterY, meterW, meterH);

        let heatPct = heat / MAX_HEAT;
        let heatColor = heatPct < 0.5 ? C.green : heatPct < 0.75 ? C.yellow : C.red;
        ctx.fillStyle = heatColor;
        ctx.fillRect(meterX + 1, meterY + 1, (meterW - 2) * heatPct, meterH - 2);

        // Heat stroke warning
        if (heat > 80) {
            ctx.globalAlpha = 0.5 + Math.sin(raceTime * 8) * 0.5;
            ctx.fillStyle = C.red;
            ctx.font = fontSize + 'px "Press Start 2P", monospace';
            ctx.fillText('OVERHEATING!', meterX, meterY + meterH + 16);
            ctx.globalAlpha = 1;
        }

        // Distance progress bar - bottom center
        let barW = Math.min(300, w * 0.4);
        let barX = (w - barW) / 2;
        let barY = h - 30;
        let barH = 10;

        ctx.font = Math.max(8, fontSize - 2) + 'px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.textLight;
        ctx.fillText(playerDist.toFixed(1) + ' / ' + TOTAL_DISTANCE + ' MI', w / 2, barY - 6);

        ctx.strokeStyle = C.text;
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);

        let distPct = Math.min(1, playerDist / TOTAL_DISTANCE);
        ctx.fillStyle = C.text;
        ctx.fillRect(barX + 1, barY + 1, (barW - 2) * distPct, barH - 2);

        // Tarahumara position on progress bar
        let tarahPct = Math.min(1, tarahDist / TOTAL_DISTANCE);
        let tarahMarkerX = barX + tarahPct * barW;
        ctx.fillStyle = C.tarahumara;
        ctx.beginPath();
        ctx.moveTo(tarahMarkerX, barY - 2);
        ctx.lineTo(tarahMarkerX - 3, barY - 7);
        ctx.lineTo(tarahMarkerX + 3, barY - 7);
        ctx.fill();

        // Gap to Tarahumara - bottom right
        let gap = tarahDist - playerDist;
        ctx.textAlign = 'right';
        ctx.font = fontSize + 'px "Press Start 2P", monospace';
        if (gap > 0) {
            ctx.fillStyle = C.red;
            ctx.fillText('-' + gap.toFixed(2) + ' MI', w - pad, h - 25);
        } else {
            ctx.fillStyle = C.green;
            ctx.fillText('+' + Math.abs(gap).toFixed(2) + ' MI', w - pad, h - 25);
        }
        ctx.fillStyle = '#aa8866';
        ctx.font = Math.max(8, fontSize - 3) + 'px "Press Start 2P", monospace';
        ctx.fillText('TARAHUMARA GAP', w - pad, h - 40);
    }

    function drawTitle() {
        let w = canvas.width, h = canvas.height;

        // Draw the canyon background
        drawSky();
        drawCanyonWalls();

        // Overlay
        ctx.fillStyle = 'rgba(42, 21, 6, 0.8)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.textAlign = 'center';
        ctx.font = Math.min(32, w * 0.04) + 'px "Press Start 2P", monospace';
        ctx.fillStyle = C.deepOrange;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 8;
        ctx.fillText('COPPER CANYON', w / 2, h * 0.22);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = Math.min(14, w * 0.018) + 'px "Press Start 2P", monospace';
        ctx.fillStyle = C.ochre;
        ctx.fillText('Barranca del Cobre', w / 2, h * 0.30);

        // Description
        ctx.font = Math.min(18, w * 0.022) + 'px VT323, monospace';
        ctx.fillStyle = C.textLight;
        let lines = [
            '50 miles through Copper Canyon, Mexico',
            '95 degrees. No shade. The Tarahumara are faster.',
            '',
            'HOLD SPACE to sprint. Release to jog.',
            'River crossings cool you down - tap SPACE to hop rocks.',
            'Sprinting builds HEAT. Overheat = DNF.',
            '',
            'Beat the Tarahumara. Beat 6:38.',
        ];
        let lineH = Math.min(24, h * 0.04);
        let startY = h * 0.38;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], w / 2, startY + i * lineH);
        }

        // High score
        if (highScore) {
            ctx.fillStyle = C.yellow;
            ctx.font = Math.min(12, w * 0.015) + 'px "Press Start 2P", monospace';
            ctx.fillText('BEST: ' + formatTime(parseFloat(highScore)), w / 2, h * 0.82);
        }

        // Prompt
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
        ctx.font = Math.min(12, w * 0.015) + 'px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('PRESS SPACE OR TAP TO START', w / 2, h * 0.9);
        ctx.globalAlpha = 1;
    }

    function drawGameOver() {
        let w = canvas.width, h = canvas.height;

        // Dim overlay
        ctx.fillStyle = 'rgba(42, 21, 6, 0.85)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        if (playerDist >= TOTAL_DISTANCE) {
            // Finished!
            ctx.font = Math.min(28, w * 0.035) + 'px "Press Start 2P", monospace';
            ctx.fillStyle = C.text;
            ctx.fillText('FINISHED!', w / 2, h * 0.2);

            ctx.font = Math.min(22, w * 0.028) + 'px "Press Start 2P", monospace';
            ctx.fillStyle = C.textLight;
            ctx.fillText(formatTime(raceTime), w / 2, h * 0.32);

            // Compare to record
            if (raceTime <= TARGET_TIME) {
                ctx.fillStyle = C.yellow;
                ctx.font = Math.min(14, w * 0.018) + 'px "Press Start 2P", monospace';
                ctx.fillText('YOU BEAT HARLAM\'S RECORD!', w / 2, h * 0.42);
            } else {
                let diff = raceTime - TARGET_TIME;
                ctx.fillStyle = C.red;
                ctx.font = Math.min(12, w * 0.015) + 'px "Press Start 2P", monospace';
                ctx.fillText('RECORD: 6:38  (+' + formatTime(diff) + ')', w / 2, h * 0.42);
            }

            // Compare to Tarahumara
            if (playerDist > tarahDist) {
                ctx.fillStyle = C.green;
                ctx.font = Math.min(12, w * 0.015) + 'px "Press Start 2P", monospace';
                ctx.fillText('YOU BEAT THE TARAHUMARA!', w / 2, h * 0.52);
            } else {
                let behind = (tarahDist - playerDist).toFixed(1);
                ctx.fillStyle = '#aa8866';
                ctx.font = Math.min(12, w * 0.015) + 'px "Press Start 2P", monospace';
                ctx.fillText('TARAHUMARA FINISHED ' + behind + ' MI AHEAD', w / 2, h * 0.52);
            }

            // High score
            if (highScore) {
                ctx.fillStyle = C.yellow;
                ctx.font = Math.min(11, w * 0.014) + 'px "Press Start 2P", monospace';
                ctx.fillText('BEST: ' + formatTime(parseFloat(highScore)), w / 2, h * 0.62);
            }
        } else {
            // DNF - heat stroke
            ctx.font = Math.min(28, w * 0.035) + 'px "Press Start 2P", monospace';
            ctx.fillStyle = C.red;
            ctx.fillText('HEAT STROKE', w / 2, h * 0.2);

            ctx.font = Math.min(16, w * 0.02) + 'px "Press Start 2P", monospace';
            ctx.fillStyle = C.textLight;
            ctx.fillText('DNF', w / 2, h * 0.32);

            ctx.font = Math.min(18, w * 0.022) + 'px VT323, monospace';
            ctx.fillStyle = '#aa8866';
            ctx.fillText('Distance: ' + playerDist.toFixed(1) + ' / ' + TOTAL_DISTANCE + ' miles', w / 2, h * 0.42);
            ctx.fillText('Time: ' + formatTime(raceTime), w / 2, h * 0.48);

            ctx.font = Math.min(14, w * 0.018) + 'px VT323, monospace';
            ctx.fillStyle = C.ochre;
            ctx.fillText('"The canyon doesn\'t care about your training plan."', w / 2, h * 0.60);
        }

        // Restart prompt
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
        ctx.font = Math.min(11, w * 0.014) + 'px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.fillText('PRESS SPACE TO RETURN', w / 2, h * 0.85);
        ctx.globalAlpha = 1;
    }

    function drawRacing() {
        let w = canvas.width, h = canvas.height;
        let groundY = h * 0.72;
        let seg = getTerrainAt(playerDist);

        drawSky();
        drawCanyonWalls();
        drawGround(seg.type);

        // Heat shimmer effect when hot
        if (heat > 60) {
            ctx.globalAlpha = (heat - 60) / 100;
            ctx.fillStyle = 'rgba(255, 100, 50, 0.05)';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }

        // Draw Tarahumara runner (ahead of player)
        let gap = tarahDist - playerDist;
        let tarahScreenX = w * 0.3 + gap * w * 2;  // scale gap to screen distance
        tarahScreenX = Math.max(w * 0.3 + 30, Math.min(w - 30, tarahScreenX));

        // Only draw if on screen
        if (tarahScreenX < w + 30) {
            drawRunner(tarahScreenX, groundY, tarahLegFrame, {
                skin: C.tarahumara,
                cloth: C.tarahumaraCloth,
                huaraches: C.huaraches,
                shorts: C.tarahumaraCloth,
                shoes: C.huaraches,
            }, true);

            // Label
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = '#aa8866';
            ctx.textAlign = 'center';
            ctx.fillText('TARAHUMARA', tarahScreenX, groundY - 42);
        }

        // Draw player
        let playerScreenX = w * 0.3;
        let playerGroundY = groundY;
        if (seg.type === TERRAIN.RIVER && onRock) {
            playerGroundY -= 8;  // standing on rock
        }

        drawRunner(playerScreenX, playerGroundY, legFrame, {
            skin: C.player,
            shorts: C.playerShorts,
            shoes: C.playerShoes,
        }, false);

        // "YOU" label
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = 'center';
        ctx.fillText('YOU', playerScreenX, playerGroundY - 42);

        // Draw particles
        drawParticles();

        // Heat vignette
        if (heat > 70) {
            let vigAlpha = (heat - 70) / 60;
            let vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
            vigGrad.addColorStop(0, 'transparent');
            vigGrad.addColorStop(1, 'rgba(180, 30, 0, ' + vigAlpha + ')');
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, w, h);
        }

        drawHUD();
    }

    // === MAIN LOOP ===
    let lastTime = 0;

    function loop(time) {
        let dt = Math.min((time - lastTime) / 1000, 0.05);  // cap dt
        lastTime = time;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state === STATE.TITLE) {
            drawTitle();
        } else if (state === STATE.RACING) {
            update(dt);
            drawRacing();
        } else if (state === STATE.GAMEOVER) {
            drawRacing();  // draw last frame as background
            drawGameOver();
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
})();
