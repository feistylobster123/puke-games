# PUKE Games - Mini Game Collection

**Phoenix Ultrarunning Kids & Elders presents: a collection of browser-based mini games inspired by the legendary ultrapuke.blogspot.com**

A web game hub where each game is a standalone mini experience rooted in PUKE lore. Quick to play, hard to master, shareable scores. Built as a single site with a game selector menu styled after the blog's iconic orange/green/brown aesthetic with the stan-puking.gif energy throughout.

---

## The Games

### 1. Chipotle Mile
**Type:** Rhythm / timing game
**Inspiration:** The Chipotle Mile race - eat half a burrito before each lap, can't puke until you're done or you're DQ'd.

Tap to run, tap to chew. You alternate between running laps and scarfing burrito. A "nausea meter" rises with each burrito segment. Run too fast after eating and the meter spikes. If it hits max you puke and get DQ'd. The trick is pacing your eating vs running speed. Each lap the burrito gets bigger. High score = most laps completed.

**Key mechanic:** Two-phase loop (run / eat) with a rising risk meter.

---

### 2. Sasquatch Chase
**Type:** Endless runner / stealth hybrid
**Inspiration:** The Sasquatch Sighting post - blurry creature spotted in the Mazatzal mountains.

You're running a night trail in the Mazatzals. Sasquatch appears and disappears in the darkness ahead. You have a crappy phone camera. Try to get close enough for a clear photo without spooking him. If you get too close he bolts. If you're too far the photo is just a blur. Obstacles (rocks, cacti, washes) slow you down. Score = photo clarity rating. The sasquatch gets faster and more skittish each round.

**Key mechanic:** Distance management + timing your photo snap.

---

### 3. Avalanche Scramble
**Type:** Vertical climbing platformer
**Inspiration:** Avalanche 100 - 116,188 ft of elevation over 31 laps of Kendall Mountain with 45% grade and boulder scrambling.

Side-scrolling vertical climber. You scramble up a mountain through avalanche chutes, grabbing boulders and ledges. Rocks tumble down from above. Altitude sickness kicks in above certain thresholds (screen wobbles, controls get sluggish). You do laps - each lap the mountain gets more treacherous. A "soul crushing" meter shows how many of the 31 laps you've completed. Basically nobody will finish all 31.

**Key mechanic:** Vertical platforming with increasing environmental hazards per lap.

---

### 4. Camelback Repeats
**Type:** Tapper / incremental
**Inspiration:** Camelback Marathon - 10 round trips up Camelback Mountain in Phoenix heat, 20,000ft of gain.

Simple but brutal. Tap to climb. Temperature rises throughout the day (9am-3pm timer). Heat slows your tap effectiveness. Water stations appear but you have to bring your own - manage your supply. Hallucinations start appearing at high temps (mirages, phantom runners). Each round trip gets exponentially harder. Score = trips completed before the 3pm cutoff.

**Key mechanic:** Resource management (water) + declining efficiency from heat.

---

### 5. Chubby Fruitarian
**Type:** Balance / physics game
**Inspiration:** The Chubby Fruitarian race - run a marathon while eating 26.2 bananas (min 100g each).

Your runner carries an increasingly absurd stack of bananas while running. Physics-based balance - the banana stack wobbles. You eat one per mile but the pile keeps growing because aid stations keep tossing you more. Drop a banana and you have to pick it up. Eat too fast and you cramp. The visual absurdity of a runner buried in bananas is the whole vibe.

**Key mechanic:** Physics-based balancing act with resource consumption timing.

---

### 6. CRUD vs PUKE
**Type:** Tug of war / competitive
**Inspiration:** Team CRUD tries to outdo Team PUKE - the great rivalry.

Two-player (or vs AI) tug of war on a trail. Each side has a team of runners pulling. Tap sequences power your team. Powerups appear: animated GIFs rain from the sky (the blog weapon of choice), team mascots provide boosts (CRUD's purple pineapple vs PUKE's... well, puke). Lose and your team gets dragged through a mud pit. Simple, loud, stupid fun.

**Key mechanic:** Competitive tap battle with powerup management.

---

### 7. Copper Canyon
**Type:** Side-scrolling racer
**Inspiration:** CCUM 2009 - racing alongside Tarahumara runners in Copper Canyon, Mexico.

Race through procedurally generated canyon terrain. You're a gringo runner trying to keep up with Tarahumara runners in huaraches. They're faster on the technical terrain but you can close gaps on flats. 95-degree heat, river crossings, and altitude changes affect pace. The canyon walls are gorgeous pixel art. Finish in under 6:38 to beat Will Harlam's record.

**Key mechanic:** Terrain-adaptive racing where different runners have different strengths.

---

### 8. Night Pacer
**Type:** Memory / rhythm
**Inspiration:** The Gary Cross quote - "They wake up at 3 in the morning and say 'Man, those guys are STILL out there!!!'"

It's mile 80 of a 100-miler. 3 AM. You can only see what your headlamp reveals. Trail markers flash briefly - remember the sequence to stay on course. Wrong turn = lost time. Your pacer calls out obstacles but you have to react in time. Hallucinations get worse as fatigue rises (rocks look like animals, trees look like people). A meditation on what 3 AM in an ultra actually feels like.

**Key mechanic:** Limited visibility + memory sequences + hallucination interference.

---

### 9. Mt. Ord Expedition
**Type:** Team survival / resource management
**Inspiration:** Team PUKE's Mt. Ord climb through ice and snow, 4000ft.

Guide your team of PUKE runners up Mt. Ord in winter conditions. Manage warmth, energy, and morale. Ice patches cause slips (quick-time events). Snow depth slows the group. Someone always wants to turn back - keep morale high enough that nobody quits. Reach the summit and plant the PUKE flag.

**Key mechanic:** Group resource management with QTE hazards.

---

### 10. The PUKE-lette (Roulette)
**Type:** Party game / random challenge
**Inspiration:** The overall PUKE series ethos of absurd challenges.

Spin a wheel, get a random micro-challenge. 30-second bursts of chaos. Examples: "Eat 5 digital burritos in 10 seconds," "Navigate a trail blindfolded," "Outrun a sasquatch for 15 seconds," "Stack 10 bananas without dropping any." The wheel occasionally lands on "PUKE" which combines two challenges simultaneously. Great for passing around at a party or aid station.

**Key mechanic:** Randomized micro-game collection (WarioWare style).

---

## Technical Approach

- **Stack:** Vanilla HTML/CSS/JS or lightweight framework (Phaser.js for physics-heavy games)
- **Hosting:** GitHub Pages from this repo
- **Art style:** Pixel art meets blog-era GIF aesthetic. Orange/green/brown palette from the blog. Stan-puking.gif energy everywhere.
- **Scope per game:** Each game is 1-3 days of dev. Start with the simplest (Camelback Repeats, Chipotle Mile) and build momentum.
- **Shared infrastructure:** Score tracking, leaderboard (localStorage initially, could add a simple backend), game hub menu.

## Priority Order (suggested)

1. **Chipotle Mile** - Simple, iconic, captures the PUKE essence perfectly
2. **Camelback Repeats** - Dead simple mechanic, Phoenix-specific, heat is a great game element
3. **Sasquatch Chase** - Strong visual concept, fun to share screenshots
4. **PUKE-lette** - Party game energy, replayable, could go viral
5. **Avalanche Scramble** - Platformer gives it broader appeal
6. Everything else as momentum and interest allow

## Assets Needed

- Stan-puking.gif from the blog (or a recreation)
- Sasquatch silhouette
- Camelback Mountain profile
- Chipotle burrito pixel art
- PUKE and CRUD team logos
- Avalanche mountain profile based on Kendall Mountain elevation data
- Copper Canyon terrain references
- Phoenix desert palette: burnt orange, saguaro green, trail brown, sunrise pink

---

*"The rational in doing such a sport, is to experience the extraordinary moments of exceeding. You cannot experience them in normal life." - Y. Kouros*

*Now do it in pixel form.*
